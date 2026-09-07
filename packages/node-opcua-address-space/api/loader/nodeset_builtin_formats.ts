/**
 * @module node-opcua-address-space
 *
 * The two serialisations the loader has always read, expressed as {@link NodesetFormat}s.
 *
 * Registering them here rather than branching on a boolean inside the loader is the whole point
 * of the registry: the built-ins get no privilege a third-party format does not also get, so the
 * contract cannot quietly grow a dependency on something only the built-ins can reach. If these
 * two can be written against it, so can a fourth.
 *
 * Importing this module registers them. The loader does that once, at its own import.
 */

import { getMinOPCUADate } from "node-opcua-date-time";
import type { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options.js";
import {
    type NodesetDocument,
    type NodesetFormat,
    type NodesetHead,
    type NodesetModel,
    type NodesetModelInfo,
    registerNodesetFormat
} from "./nodeset_format.js";
import { imageLinesToRecords, readNodesetImageInfo } from "./nodeset_image.js";
import type { NodesetRecord } from "./nodeset_record.js";
import { headerComplete, parseDependencies, sliceHeader } from "./nodeset_xml_header.js";
import { xmlNodesetRecords } from "./nodeset_xml_producer.js";

/** the name the NodeSet2 XML format is registered under */
export const NODESET2_XML_FORMAT = "nodeset2-xml";
/** the name the NDJSON image format is registered under */
export const NDJSON_IMAGE_FORMAT = "ndjson";

/**
 * NodeSet2 XML: the fallback.
 *
 * It claims every document no other format recognised, which is exactly what the loader did
 * before there was a registry, and it is the right default for a reason that outlives this
 * refactor: XML has no compact magic number worth sniffing. A document may open with a byte-order
 * mark, an XML declaration, a comment, a doctype or whitespace before `<UANodeSet` ever appears,
 * and a sniffer strict enough to be sure would reject documents the loader reads today. So it
 * does not guess. It takes what is left, and reports a real parse error if it was wrong, which is
 * a better diagnostic than "unrecognised format" ever was.
 */
const nodeset2XmlFormat: NodesetFormat = {
    name: NODESET2_XML_FORMAT,
    extensions: [".xml"],
    priority: -100,
    sniff(_head: NodesetHead): boolean {
        return true;
    },
    async readModels(document: NodesetDocument): Promise<NodesetModelInfo> {
        const head = await document.readHead(headerComplete);
        return await parseDependencies(sliceHeader(head, document.name));
    },
    records(document: NodesetDocument, _options?: NodeSetLoaderOptions): AsyncIterable<NodesetRecord> {
        return xmlNodesetRecords(textChunks(document));
    }
};

/** the chunks of a document as text: the XML producer takes text, and a source may deliver bytes */
async function* textChunks(document: NodesetDocument): AsyncGenerator<string> {
    const decoder = new TextDecoder("utf-8");
    for await (const chunk of document.chunks()) {
        yield typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    }
}

/**
 * The NDJSON image: node-opcua's own cache of a document it has already parsed.
 *
 * Its first line is a header record, so it is told from every other line-delimited nodeset format
 * by the two fields that open it: `{"kind":"header","schema":<n>`. That is a stronger test than
 * "begins with a brace", which is all the loader used to do, and it is what lets a foreign
 * `.jsonl` sit in the same directory without being mistaken for one of ours.
 */
const ndjsonImageFormat: NodesetFormat = {
    name: NDJSON_IMAGE_FORMAT,
    extensions: [".ndjson", ".ndjson.gz"],
    priority: 100,
    sniff(head: NodesetHead): boolean {
        return isNdjsonHeaderLine(head.firstLine);
    },
    async readModels(document: NodesetDocument): Promise<NodesetModelInfo> {
        // an image is small, a few hundred KB, and its header is line 1: reading it whole costs
        // nothing that the load itself was not about to spend
        const { header } = await readNodesetImageInfo(await document.rawBytes());
        const models: NodesetModel[] = header.models.map((m) => ({
            modelUri: m.modelUri,
            version: m.version,
            publicationDate: m.publicationDate ? new Date(m.publicationDate) : getMinOPCUADate(),
            requiredModel: m.requiredModels.map((r) => ({
                ...r,
                publicationDate: new Date(r.publicationDate ?? Number.NaN)
            }))
        }));
        if (models.length === 0 && header.namespaceUris.length >= 1) {
            models.push({
                modelUri: header.namespaceUris[0],
                version: "1",
                publicationDate: getMinOPCUADate(),
                requiredModel: []
            });
        }
        return { models, namespaceUris: header.namespaceUris };
    },
    async *records(document: NodesetDocument, _options?: NodeSetLoaderOptions): AsyncGenerator<NodesetRecord> {
        yield* imageLinesToRecords(await document.lines());
    }
};

/**
 * whether this line is the header record of an NDJSON image.
 *
 * Deliberately a string test before it is a parse: the discriminating fields are written first
 * and the line can be hundreds of kilobytes, so there is no reason to build an object to answer
 * a question the first thirty characters already settle. The parse is the confirmation, not the
 * test, and it is only reached for a line that already looks like ours.
 */
export function isNdjsonHeaderLine(line: string): boolean {
    const start = line.slice(0, 200);
    if (!start.startsWith("{") || !start.includes('"kind"') || !start.includes('"header"')) {
        return false;
    }
    try {
        const parsed = JSON.parse(line) as { kind?: unknown; schema?: unknown };
        return parsed?.kind === "header" && typeof parsed.schema === "number";
    } catch {
        return false;
    }
}

let registered = false;

/** register the built-in formats; called by the loader, and safe to call more than once */
export function registerBuiltinNodesetFormats(): void {
    if (registered) return;
    registered = true;
    registerNodesetFormat(nodeset2XmlFormat);
    registerNodesetFormat(ndjsonImageFormat);
}

registerBuiltinNodesetFormats();
