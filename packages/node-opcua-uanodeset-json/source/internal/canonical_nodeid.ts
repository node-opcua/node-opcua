/**
 * NodeIds and QualifiedNames as OPC 10000-6 Annex I writes them.
 *
 * Annex I.1 is explicit that this is not the XML encoding wearing different brackets:
 *
 * > **No namespace table:** NodeIds and QualifiedNames embed the NamespaceUri directly rather
 * > than using an index into a NamespaceUris table. The OPC UA base namespace
 * > (`http://opcfoundation.org/UA/`) is encoded using only the identifier portion, with no
 * > namespace prefix.
 * >
 * > **No aliases:** NodeId strings are always fully qualified; no alias substitution table is
 * > provided.
 *
 * The loader's records, on the other hand, carry file-local namespace *indices*, because that is
 * what the address space applies. So this module is the boundary between the two: a URI on one
 * side, an index on the other, and a table that maps between them.
 *
 * The table is not stated anywhere in the document. It is derived, in a fixed order, from the
 * models the header declares (see {@link annexINamespaceTable}), which is what makes the mapping
 * reproducible for a reader that has seen only the first line.
 */

import { QualifiedName } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";

/** the namespace every NodeSet is written against, and the one Annex I writes without a prefix */
export const OPCUA_CORE_NAMESPACE = "http://opcfoundation.org/UA/";

/** a model as the header declares it, reduced to what the namespace table is built from */
export interface AnnexIModelLike {
    ModelUri?: string;
    RequiredModels?: Array<{ ModelUri?: string }>;
}

/**
 * the namespace table a document implies, in the order a reader must reconstruct it.
 *
 * Index 0 is always the OPC UA base namespace, whether or not the document mentions it. After
 * that, each model contributes its own `ModelUri` and then the `ModelUri` of each model it
 * requires, in the order they are written, skipping any already present.
 *
 * Nothing in Annex I names this order, because Annex I never needs it: it writes URIs. It matters
 * here because our records are index-based, and because two readers that disagreed about the
 * order would disagree about every NodeId in the document.
 */
export function annexINamespaceTable(models: AnnexIModelLike[] | undefined): string[] {
    const table: string[] = [OPCUA_CORE_NAMESPACE];
    const add = (uri: string | undefined) => {
        if (uri && !table.includes(uri)) {
            table.push(uri);
        }
    };
    for (const model of models ?? []) {
        add(model.ModelUri);
        for (const required of model.RequiredModels ?? []) {
            add(required.ModelUri);
        }
    }
    return table;
}

/**
 * where a namespace URI sits in the table, adding it if the document referred to a namespace its
 * models did not declare.
 *
 * That should not happen -- the reference implementation refuses such a document with "Unknown
 * namespace(s) referenced" -- but a reader that threw here would turn a document it could still
 * mostly read into nothing at all, and the loader reports unresolved ids far better than we can.
 */
function indexOfUri(table: string[], uri: string): number {
    const index = table.indexOf(uri);
    if (index >= 0) {
        return index;
    }
    table.push(uri);
    return table.length - 1;
}

/** `nsu=<uri>;<rest>`, where the URI ends at the FIRST semicolon: a URI may not contain one */
const NSU = /^nsu=([^;]*);([\s\S]*)$/;
/** `ns=<index>;<rest>` -- Part 6 5.1.12 defines it, and Annex I documents do not write it */
const NS = /^ns=(\d+);([\s\S]*)$/;
/** `svu=<uri>;` or `svr=<n>;`: a server-specific ExpandedNodeId, which a NodeSet never is */
const SERVER = /^(?:svu=[^;]*|svr=\d+);([\s\S]*)$/;

/**
 * a NodeId written the Annex I way, as a NodeId whose namespace is an index into `table`.
 *
 * Accepts the `ns=` form as well as `nsu=`, because 5.1.12 defines both and refusing one would
 * make this reader stricter than the specification it implements. A server prefix is consumed and
 * dropped: it cannot mean anything in a document that describes no particular server.
 */
export function parseAnnexINodeId(text: string, table: string[]): NodeId {
    if (!text) {
        return NodeId.nullNodeId;
    }
    let rest = text;
    let namespace = 0;

    const server = SERVER.exec(rest);
    if (server) {
        rest = server[1];
    }
    const nsu = NSU.exec(rest);
    if (nsu) {
        namespace = indexOfUri(table, nsu[1]);
        rest = nsu[2];
    } else {
        const ns = NS.exec(rest);
        if (ns) {
            namespace = Number.parseInt(ns[1], 10);
            rest = ns[2];
        }
    }
    return identifierToNodeId(rest, namespace, text);
}

function identifierToNodeId(identifier: string, namespace: number, whole: string): NodeId {
    const kind = identifier.slice(0, 2);
    const value = identifier.slice(2);
    switch (kind) {
        case "i=": {
            const numeric = Number.parseInt(value, 10);
            if (!Number.isFinite(numeric)) {
                throw new Error(`not a numeric NodeId identifier: ${whole}`);
            }
            return new NodeId(NodeIdType.NUMERIC, numeric, namespace);
        }
        case "s=":
            return new NodeId(NodeIdType.STRING, value, namespace);
        case "g=":
            return new NodeId(NodeIdType.GUID, value, namespace);
        case "b=":
            return new NodeId(NodeIdType.BYTESTRING, Buffer.from(value, "base64"), namespace);
        default:
            throw new Error(`a NodeId identifier must start with i=, s=, g= or b=: ${whole}`);
    }
}

/** the identifier portion of a NodeId, without any namespace prefix */
function identifierOf(nodeId: NodeId): string {
    switch (nodeId.identifierType) {
        case NodeIdType.NUMERIC:
            return `i=${nodeId.value as number}`;
        case NodeIdType.STRING:
            return `s=${nodeId.value as string}`;
        case NodeIdType.GUID:
            return `g=${nodeId.value as string}`;
        case NodeIdType.BYTESTRING:
            return `b=${Buffer.from(nodeId.value as Uint8Array).toString("base64")}`;
        default:
            throw new Error(`a NodeId of an unknown identifier type: ${nodeId.toString()}`);
    }
}

/**
 * a NodeId as Annex I writes it: the identifier alone in the base namespace, `nsu=<uri>;` before
 * it otherwise. Never `ns=`, and never an alias, which is what I.1 requires of a writer.
 */
export function formatAnnexINodeId(nodeId: NodeId, table: string[]): string {
    const identifier = identifierOf(nodeId);
    if (nodeId.namespace === 0) {
        return identifier;
    }
    const uri = table[nodeId.namespace];
    if (uri === undefined) {
        throw new Error(`no namespace uri for index ${nodeId.namespace} in a document that declares ${table.length}`);
    }
    return `nsu=${uri};${identifier}`;
}

/**
 * a QualifiedName written the Annex I way.
 *
 * The prefix rule is the NodeId rule, but the remainder is a name rather than a typed identifier,
 * so a bare string is a name in the base namespace. That makes one case ambiguous in principle --
 * a name that itself begins `nsu=` -- and unambiguous in practice, because I.1 bans a semicolon
 * in a namespace URI and the first semicolon therefore ends the prefix.
 */
export function parseAnnexIQualifiedName(text: string, table: string[]): QualifiedName {
    if (!text) {
        return new QualifiedName({ namespaceIndex: 0, name: null });
    }
    const nsu = NSU.exec(text);
    if (nsu) {
        return new QualifiedName({ namespaceIndex: indexOfUri(table, nsu[1]), name: nsu[2] });
    }
    const ns = NS.exec(text);
    if (ns) {
        return new QualifiedName({ namespaceIndex: Number.parseInt(ns[1], 10), name: ns[2] });
    }
    return new QualifiedName({ namespaceIndex: 0, name: text });
}

/** a QualifiedName as Annex I writes it */
export function formatAnnexIQualifiedName(name: QualifiedName, table: string[]): string {
    const bare = name.name ?? "";
    if (!name.namespaceIndex) {
        return bare;
    }
    const uri = table[name.namespaceIndex];
    if (uri === undefined) {
        throw new Error(`no namespace uri for index ${name.namespaceIndex} in a document that declares ${table.length}`);
    }
    return `nsu=${uri};${bare}`;
}
