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
    type JsonNodeId,
    NodesetImageError,
    type NodesetImageHeader,
    type NodesetImageNode,
    type NodesetImageTrailer
} from "./nodeset_image_codec.js";
import {
    NODESET_RECORD_SCHEMA,
    type NodesetHeaderRecord,
    type NodesetRecord,
    type NodesetRecordConsumer,
    type NodesetRecordWithBytes,
    recordBytes
} from "./nodeset_record.js";
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

/**
 * the lines of an image given whole, inflated once and kept for the load: the sibling check, the
 * header pre-pass and the replay all read the same buffer, and one inflate with a native split is
 * half the cost of the streaming reader on a 3.5 MB text. The replay releases them (see
 * {@link releaseInflatedImageLines}): the bytes may live on in an image store, which is sized by
 * what it holds compressed, and the lines are twelve times as large
 */
const imageLines = new WeakMap<Uint8Array, Promise<string[]>>();

/** forget the inflated lines of `image`; the next reader inflates again */
export function releaseInflatedImageLines(image: Uint8Array): void {
    imageLines.delete(image);
}

/** whether the inflated lines of `image` are being kept, for the tests */
export function hasInflatedImageLines(image: Uint8Array): boolean {
    return imageLines.has(image);
}
const NEWLINE = String.fromCharCode(10);

export function inflatedImageLines(image: Uint8Array): Promise<string[]> {
    let lines = imageLines.get(image);
    if (!lines) {
        lines = (async () => {
            let text: string;
            try {
                const inflated = new Blob([image as BlobPart])
                    .stream()
                    .pipeThrough(new DecompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
                text = new TextDecoder("utf-8").decode(await new Response(inflated).arrayBuffer());
            } catch (err) {
                throw new NodesetImageError(`the image cannot be inflated: ${(err as Error).message}`);
            }
            return text.split(NEWLINE);
        })();
        imageLines.set(image, lines);
        // a failed inflate is not worth remembering
        lines.catch(() => imageLines.delete(image));
    }
    return lines;
}

/** the lines of a gzip-compressed text, as they inflate */
async function* inflatedLines(source: Uint8Array | NodesetChunkStream): AsyncGenerator<string> {
    if (source instanceof Uint8Array) {
        yield* await inflatedImageLines(source);
        return;
    }
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
    private readonly nodeLines: NodesetImageNode[] = [];
    private lines: string[] | undefined;
    private header: NodesetHeaderRecord | undefined;

    constructor(private readonly options: NodesetImageWriterOptions = {}) {}

    public apply(record: NodesetRecord): void {
        if (record.kind === "header") {
            if (this.header) {
                throw new NodesetImageError("an image holds one document: a second header record was applied");
            }
            this.header = record;
            return;
        }
        if (!this.header) {
            throw new NodesetImageError("a node record was applied before the header record");
        }
        this.nodeLines.push(encodeNode(record));
        this.lines = undefined;
    }

    /**
     * the node lines, each reference marked when the target's record in this document does not
     * declare the inverse (see NodesetReferenceRecord.inverseDeclared): decided here, over the
     * whole document, whatever the producer knew
     */
    private encodedLines(): string[] {
        if (this.lines) {
            return this.lines;
        }
        const idKey = (id: JsonNodeId): string => (typeof id === "number" ? String(id) : id.join(","));
        const declared = new Set<string>();
        for (const node of this.nodeLines) {
            const source = idKey(node.nodeId);
            for (const r of node.references) {
                declared.add(`${source}|${r[0]}|${idKey(r[1])}|${idKey(r[2])}`);
            }
        }
        for (const node of this.nodeLines) {
            const source = idKey(node.nodeId);
            for (const r of node.references) {
                r.length = 3;
                if (!declared.has(`${idKey(r[2])}|${1 - r[0]}|${idKey(r[1])}|${source}`)) {
                    (r as unknown[]).push(0);
                }
            }
        }
        this.lines = this.nodeLines.map((node) => JSON.stringify(node));
        return this.lines;
    }

    /**
     * the uncompressed lines, header first, trailer last; the header is encoded here because the
     * length of the source is only known once every chunk went through
     */
    public text(sourceDigest: string, sourceLength?: number): string {
        if (!this.header) {
            throw new NodesetImageError("no document was applied to this writer");
        }
        const options = sourceLength === undefined ? this.options : { ...this.options, sourceLength };
        const header = JSON.stringify(encodeHeader(this.header, options));
        const trailer: NodesetImageTrailer = { kind: "trailer", nodes: this.nodeLines.length, sourceDigest };
        return `${header}\n${this.encodedLines().join("\n")}\n${JSON.stringify(trailer)}\n`;
    }

    /** the node lines alone, what an exported namespace's digest covers (the header carries a timestamp) */
    public bodyText(): string {
        return `${this.encodedLines().join("\n")}\n`;
    }

    /** the image: the lines, gzip-compressed */
    public async finish(sourceDigest: string, sourceLength?: number): Promise<Uint8Array> {
        return gzip(this.text(sourceDigest, sourceLength));
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
    if (image instanceof Uint8Array) {
        try {
            yield* imageLinesToRecords(await inflatedImageLines(image), options);
        } finally {
            releaseInflatedImageLines(image);
        }
        return;
    }
    const reader = new ImageLineReader(options);
    for await (const line of inflatedLines(image)) {
        const record = reader.read(line);
        if (record) {
            yield record;
        }
    }
    reader.end();
}

/** one image line to a record, the trailer checked when it comes; shared by the two iterators */
class ImageLineReader {
    private nodes = 0;
    private trailer: NodesetImageTrailer | undefined;
    private first = true;

    constructor(private readonly options: ReadNodesetImageOptions) {}

    /** the record of a line, or undefined for a blank line or the trailer */
    public read(line: string): NodesetRecord | undefined {
        if (line.length === 0) {
            return undefined;
        }
        if (this.trailer) {
            throw new NodesetImageError("an image carries nothing after its trailer");
        }
        let json: unknown;
        try {
            json = JSON.parse(line);
        } catch (err) {
            throw new NodesetImageError(`an image line is not JSON: ${(err as Error).message}`);
        }
        if (this.first) {
            this.first = false;
            const record: NodesetRecordWithBytes = decodeHeader(json as NodesetImageHeader);
            record[recordBytes] = line.length;
            return record;
        }
        if ((json as { kind?: string }).kind === "trailer") {
            const trailer = json as NodesetImageTrailer;
            if (trailer.nodes !== this.nodes) {
                throw new NodesetImageError(`the image trailer announces ${trailer.nodes} nodes, ${this.nodes} were read`);
            }
            if (this.options.expectedDigest !== undefined && trailer.sourceDigest !== this.options.expectedDigest) {
                throw new NodesetImageError("the image was built from another source (digest mismatch)");
            }
            this.trailer = trailer;
            return undefined;
        }
        const record: NodesetRecordWithBytes = decodeNode(json as NodesetImageNode);
        record[recordBytes] = line.length;
        this.nodes += 1;
        return record;
    }

    public end(): void {
        if (this.first) {
            throw new NodesetImageError("the image is empty");
        }
        if (!this.trailer) {
            throw new NodesetImageError("the image is truncated: no trailer");
        }
    }
}

/**
 * the records of an image given whole, as a synchronous iterator: what the loader consumes
 * without a turn of the microtask queue per record. The lines come from {@link inflatedImageLines}.
 */
export function* imageLinesToRecords(lines: string[], options: ReadNodesetImageOptions = {}): Generator<NodesetRecord> {
    const reader = new ImageLineReader(options);
    for (const line of lines) {
        const record = reader.read(line);
        if (record) {
            yield record;
        }
    }
    reader.end();
}

/**
 * what disqualifies an image from being replayed by this loader, or null: the one verdict the
 * store path, the sibling path and the catalog check share. `expectedDigest` is the SHA-256 of
 * the source the image must have been built from, when the caller knows it
 */
export function nodesetImageProblem(
    info: { header: NodesetImageHeader; trailer: NodesetImageTrailer | null; lines: number },
    expectedDigest?: string
): string | null {
    if (info.header.schema !== NODESET_RECORD_SCHEMA) {
        return `the image is of schema ${info.header.schema}, this loader reads ${NODESET_RECORD_SCHEMA}`;
    }
    if (!info.trailer) {
        return "the image is truncated: no trailer";
    }
    if (info.trailer.nodes !== info.lines) {
        return `the image trailer announces ${info.trailer.nodes} nodes, ${info.lines} lines were read`;
    }
    if (expectedDigest !== undefined && info.trailer.sourceDigest !== expectedDigest) {
        return "the image was built from another source (digest mismatch)";
    }
    return null;
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
