/**
 * OPC 10000-6 Annex I.3: a JSON UANodeSet split across several files in a TAR.GZ archive.
 *
 * > A UANodeSet that is too large to be stored efficiently in a single JSON file may be split
 * > across multiple JSON files in a TAR.GZ archive with the a '.uanodeset' file extension.
 * > Each archive has a manifest which specifies the order of the files in the archive. [...] The
 * > name of the manifest file shall be 'manifest.json'.
 *
 * The manifest carries what the members do not: the `Models`, and the `Declarations` that resolve
 * recursion. Each member is otherwise the document form, so once the archive is opened there is
 * nothing new to read.
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
import {
    ANNEX_I_CONTAINER_ORDER,
    type AnnexINode,
    type AnnexINodeContainer,
    type AnnexIUANodeSet
} from "../internal/annex_i_types.js";
import { isTar, readTar, type TarEntry, writeTar } from "../internal/tar.js";

/** the name this format is registered under */
export const ANNEX_I_ARCHIVE_FORMAT = "annex-i-uanodeset";

/** I.3: "The name of the manifest file shall be 'manifest.json'." */
export const MANIFEST_NAME = "manifest.json";

/** what the reference implementation names its members, and what this writes */
const MEMBER_NAME = (index: number) => `UANodeSet_${String(index).padStart(3, "0")}.json`;

/** I.3 gives no figure; this is what the reference implementation defaults to */
export const DEFAULT_NODES_PER_FILE = 1000;

/** the manifest of an archive, Table I.1 */
interface AnnexIManifest {
    Ordered?: boolean;
    Models?: AnnexIUANodeSet["Models"];
    Declarations?: AnnexINode[];
    Files?: string[];
}

/**
 * whether these bytes are an archive.
 *
 * The head a sniffer is shown is already inflated, so what is left to recognise is the tar, and
 * a tar is recognised by its header checksum rather than by a magic string: the original V7
 * layout leaves the magic empty, and that is what the reference implementation writes.
 */
export function isAnnexIArchiveHead(head: NodesetHead): boolean {
    if (!head.gzip) {
        // a bare tar is not a .uanodeset: I.3 says TAR.GZ
        return false;
    }
    const bytes = new Uint8Array(head.text.length);
    for (let i = 0; i < head.text.length; i++) {
        const code = head.text.charCodeAt(i);
        if (code > 0xff) {
            // a tar header is ASCII and NUL; anything else means this is not one
            return false;
        }
        bytes[i] = code;
    }
    return isTar(bytes);
}

function parseJson<T>(entry: TarEntry, name: string): T {
    try {
        return JSON.parse(new TextDecoder("utf-8").decode(entry.data)) as T;
    } catch (err) {
        throw new Error(`${name}: ${entry.name} is not JSON: ${(err as Error).message}`);
    }
}

/**
 * the manifest and the member documents, in the order the manifest gives.
 *
 * I.3 is strict about this in one direction only: "Any file in the archive that is not referenced
 * in the manifest is an error." A file the manifest names and the archive lacks is equally an
 * error, since it would silently drop nodes.
 */
function openArchive(bytes: Uint8Array, name: string): { manifest: AnnexIManifest; members: TarEntry[] } {
    const entries = readTar(bytes);
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    const manifestEntry = byName.get(MANIFEST_NAME);
    if (!manifestEntry) {
        throw new Error(`${name}: the archive has no ${MANIFEST_NAME}`);
    }
    const manifest = parseJson<AnnexIManifest>(manifestEntry, name);
    const files = manifest.Files ?? [];

    const members: TarEntry[] = [];
    for (const file of files) {
        const entry = byName.get(file);
        if (!entry) {
            throw new Error(`${name}: the manifest names ${file}, which the archive does not contain`);
        }
        members.push(entry);
    }
    for (const entry of entries) {
        if (entry.name !== MANIFEST_NAME && !files.includes(entry.name)) {
            throw new Error(`${name}: ${entry.name} is in the archive but not in the manifest`);
        }
    }
    return { manifest, members };
}

/** the manifest as the header of a single document, which is what the records want */
function headerOf(manifest: AnnexIManifest) {
    return annexIHeaderRecord({
        Ordered: manifest.Ordered,
        Models: manifest.Models,
        Declarations: manifest.Declarations
    });
}

const annexIArchiveFormat: NodesetFormat = {
    name: ANNEX_I_ARCHIVE_FORMAT,
    extensions: [".uanodeset"],
    // above the two JSON forms: an archive inflates to a tar, not to a brace
    priority: 220,
    sniff(head: NodesetHead): boolean {
        return isAnnexIArchiveHead(head);
    },
    async readModels(document: NodesetDocument): Promise<NodesetModelInfo> {
        const { manifest } = openArchive(await document.bytes(), document.name);
        const { record } = headerOf(manifest);
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
        const { manifest, members } = openArchive(await document.bytes(), document.name);
        const { record: header, namespaces } = headerOf(manifest);
        yield header;

        // "Each file is processed in order. Each NodeClass is read in the order specified in I.4.
        // Each Node for a NodeClass is processed in the order they appear."
        for (const member of members) {
            const nodeSet = parseJson<AnnexIUANodeSet>(member, document.name);
            let index = 0;
            for (const node of flattenAnnexIDocument(nodeSet)) {
                index++;
                try {
                    yield annexINodeRecord(node, namespaces);
                } catch (err) {
                    throw new Error(
                        `${document.name}: ${member.name} node ${index} (${node.NodeId ?? "no NodeId"}): ${(err as Error).message}`
                    );
                }
            }
        }
    }
};

/** how many nodes a member holds, counting the children nested inside them */
function countNodes(node: AnnexINode): number {
    let total = 1;
    for (const kind of ["Objects", "Variables", "Methods"] as const) {
        for (const child of node.Children?.[kind] ?? []) {
            total += countNodes(child);
        }
    }
    return total;
}

/**
 * the archive members a document splits into.
 *
 * A root node and everything nested inside it stay together: the nesting is what says who owns
 * what, and a subtree divided across two files would have to be rejoined before either could be
 * understood. So `maxNodes` is a target rather than a bound, and a single large subtree may
 * exceed it.
 */
function splitContainers(containers: AnnexINodeContainer, maxNodes: number): AnnexINodeContainer[] {
    const parts: AnnexINodeContainer[] = [];
    let current: AnnexINodeContainer = {};
    let count = 0;
    for (const container of ANNEX_I_CONTAINER_ORDER) {
        for (const node of containers[container] ?? []) {
            const size = countNodes(node);
            if (count > 0 && count + size > maxNodes) {
                parts.push(current);
                current = {};
                count = 0;
            }
            const bucket = current[container] ?? [];
            bucket.push(node);
            current[container] = bucket;
            count += size;
        }
    }
    if (count > 0) {
        parts.push(current);
    }
    return parts;
}

export interface AnnexIArchiveOptions {
    /** how many nodes to aim for in each member; the default is what the reference tool uses */
    maxNodesPerFile?: number;
}

/**
 * a stream of records as the *uncompressed* archive.
 *
 * The gzip is left to the caller because that is where the platform's compressor lives: the
 * loader installs zlib under Node.js and CompressionStream in a browser, and this package has no
 * business choosing between them.
 */
export function recordsToAnnexIArchiveTar(records: Iterable<NodesetRecord>, options: AnnexIArchiveOptions = {}): Uint8Array {
    const document = recordsToAnnexIDocument(records);
    const parts = splitContainers(document.Nodes ?? {}, options.maxNodesPerFile ?? DEFAULT_NODES_PER_FILE);

    const encoder = new TextEncoder();
    const files = parts.map((_, index) => MEMBER_NAME(index + 1));

    const manifest: AnnexIManifest = { Ordered: document.Ordered, Models: document.Models };
    if (document.Declarations?.length) {
        manifest.Declarations = document.Declarations;
    }
    manifest.Files = files;

    const entries: TarEntry[] = [{ name: MANIFEST_NAME, data: encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`) }];
    parts.forEach((nodes, index) => {
        // "The Models and Declarations fields are omitted from all files because they are
        // specified in the manifest."
        const member = { Ordered: document.Ordered, HasManifest: true, Nodes: nodes };
        entries.push({ name: files[index], data: encoder.encode(`${JSON.stringify(member, null, 2)}\n`) });
    });
    return writeTar(entries);
}

let registered = false;

/** make the Annex I archive form readable by the loader; safe to call more than once */
export function registerAnnexIArchiveFormat(): void {
    if (registered) return;
    registered = true;
    registerNodesetFormat(annexIArchiveFormat);
}

registerAnnexIArchiveFormat();
