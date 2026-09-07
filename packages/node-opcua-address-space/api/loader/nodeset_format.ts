/**
 * @module node-opcua-address-space
 *
 * Which serialisation a nodeset document is written in, and who can read it.
 *
 * The loader is built as `producer -> NodesetRecord -> consumer`: whatever a document is written
 * in, it becomes a stream of records, and everything downstream of that -- the address space, the
 * NodeSet2 XML writer, the image writer -- neither knows nor asks. What was missing is the other
 * half of that seam. The *choice* of producer was a hard-coded pair, XML or image, decided on one
 * byte, so a third serialisation had no way in short of editing the loader.
 *
 * A {@link NodesetFormat} is that way in. It answers three questions and nothing else: are these
 * bytes mine, what does this document depend on, and what are its records. Formats are found by
 * sniffing the document, never by its file name: an extension is a claim about a file, and the
 * loader reads sources that are not files at all.
 *
 * Two formats are built in and registered by the loader itself, so the default behaviour is
 * exactly what it always was: NodeSet2 XML, and the NDJSON image. Anything else is registered by
 * the code that implements it, the way the Node.js entry point installs its zlib codecs.
 */

import type { RequiredModel } from "node-opcua-address-space-base";
import type { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options.js";
import type { NodesetRecord } from "./nodeset_record.js";
import type { NodesetChunk } from "./nodeset_source.js";

/** a model a document defines, together with the models it says it needs */
export interface NodesetModel extends RequiredModel {
    requiredModel: RequiredModel[];
}

/**
 * what a document says about itself before its body is read: enough, and only enough, to sort a
 * set of documents into the order they have to be loaded in.
 */
export interface NodesetModelInfo {
    namespaceUris: string[];
    models: NodesetModel[];
}

/**
 * the beginning of a document, for {@link NodesetFormat.sniff}.
 *
 * `text` is inflated when the document arrived gzipped, so a sniffer never has to care whether it
 * is looking at a compressed file: compression is a property of how a document was stored, never
 * of what it says. It is decoded as UTF-8, which is lossless for the text formats and, for a
 * binary container, faithful across the ASCII and NUL runs that container formats put their magic
 * in (a tar header, for instance, is ASCII and NUL for its whole first block).
 */
export interface NodesetHead {
    /** the first bytes of the document, decoded as UTF-8, inflated if the document was gzipped */
    readonly text: string;
    /** `text` up to the first line feed: what the line-delimited formats decide on */
    readonly firstLine: string;
    /** whether the document was gzip on the wire */
    readonly gzip: boolean;
    /** the source's name, for diagnostics only; never a basis for the decision */
    readonly name: string;
}

/**
 * a document handed to a format, in whichever shape that format finds convenient. Every accessor
 * inflates first when the document was gzipped, and the results are computed once and shared, so
 * a format that asks for both the lines and the bytes pays for one inflate.
 */
export interface NodesetDocument {
    readonly name: string;
    /** the whole document, inflated */
    bytes(): Promise<Uint8Array>;
    /** the whole document as text, inflated and decoded */
    text(): Promise<string>;
    /** the document's lines, for the line-delimited formats */
    lines(): Promise<string[]>;
    /** the bytes exactly as they arrived, still compressed if they were */
    rawBytes(): Promise<Uint8Array>;
    /** the document as it arrives, for a format that parses incrementally rather than whole */
    chunks(): AsyncIterable<NodesetChunk>;
    /**
     * read from the start until `complete(text)` holds, or the document ends. What was read stays
     * in the document and is delivered again, first, by {@link NodesetDocument.chunks}, so a
     * format that reads a header this way has not spent the source.
     *
     * This is how a format avoids reading a body it does not need: the XML header pre-pass stops
     * after a few hundred bytes of a four megabyte file.
     */
    readHead(complete: (text: string) => boolean): Promise<string>;
    /** the SHA-256 of the bytes as they arrived, when the loader was asked to compute one */
    digest(): string | undefined;
}

/** a serialisation the loader can read */
export interface NodesetFormat {
    /** how this format is named in diagnostics and in the tools; unique among registered formats */
    readonly name: string;
    /**
     * the file extensions this format is usually written with, lowercase and dotted.
     * Documentation and tooling only: the loader never decides on a name.
     */
    readonly extensions?: readonly string[];
    /**
     * which format wins when more than one claims a document. Higher is stronger; the default is
     * 0. NodeSet2 XML registers at -100 because it is the fallback: it claims anything no other
     * format recognised, which is the behaviour the loader has always had.
     */
    readonly priority?: number;
    /** whether this format claims the document that begins like this */
    sniff(head: NodesetHead): boolean;
    /** what the document depends on, read without parsing its body */
    readModels(document: NodesetDocument): Promise<NodesetModelInfo>;
    /** the document's records, in document order */
    records(document: NodesetDocument, options?: NodeSetLoaderOptions): AsyncIterable<NodesetRecord>;
}

const formats = new Map<string, NodesetFormat>();

/**
 * make a format available to the loader. Returns a function that removes it again, which is what
 * a test uses to put the registry back as it found it; production code registers once, at import.
 *
 * Registering a name twice replaces the earlier format, so a caller can override a built-in.
 */
export function registerNodesetFormat(format: NodesetFormat): () => void {
    formats.set(format.name, format);
    return () => {
        if (formats.get(format.name) === format) {
            formats.delete(format.name);
        }
    };
}

/** every registered format, strongest claim first */
export function nodesetFormats(): readonly NodesetFormat[] {
    return [...formats.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/** the registered format of that name, if any */
export function nodesetFormatByName(name: string): NodesetFormat | undefined {
    return formats.get(name);
}

/**
 * which format claims a document that begins like this, or `undefined` when none does. Formats
 * are asked strongest first, so a specific format is always given the chance to claim a document
 * before the XML fallback sees it.
 */
export function findNodesetFormat(head: NodesetHead): NodesetFormat | undefined {
    for (const format of nodesetFormats()) {
        if (format.sniff(head)) {
            return format;
        }
    }
    return undefined;
}
