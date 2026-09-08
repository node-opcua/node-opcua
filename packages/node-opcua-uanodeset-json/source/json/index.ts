/**
 * OPC 10000-6 Annex I: the JSON UANodeSet as one document.
 *
 * The same nodes as `.jsonl`, in the shape the schema defines: a Node's children nested inside it,
 * the roots partitioned into eight arrays by NodeClass, and an order (I.2) that lets a decoder
 * read forwards without holding the document in memory.
 *
 * Importing this module registers the format with the address-space loader.
 */

import {
    type NodesetDocument,
    type NodesetFormat,
    type NodesetHead,
    type NodesetModelInfo,
    type NodesetRecord,
    registerNodesetFormat
} from "node-opcua-address-space";
import { getMinOPCUADate } from "node-opcua-date-time";
import { flattenAnnexIDocument } from "../internal/annex_i_flatten.js";
import { recordsToAnnexIDocument } from "../internal/annex_i_from_records.js";
import { annexIHeaderRecord, annexINodeRecord } from "../internal/annex_i_to_records.js";
import type { AnnexIUANodeSet } from "../internal/annex_i_types.js";

/** the name this format is registered under */
export const ANNEX_I_JSON_FORMAT = "annex-i-json";

/**
 * whether this document is a whole Annex I UANodeSet.
 *
 * The line form and the document form both begin with a brace and both carry `Models`, so what
 * separates them is `Nodes`: I.4 says the first line of a `.jsonl` is "the UANodeSet **without**
 * the Nodes field", and a document that has one is therefore not a line form.
 *
 * The test is on the head rather than the first line because the document form is normally
 * pretty-printed, in which case its first line is a lone `{`.
 */
export function isAnnexIDocumentHead(head: NodesetHead): boolean {
    const text = head.text.trimStart();
    if (!text.startsWith("{")) {
        return false;
    }
    // "kind" and "schema" open one of the loader's own images, which is not this
    if (/"kind"\s*:\s*"header"/.test(text) && /"schema"\s*:\s*\d/.test(text)) {
        return false;
    }
    if (!/"Nodes"\s*:/.test(text)) {
        return false;
    }
    return /"(Models|SPDX|Ordered|Declarations)"\s*:/.test(text);
}

function parseDocument(text: string, name: string): AnnexIUANodeSet {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        throw new Error(`${name}: the document is not JSON: ${(err as Error).message}`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${name}: the document is not a JSON object`);
    }
    return parsed as AnnexIUANodeSet;
}

const annexIJsonFormat: NodesetFormat = {
    name: ANNEX_I_JSON_FORMAT,
    extensions: [".json", ".json.gz"],
    // above the line form, which claims a document only when it has no Nodes field
    priority: 210,
    sniff(head: NodesetHead): boolean {
        return isAnnexIDocumentHead(head);
    },
    async readModels(document: NodesetDocument): Promise<NodesetModelInfo> {
        const { record } = annexIHeaderRecord(parseDocument(await document.text(), document.name));
        return {
            namespaceUris: record.namespaceUris,
            models: record.models.map((model) => ({
                modelUri: model.modelUri,
                version: model.version,
                publicationDate: model.publicationDate ?? getMinOPCUADate(),
                requiredModel: model.requiredModels.map((required) => ({ ...required }))
            }))
        };
    },
    async *records(document: NodesetDocument): AsyncGenerator<NodesetRecord> {
        const nodeSet = parseDocument(await document.text(), document.name);
        const { record: header, namespaces } = annexIHeaderRecord(nodeSet);
        yield header;
        let index = 0;
        for (const node of flattenAnnexIDocument(nodeSet)) {
            index++;
            try {
                yield annexINodeRecord(node, namespaces);
            } catch (err) {
                throw new Error(`${document.name}: node ${index} (${node.NodeId ?? "no NodeId"}): ${(err as Error).message}`);
            }
        }
    }
};

/**
 * a stream of records as an Annex I document.
 *
 * Written with two-space indentation, which is what the reference implementation writes and what
 * every example in the repository is stored as. Nothing depends on it, but a format whose files
 * are read by people as well as programs is better off looking the same everywhere.
 */
export function recordsToAnnexIJson(records: Iterable<NodesetRecord>): string {
    return `${JSON.stringify(recordsToAnnexIDocument(records), null, 2)}\n`;
}

export { recordsToAnnexIDocument };

let registered = false;

/** make the Annex I document form readable by the loader; safe to call more than once */
export function registerAnnexIJsonFormat(): void {
    if (registered) return;
    registered = true;
    registerNodesetFormat(annexIJsonFormat);
}

registerAnnexIJsonFormat();
