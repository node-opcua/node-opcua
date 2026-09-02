/**
 * @module node-opcua-address-space
 *
 * Where a NodeSet2 document comes from. The loader does not need a file system: it reads a
 * source as a sequence of chunks, text or UTF-8 bytes, and parses them as they arrive.
 */

/** one piece of a NodeSet2 document: text, or UTF-8 bytes */
export type NodesetChunk = string | Uint8Array;

/** a document delivered in pieces: an async iterable (a Node.js Readable, a web ReadableStream, an async generator) or a plain iterable */
export type NodesetChunkStream = AsyncIterable<NodesetChunk> | Iterable<NodesetChunk>;

/**
 * a NodeSet2 document, as one of:
 *
 * - the whole document as a string or as UTF-8 bytes;
 * - a stream of chunks; it is read once, from the start, so a stream that has already been
 *   partly consumed cannot be used;
 * - a function opening such a stream, called once when the loader gets to it, so that a
 *   list of files does not hold every descriptor open from the start;
 * - any of the above with a `name`, used in error messages.
 *
 * A byte-order mark at the start is dropped; a multi-byte character may straddle two chunks.
 * Decompression is the caller's business and needs no library support:
 *
 * ```ts
 * // Node.js
 * { name: file, source: () => fs.createReadStream(file).pipe(zlib.createGunzip()) }
 * // browser
 * { name: url, source: async function* () { yield* (await fetch(url)).body!.pipeThrough(new DecompressionStream("gzip")); } }
 * ```
 *
 * An array given to `generateAddressSpaceRaw` is always a list of documents; chunks of one
 * document held in an array go through the named form: `{ name, source: chunks }`.
 */
export type NodesetSource = string | Uint8Array | NodesetChunkStream | (() => NodesetChunkStream) | NamedNodesetSource;

export interface NamedNodesetSource {
    name: string;
    source: string | Uint8Array | NodesetChunkStream | (() => NodesetChunkStream);
}

const BOM = 0xfeff;

/**
 * reads a source as text, once: the head first, as far as a predicate needs it, then the whole
 * document with the head included, so that a stream that cannot be reopened is never read twice
 * @internal
 */
export class NodesetReader {
    private iterator: AsyncIterator<NodesetChunk> | Iterator<NodesetChunk> | null = null;
    private exhausted = false;
    private head: string[] = [];
    private bodyStarted = false;
    private decoder: TextDecoder | null = null;
    private atStart = true;

    constructor(
        public readonly name: string,
        private readonly open: () => NodesetChunkStream
    ) {}

    /**
     * read from the start until `complete(text)` holds or the source ends; what was read stays
     * in the reader and is delivered again, first, by {@link chunks}
     */
    public async readHead(complete: (text: string) => boolean): Promise<string> {
        if (this.bodyStarted) {
            throw new Error(`nodeset source ${this.name}: the head cannot be read once the body has been`);
        }
        let text = this.head.join("");
        while (!complete(text)) {
            const chunk = await this.next();
            if (chunk === undefined) {
                break;
            }
            this.head.push(chunk);
            text += chunk;
        }
        return text;
    }

    /** the whole document as text chunks, from the start; usable once */
    public async *chunks(): AsyncGenerator<string> {
        if (this.bodyStarted) {
            throw new Error(`nodeset source ${this.name}: a source is read once`);
        }
        this.bodyStarted = true;
        const head = this.head;
        this.head = [];
        for (const chunk of head) {
            yield chunk;
        }
        for (;;) {
            const chunk = await this.next();
            if (chunk === undefined) {
                return;
            }
            yield chunk;
        }
    }

    /** the next non-empty text chunk, or undefined at the end of the source */
    private async next(): Promise<string | undefined> {
        if (this.exhausted) {
            return undefined;
        }
        try {
            if (!this.iterator) {
                const stream = this.open();
                const asyncIterator = (stream as AsyncIterable<NodesetChunk>)[Symbol.asyncIterator];
                this.iterator = asyncIterator ? asyncIterator.call(stream) : (stream as Iterable<NodesetChunk>)[Symbol.iterator]();
            }
            for (;;) {
                const result = await this.iterator.next();
                if (result.done) {
                    this.exhausted = true;
                    const tail = this.decoder ? this.decoder.decode() : "";
                    return tail.length > 0 ? tail : undefined;
                }
                const text = this.decode(result.value);
                if (text.length > 0) {
                    return text;
                }
            }
        } catch (err) {
            this.exhausted = true;
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`nodeset source ${this.name}: ${message}`, { cause: err });
        }
    }

    private decode(chunk: NodesetChunk): string {
        let text: string;
        if (typeof chunk === "string") {
            text = chunk;
        } else if (chunk instanceof Uint8Array) {
            // a streaming decoder: a multi-byte character or the byte-order mark may straddle two chunks
            this.decoder = this.decoder || new TextDecoder("utf-8");
            text = this.decoder.decode(chunk, { stream: true });
        } else {
            throw new Error(`a chunk must be a string or a Uint8Array, got ${typeof chunk}`);
        }
        if (this.atStart && text.length > 0) {
            this.atStart = false;
            if (text.charCodeAt(0) === BOM) {
                text = text.slice(1);
            }
        }
        return text;
    }
}

function kindOf(source: NamedNodesetSource["source"]): string {
    if (typeof source === "string") return "text";
    if (source instanceof Uint8Array) return "bytes";
    if (typeof source === "function") return "stream";
    return "stream";
}

/**
 * a reader over a source; `index` names an anonymous source in error messages
 * @internal
 */
export function openNodesetSource(source: NodesetSource, index: number): NodesetReader {
    let name: string;
    let inner: NamedNodesetSource["source"];
    if (
        typeof source === "object" &&
        source !== null &&
        !(source instanceof Uint8Array) &&
        "source" in source &&
        "name" in source
    ) {
        name = source.name;
        inner = source.source;
    } else {
        inner = source as NamedNodesetSource["source"];
        name = `#${index + 1} (${kindOf(inner)})`;
    }
    const open = (): NodesetChunkStream => {
        if (typeof inner === "string" || inner instanceof Uint8Array) {
            return [inner];
        }
        if (typeof inner === "function") {
            return inner();
        }
        return inner;
    };
    return new NodesetReader(name, open);
}
