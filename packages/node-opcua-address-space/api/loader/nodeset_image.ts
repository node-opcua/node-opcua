/**
 * @module node-opcua-address-space
 *
 * A precompiled nodeset image: the records of a document as JSON Lines, gzip-compressed. Line 1
 * is the header, then one line per node, and a trailer with the node count and the digest of the
 * source, so that a reader knows it saw the whole file. Writing an image is consuming records;
 * reading one is producing them: the loader replays an image exactly as it applies the XML.
 */

import {
    decodeHeader,
    decodeNode,
    type EncodeHeaderOptions,
    encodeHeader,
    encodeNode,
    NodesetImageError,
    type NodesetImageHeader,
    type NodesetImageNode,
    type NodesetImageTrailer
} from "./nodeset_image_codec.js";
import { type NodesetRecord, type NodesetRecordConsumer, type NodesetRecordWithBytes, recordBytes } from "./nodeset_record.js";
import type { NodesetChunk, NodesetChunkStream } from "./nodeset_source.js";

export { NodesetImageError, type NodesetImageHeader, type NodesetImageTrailer } from "./nodeset_image_codec.js";

/** the two bytes every gzip stream starts with: how an image is told from XML */
export function isNodesetImage(firstBytes: Uint8Array): boolean {
    return firstBytes.length >= 2 && firstBytes[0] === 0x1f && firstBytes[1] === 0x8b;
}

async function toReadableStream(source: Uint8Array | NodesetChunkStream): Promise<ReadableStream<Uint8Array>> {
    if (source instanceof Uint8Array) {
        return new Blob([source as BlobPart]).stream();
    }
    const asyncIterator = (source as AsyncIterable<NodesetChunk>)[Symbol.asyncIterator];
    const iterator = asyncIterator ? asyncIterator.call(source) : (source as Iterable<NodesetChunk>)[Symbol.iterator]();
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            const result = await iterator.next();
            if (result.done) {
                controller.close();
                return;
            }
            const chunk = result.value;
            controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
        },
        cancel() {
            iterator.return?.();
        }
    });
}

async function gzip(text: string): Promise<Uint8Array> {
    const compressed = new Blob([text])
        .stream()
        .pipeThrough(new CompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    return new Uint8Array(await new Response(compressed).arrayBuffer());
}

/** the lines of a gzip-compressed text, as they inflate */
async function* inflatedLines(source: Uint8Array | NodesetChunkStream): AsyncGenerator<string> {
    // the DOM typings of TypeScript 5.7 disagree on the typed-array generic here; the streams are what they are
    const stream = (await toReadableStream(source)).pipeThrough(
        new DecompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let remainder = "";
    try {
        for (;;) {
            let done: boolean;
            let value: Uint8Array | undefined;
            try {
                ({ done, value } = await reader.read());
            } catch (err) {
                // a truncated or corrupt gzip stream
                throw new NodesetImageError(`the image cannot be inflated: ${(err as Error).message}`);
            }
            const text = done ? decoder.decode() : decoder.decode(value, { stream: true });
            let start = 0;
            for (;;) {
                const newline = text.indexOf("\n", start);
                if (newline === -1) {
                    remainder += text.slice(start);
                    break;
                }
                yield remainder + text.slice(start, newline);
                remainder = "";
                start = newline + 1;
            }
            if (done) {
                break;
            }
        }
    } finally {
        reader.releaseLock();
    }
    if (remainder.length > 0) {
        yield remainder;
    }
}

export interface NodesetImageWriterOptions extends EncodeHeaderOptions {}

/**
 * a record consumer that builds the image; attach it next to the address-space applier and the
 * image is written in the same pass as the parse, whatever the source
 */
export class NodesetImageWriter implements NodesetRecordConsumer {
    private readonly lines: string[] = [];
    private nodes = 0;
    private headerSeen = false;

    constructor(private readonly options: NodesetImageWriterOptions = {}) {}

    public apply(record: NodesetRecord): void {
        if (record.kind === "header") {
            if (this.headerSeen) {
                throw new NodesetImageError("an image holds one document: a second header record was applied");
            }
            this.headerSeen = true;
            this.lines.push(JSON.stringify(encodeHeader(record, this.options)));
            return;
        }
        if (!this.headerSeen) {
            throw new NodesetImageError("a node record was applied before the header record");
        }
        this.lines.push(JSON.stringify(encodeNode(record)));
        this.nodes += 1;
    }

    /** the uncompressed lines, header first, trailer last */
    public text(sourceDigest: string): string {
        if (!this.headerSeen) {
            throw new NodesetImageError("no document was applied to this writer");
        }
        const trailer: NodesetImageTrailer = { kind: "trailer", nodes: this.nodes, sourceDigest };
        return `${this.lines.join("\n")}\n${JSON.stringify(trailer)}\n`;
    }

    /** the image: the lines, gzip-compressed */
    public async finish(sourceDigest: string): Promise<Uint8Array> {
        return gzip(this.text(sourceDigest));
    }
}

export interface ReadNodesetImageOptions {
    /** the digest the trailer must carry; a mismatch is an image of another source */
    expectedDigest?: string;
}

/**
 * the records of an image, as its lines inflate; the header is checked first, the trailer last
 * (node count, and the digest when one is expected); a corrupt, truncated or foreign image throws
 * a {@link NodesetImageError}
 */
export async function* imageNodesetRecords(
    image: Uint8Array | NodesetChunkStream,
    options: ReadNodesetImageOptions = {}
): AsyncGenerator<NodesetRecord> {
    let nodes = 0;
    let trailer: NodesetImageTrailer | undefined;
    let first = true;
    for await (const line of inflatedLines(image)) {
        if (line.length === 0) {
            continue;
        }
        if (trailer) {
            throw new NodesetImageError("an image carries nothing after its trailer");
        }
        let json: unknown;
        try {
            json = JSON.parse(line);
        } catch (err) {
            throw new NodesetImageError(`an image line is not JSON: ${(err as Error).message}`);
        }
        if (first) {
            first = false;
            const record: NodesetRecordWithBytes = decodeHeader(json as NodesetImageHeader);
            record[recordBytes] = line.length;
            yield record;
            continue;
        }
        if ((json as { kind?: string }).kind === "trailer") {
            trailer = json as NodesetImageTrailer;
            if (trailer.nodes !== nodes) {
                throw new NodesetImageError(`the image trailer announces ${trailer.nodes} nodes, ${nodes} were read`);
            }
            if (options.expectedDigest !== undefined && trailer.sourceDigest !== options.expectedDigest) {
                throw new NodesetImageError("the image was built from another source (digest mismatch)");
            }
            continue;
        }
        const record: NodesetRecordWithBytes = decodeNode(json as NodesetImageNode);
        record[recordBytes] = line.length;
        nodes += 1;
        yield record;
    }
    if (first) {
        throw new NodesetImageError("the image is empty");
    }
    if (!trailer) {
        throw new NodesetImageError("the image is truncated: no trailer");
    }
}

/** the header and the trailer of an image; the body lines are inflated but not parsed */
export async function readNodesetImageInfo(
    image: Uint8Array | NodesetChunkStream
): Promise<{ header: NodesetImageHeader; trailer: NodesetImageTrailer | null; lines: number }> {
    let header: NodesetImageHeader | undefined;
    let trailer: NodesetImageTrailer | null = null;
    let lines = 0;
    for await (const line of inflatedLines(image)) {
        if (line.length === 0) continue;
        if (!header) {
            header = JSON.parse(line) as NodesetImageHeader;
            if (header.kind !== "header") {
                throw new NodesetImageError("the first line of an image must be its header");
            }
            continue;
        }
        lines += 1;
        if (line.startsWith('{"kind":"trailer"')) {
            trailer = JSON.parse(line) as NodesetImageTrailer;
            lines -= 1;
        }
    }
    if (!header) {
        throw new NodesetImageError("the image is empty");
    }
    return { header, trailer, lines };
}
