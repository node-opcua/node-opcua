/**
 * @module node-opcua-address-space
 *
 * Where a NodeSet2 document comes from. The loader does not need a file system: it reads a
 * source as a sequence of chunks, text or UTF-8 bytes, and parses them as they arrive. A source
 * may hold the XML, or a precompiled image of it (see `nodeset_image.ts`), told apart by the
 * first bytes.
 */

import { findNodesetFormat, type NodesetDocument, type NodesetHead } from "./nodeset_format.js";
import { inflatedImageLines, isGzip, isNodesetImage } from "./nodeset_image.js";

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
 * - any of the above with a `name`, used in error messages, and optionally an `imageKey`.
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
 *
 * A source may hold a precompiled image instead of the XML; it is recognized by its first
 * bytes and replayed, whether or not an image store is configured.
 */
export type NodesetSource = string | Uint8Array | NodesetChunkStream | (() => NodesetChunkStream) | NamedNodesetSource;

export interface NamedNodesetSource {
    name: string;
    source: string | Uint8Array | NodesetChunkStream | (() => NodesetChunkStream);
    /**
     * the digest under which an image store holds this document's image. A document given
     * whole (a string, bytes) is hashed by the loader; a stream is read once, so its digest is
     * only known after it has been parsed, and the store is consulted for it only when the
     * caller names the key here (the loader logs the digest it computed, for a later run).
     */
    imageKey?: string;
}

const BOM = 0xfeff;

/** how many characters of a document a format sniffer is shown */
const HEAD_CHARS = 4096;

/**
 * how a document arrived, before anything has been decided about what it says: as text, or as
 * bytes that are not text until something inflates or decodes them.
 *
 * This is not the format. It is the one thing that can be settled synchronously on a first
 * chunk, and it decides only whether the reader decodes as it goes or keeps the bytes intact.
 */
export type NodesetContainer = "text" | "bytes";

/**
 * the name of the format a source turned out to be written in.
 *
 * This used to be a closed pair, XML or image. It is now whatever is registered, so that a
 * format the loader has never heard of can identify itself; the two built-ins go on reading the
 * documents they always did.
 */
export type NodesetSourceKind = string;

export interface NodesetReaderOptions {
    /** keep the bytes read so that {@link NodesetReader.digest} can be computed */
    hash?: boolean;
    imageKey?: string;
}

/**
 * reads a source as text, once: the head first, as far as a predicate needs it, then the whole
 * document with the head included, so that a stream that cannot be reopened is never read twice
 * @internal
 */
export class NodesetReader {
    private iterator: AsyncIterator<NodesetChunk> | Iterator<NodesetChunk> | null = null;
    private exhausted = false;
    /**
     * the chunks read so far and not yet delivered to the body, in the form the document has:
     * text once decoded for XML, raw bytes for an image (the kind is fixed by the first chunk)
     */
    private head: Array<string | Uint8Array> = [];
    private bodyStarted = false;
    private decoder: TextDecoder | null = null;
    private atStart = true;
    private container: NodesetContainer | undefined;
    private formatName: NodesetSourceKind | undefined;
    private allBytesValue: Uint8Array | undefined;
    private readonly hashed: Uint8Array[] | null;
    private bytesRead = 0;
    private readonly encoder = new TextEncoder();
    private digestValue: string | undefined;

    constructor(
        public readonly name: string,
        private readonly open: () => NodesetChunkStream,
        /** true when the whole document is in memory: its digest can be computed before it is parsed */
        public readonly whole: boolean,
        private readonly options: NodesetReaderOptions = {}
    ) {
        this.hashed = options.hash ? [] : null;
    }

    /** the key a caller named for this source, if any */
    public get imageKey(): string | undefined {
        return this.options.imageKey;
    }

    /**
     * how this document arrived: as text, or as bytes. Settled on the first chunk, and never a
     * statement about which format the document is written in.
     */
    public async probeContainer(): Promise<NodesetContainer> {
        if (this.container === undefined) {
            await this.pull();
        }
        return this.container ?? "text";
    }

    /**
     * which registered format claims this document.
     *
     * Two stages, because one is not enough. The container is decided synchronously on the first
     * chunk; the format is decided from the head of the document *after* it has been inflated,
     * which is the only way to tell one gzipped serialisation from another. The loader used to
     * skip that second stage and take any gzip stream for one of its own images, so a foreign
     * compressed nodeset was not rejected but misread.
     */
    public async probe(): Promise<NodesetSourceKind> {
        if (this.formatName !== undefined) {
            return this.formatName;
        }
        const head = await this.sniffHead();
        const format = findNodesetFormat(head);
        if (!format) {
            throw new Error(`nodeset source ${this.name}: no registered format recognises this document`);
        }
        this.formatName = format.name;
        return this.formatName;
    }

    /**
     * the beginning of the document as a sniffer sees it: inflated when it arrived gzipped, so
     * that no format has to know how a document happened to be stored.
     *
     * A byte document is read whole. That is not a concession: every format that arrives as bytes
     * is line-delimited or an archive, and reads whole anyway, and the bytes are kept so the read
     * is not repeated. Text streams on, and is sniffed on as much of the head as has arrived.
     */
    private async sniffHead(): Promise<NodesetHead> {
        if ((await this.probeContainer()) === "bytes") {
            const all = await this.allBytes();
            const gzip = isGzip(all);
            const text = gzip
                ? ((await inflatedImageLines(all))[0] ?? "")
                : new TextDecoder("utf-8").decode(all.subarray(0, HEAD_CHARS));
            return makeHead(this.name, text, gzip);
        }
        while (this.headTextLength() < HEAD_CHARS) {
            if ((await this.pull()) === undefined) break;
        }
        return makeHead(this.name, (this.head as string[]).join("").slice(0, HEAD_CHARS), false);
    }

    private headTextLength(): number {
        let total = 0;
        for (const chunk of this.head as string[]) total += chunk.length;
        return total;
    }

    /**
     * read from the start until `complete(text)` holds or the source ends; what was read stays
     * in the reader and is delivered again, first, by {@link chunks}
     */
    public async readHead(complete: (text: string) => boolean): Promise<string> {
        if (this.bodyStarted) {
            throw new Error(`nodeset source ${this.name}: the head cannot be read once the body has been`);
        }
        if ((await this.probeContainer()) !== "text") {
            throw new Error(`nodeset source ${this.name}: the head of a byte document is not text`);
        }
        let text = (this.head as string[]).join("");
        while (!complete(text)) {
            const chunk = await this.pull();
            if (chunk === undefined) {
                break;
            }
            text += chunk as string;
        }
        return text;
    }

    /**
     * the whole document from the start, usable once: text chunks for a document that arrived as
     * text, byte chunks for one that did not. A caller that wants text either way decodes.
     */
    public async *chunks(): AsyncGenerator<NodesetChunk> {
        this.startBody();
        await this.probeContainer();
        const head = this.head as NodesetChunk[];
        this.head = [];
        for (const chunk of head) {
            yield chunk;
        }
        for (;;) {
            const chunk = await this.pull();
            if (chunk === undefined) {
                return;
            }
            yield chunk;
        }
    }

    /** the whole document as raw bytes, from the start, for a source holding bytes; usable once */
    public async *bytes(): AsyncGenerator<Uint8Array> {
        this.startBody();
        if ((await this.probeContainer()) !== "bytes") {
            throw new Error(`nodeset source ${this.name}: not a byte document`);
        }
        const head = this.head as Uint8Array[];
        this.head = [];
        for (const chunk of head) {
            yield chunk;
        }
        for (;;) {
            const chunk = await this.pull();
            if (chunk === undefined) {
                return;
            }
            yield chunk as Uint8Array;
        }
    }

    /** the whole document as one byte array; reads the source to its end and keeps it */
    public async allBytes(): Promise<Uint8Array> {
        if (this.allBytesValue !== undefined) {
            return this.allBytesValue;
        }
        if (this.bodyStarted) {
            throw new Error(`nodeset source ${this.name}: a source is read once`);
        }
        while ((await this.pull()) !== undefined) {
            /* read to the end */
        }
        const parts = this.head.map((chunk) => (typeof chunk === "string" ? this.encoder.encode(chunk) : chunk));
        // kept, so that the sniff and the format that follows it share one array: the inflated
        // lines are cached against the identity of these bytes, and a second concat would miss
        this.allBytesValue = concat(parts);
        return this.allBytesValue;
    }

    /** the bytes read so far; the whole document once it has been read */
    public get length(): number {
        return this.bytesRead;
    }

    /**
     * the SHA-256 of the bytes of the document, hex; available at any time for a document given
     * whole, once the body has been read to its end otherwise
     */
    public async digest(): Promise<string> {
        if (this.digestValue !== undefined) {
            return this.digestValue;
        }
        if (!this.hashed) {
            throw new Error(`nodeset source ${this.name}: the reader was not asked to hash`);
        }
        if (this.whole) {
            while ((await this.pull()) !== undefined) {
                /* a whole document is one chunk; read it */
            }
        } else if (!this.exhausted) {
            throw new Error(`nodeset source ${this.name}: the digest of a stream is known once it has been read to its end`);
        }
        const bytes = concat(this.hashed);
        this.hashed.length = 0;
        this.digestValue = await sha256Hex(bytes);
        return this.digestValue;
    }

    /**
     * the digest if it has already been computed, without computing one.
     *
     * A format may want to record what it read from, but must never be the thing that forces a
     * stream to be drained to find out.
     */
    public digestIfKnown(): string | undefined {
        return this.digestValue;
    }

    private startBody(): void {
        if (this.bodyStarted) {
            throw new Error(`nodeset source ${this.name}: a source is read once`);
        }
        this.bodyStarted = true;
    }

    /** the next non-empty chunk, kept in the head until the body starts; undefined at the end */
    private async pull(): Promise<string | Uint8Array | undefined> {
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
                    if (this.container === undefined) {
                        this.container = "text";
                    }
                    const tail = this.decoder ? this.decoder.decode() : "";
                    if (tail.length > 0) {
                        if (!this.bodyStarted) this.head.push(tail);
                        return tail;
                    }
                    return undefined;
                }
                const chunk = this.accept(result.value);
                if (chunk !== undefined) {
                    return chunk;
                }
            }
        } catch (err) {
            this.exhausted = true;
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`nodeset source ${this.name}: ${message}`, { cause: err });
        }
    }

    /** classify on the first chunk, hash, decode; returns the chunk in the form the document has, or undefined when empty */
    private accept(chunk: NodesetChunk): string | Uint8Array | undefined {
        if (typeof chunk !== "string" && !(chunk instanceof Uint8Array)) {
            throw new Error(`a chunk must be a string or a Uint8Array, got ${typeof chunk}`);
        }
        if (chunk.length === 0) {
            return undefined;
        }
        if (this.container === undefined) {
            // text unless the bytes say otherwise; a string chunk is text by construction
            this.container = typeof chunk !== "string" && isNodesetImage(chunk) ? "bytes" : "text";
        }
        const raw = typeof chunk === "string" ? this.encoder.encode(chunk) : chunk;
        this.bytesRead += raw.length;
        if (this.hashed) {
            this.hashed.push(raw);
        }
        if (this.container === "bytes") {
            const bytes = typeof chunk === "string" ? raw : chunk;
            if (!this.bodyStarted) this.head.push(bytes);
            return bytes;
        }
        let text: string;
        if (typeof chunk === "string") {
            text = chunk;
        } else {
            // a streaming decoder: a multi-byte character or the byte-order mark may straddle two chunks
            this.decoder = this.decoder || new TextDecoder("utf-8");
            text = this.decoder.decode(chunk, { stream: true });
        }
        if (this.atStart && text.length > 0) {
            this.atStart = false;
            if (text.charCodeAt(0) === BOM) {
                text = text.slice(1);
            }
        }
        if (text.length === 0) {
            return undefined;
        }
        if (!this.bodyStarted) this.head.push(text);
        return text;
    }
}

/** the SHA-256 of `bytes`, lower-case hex: the digest a nodeset image carries for its source */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function concat(parts: Uint8Array[]): Uint8Array {
    if (parts.length === 1) {
        return parts[0];
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function kindOf(source: NamedNodesetSource["source"]): string {
    if (typeof source === "string") return "text";
    if (source instanceof Uint8Array) return "bytes";
    return "stream";
}

/**
 * a reader over a source; `index` names an anonymous source in error messages
 * @internal
 */
export function openNodesetSource(
    source: NodesetSource,
    index: number,
    options: { hash?: boolean; whole?: boolean } = {}
): NodesetReader {
    let name: string;
    let inner: NamedNodesetSource["source"];
    let imageKey: string | undefined;
    if (
        typeof source === "object" &&
        source !== null &&
        !(source instanceof Uint8Array) &&
        "source" in source &&
        "name" in source
    ) {
        name = source.name;
        inner = source.source;
        imageKey = source.imageKey;
    } else {
        inner = source as NamedNodesetSource["source"];
        name = `#${index + 1} (${kindOf(inner)})`;
    }
    const whole = options.whole ?? (typeof inner === "string" || inner instanceof Uint8Array);
    const open = (): NodesetChunkStream => {
        if (typeof inner === "string" || inner instanceof Uint8Array) {
            return [inner];
        }
        if (typeof inner === "function") {
            return inner();
        }
        return inner;
    };
    return new NodesetReader(name, open, whole, { hash: options.hash, imageKey });
}

/** the head a sniffer is shown, with its first line split out for the line-delimited formats */
function makeHead(name: string, text: string, gzip: boolean): NodesetHead {
    const newline = text.indexOf("\n");
    const firstLine = newline < 0 ? text : text.slice(0, newline);
    return { name, text, gzip, firstLine: firstLine.endsWith("\r") ? firstLine.slice(0, -1) : firstLine };
}

/**
 * a {@link NodesetDocument} over a reader: what a format is handed.
 *
 * The point of the facade is that a format never touches the reader. It asks for the document in
 * the shape it wants -- lines, text, bytes, a stream -- and the reader answers each of those once
 * and shares the answer, so a format that wants both the lines and the raw bytes pays for one
 * read and one inflate rather than two.
 *
 * @internal
 */
export function nodesetDocumentOf(reader: NodesetReader): NodesetDocument {
    let inflatedBytes: Promise<Uint8Array> | undefined;
    let textValue: Promise<string> | undefined;
    let linesValue: Promise<string[]> | undefined;

    const rawBytes = () => reader.allBytes();

    const bytes = () => {
        if (!inflatedBytes) {
            inflatedBytes = (async () => {
                const raw = await rawBytes();
                if (!isGzip(raw)) return raw;
                // one inflate, shared with lines(): both go through the cache keyed on these bytes
                return new TextEncoder().encode((await inflatedImageLines(raw)).join("\n"));
            })();
        }
        return inflatedBytes;
    };

    const lines = () => {
        if (!linesValue) {
            linesValue = (async () => {
                const raw = await rawBytes();
                if (isGzip(raw)) return await inflatedImageLines(raw);
                return new TextDecoder("utf-8").decode(raw).split("\n");
            })();
        }
        return linesValue;
    };

    const text = () => {
        if (!textValue) {
            textValue = (async () => (await lines()).join("\n"))();
        }
        return textValue;
    };

    return {
        name: reader.name,
        bytes,
        text,
        lines,
        rawBytes,
        chunks: () => reader.chunks(),
        readHead: (complete: (t: string) => boolean) => reader.readHead(complete),
        digest: () => reader.digestIfKnown()
    };
}
