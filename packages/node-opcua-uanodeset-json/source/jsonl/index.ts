/**
 * OPC 10000-6 Annex I.4: a JSON UANodeSet written one JSON object per line.
 *
 * > Each line shall be a complete JSON object written without insignificant whitespace, so that
 * > no line break falls inside it. The file shall be UTF-8 without a byte order mark, and lines
 * > shall be separated by LF, CRLF or CR. There is no limit on the length of a line.
 * > The first line is the UANodeSet without the Nodes field.
 *
 * Registering this module with the loader is what lets `generateAddressSpace` read one. Importing
 * it is enough; the registration is a side effect, the way the Node.js entry point installs its
 * zlib codecs.
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
import { annexIHeaderRecord, annexINodeRecord } from "../internal/annex_i_to_records.js";
import type { AnnexINode, AnnexIUANodeSet } from "../internal/annex_i_types.js";

/** the name this format is registered under */
export const ANNEX_I_JSONL_FORMAT = "annex-i-jsonl";

/**
 * whether this line is the header of an Annex I JSONL document.
 *
 * There is no magic number and no version field to test -- I.5 gives the root object no such
 * property -- so the test is which fields it carries. `Models` is the one every real document
 * has; `SPDX`, `Ordered` and `Declarations` are the rest of what I.4 says line one may hold.
 *
 * Deliberately narrow. The loader's own image format also begins with a brace, and a sniffer
 * that answered "some JSON, probably" would claim documents belonging to neither.
 */
export function isAnnexIHeaderLine(line: string): boolean {
    const start = line.slice(0, 400);
    if (!start.startsWith("{")) {
        return false;
    }
    if (!/"(Models|SPDX|Ordered|Declarations|HasManifest)"/.test(start)) {
        return false;
    }
    try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return false;
        }
        // an image header carries these two and is not ours
        if (parsed.kind === "header" && typeof parsed.schema === "number") {
            return false;
        }
        return (
            Array.isArray(parsed.Models) ||
            typeof parsed.SPDX === "object" ||
            typeof parsed.Ordered === "boolean" ||
            Array.isArray(parsed.Declarations) ||
            typeof parsed.HasManifest === "boolean"
        );
    } catch {
        return false;
    }
}

/** the non-empty lines of the document, with the line terminators I.4 admits */
function documentLines(lines: string[]): string[] {
    const out: string[] = [];
    for (const line of lines) {
        // the reader splits on LF; a CRLF document leaves the CR behind, and I.4 admits CR alone
        for (const part of line.split("\r")) {
            const trimmed = part.trim();
            if (trimmed.length > 0) {
                out.push(trimmed);
            }
        }
    }
    return out;
}

function parseHeaderLine(line: string, name: string): AnnexIUANodeSet {
    try {
        return JSON.parse(line) as AnnexIUANodeSet;
    } catch (err) {
        throw new Error(`${name}: the first line is not a JSON object: ${(err as Error).message}`);
    }
}

const annexIJsonlFormat: NodesetFormat = {
    name: ANNEX_I_JSONL_FORMAT,
    extensions: [".jsonl", ".jsonl.gz"],
    // above the loader's own image format, which is the only other thing that opens with a brace
    priority: 200,
    sniff(head: NodesetHead): boolean {
        return isAnnexIHeaderLine(head.firstLine);
    },
    async readModels(document: NodesetDocument): Promise<NodesetModelInfo> {
        // line one carries the models, so the dependency pre-pass never touches the body
        const lines = documentLines(await document.lines());
        if (lines.length === 0) {
            throw new Error(`${document.name}: the document is empty`);
        }
        const { record } = annexIHeaderRecord(parseHeaderLine(lines[0], document.name));
        // the header record and the dependency pre-pass describe the same models in two
        // shapes: the record nests requiredModels, the pre-pass wants requiredModel
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
        const lines = documentLines(await document.lines());
        if (lines.length === 0) {
            throw new Error(`${document.name}: the document is empty`);
        }
        const { record: header, namespaces } = annexIHeaderRecord(parseHeaderLine(lines[0], document.name));
        yield header;

        for (let index = 1; index < lines.length; index++) {
            let node: AnnexINode;
            try {
                node = JSON.parse(lines[index]) as AnnexINode;
            } catch (err) {
                throw new Error(`${document.name}: line ${index + 1} is not a JSON object: ${(err as Error).message}`);
            }
            try {
                yield annexINodeRecord(node, namespaces);
            } catch (err) {
                throw new Error(`${document.name}: line ${index + 1} (${node.NodeId ?? "no NodeId"}): ${(err as Error).message}`);
            }
        }
    }
};

let registered = false;

/** make Annex I JSONL readable by the loader; safe to call more than once */
export function registerAnnexIJsonlFormat(): void {
    if (registered) return;
    registered = true;
    registerNodesetFormat(annexIJsonlFormat);
}

registerAnnexIJsonlFormat();
