/**
 * The vocabulary, and the mapping from a collected model to the JSON-LD document.
 *
 * Everything here is synchronous and reads only `RdfModel`, so the same code serves a model
 * collected from an address space and one collected over a session. The vocabulary is the
 * reference implementation's; `VOCABULARY.md` beside this file records what reading its output
 * established.
 */

import { NodeClass } from "node-opcua-data-model";
import { JsonEncoderMode105, opcuaJsonEncodeVariant105 } from "node-opcua-json";
import { type NodeId, NodeIdType } from "node-opcua-nodeid";
import { Variant } from "node-opcua-variant";
import type { RdfModel, RdfNode, RdfTarget } from "./model.js";

/** the vocabulary the reference implementation writes its own terms under */
export const UARDF = "http://opcfoundation.org/rdf/uacore#";
/** the OPC UA base namespace, always abbreviated `opcua` */
export const OPCUA_NAMESPACE = "http://opcfoundation.org/UA/";

/** `DataTypeDictionaryType`: the legacy OPC Binary dictionaries, which are dropped */
const DATA_TYPE_DICTIONARY_TYPE = 72;
/** `DataTypeDescriptionType`: the per-type entries inside them, also dropped */
const DATA_TYPE_DESCRIPTION_TYPE = 69;

/** the terms every document declares, in the order the reference implementation writes them */
const PROPERTY_TERMS: Array<[string, unknown]> = [
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["uardf", UARDF],
    ["browseName", "uardf:browseName"],
    ["name", "uardf:name"],
    ["symbolicName", "uardf:symbolicName"],
    ["description", { "@id": "rdfs:comment", "@container": "@language" }],
    ["displayName", { "@id": "rdfs:label", "@container": "@language" }],
    ["inverseName", { "@id": "uardf:inverseName", "@container": "@language" }],
    ["releaseStatus", "uardf:releaseStatus"],
    ["valueRank", { "@id": "uardf:valueRank", "@type": "xsd:integer" }],
    ["arrayDimensions", "uardf:arrayDimensions"],
    ["value", { "@id": "uardf:value", "@type": "@json" }],
    ["accessRestrictions", { "@id": "uardf:accessRestrictions", "@type": "xsd:integer" }],
    ["definition", "uardf:definition"],
    ["fields", "uardf:fields"],
    ["fieldName", "uardf:fieldName"],
    ["isUnion", { "@id": "uardf:isUnion", "@type": "xsd:boolean" }],
    ["isOptional", { "@id": "uardf:isOptional", "@type": "xsd:boolean" }],
    ["allowSubTypes", { "@id": "uardf:allowSubTypes", "@type": "xsd:boolean" }],
    ["dataType", { "@id": "uardf:hasDataType", "@type": "@id" }],
    ["typeDefinition", { "@id": "opcua:HasTypeDefinition", "@type": "@id" }],
    ["parent", { "@id": "uardf:hasParent", "@type": "@id" }],
    ["modellingRule", { "@id": "opcua:HasModellingRule", "@type": "@id" }],
    ["fieldValue", { "@id": "uardf:fieldValue", "@type": "xsd:integer" }],
    ["fieldDataType", { "@id": "uardf:fieldDataType", "@type": "@id" }],
    ["rolePermissions", "uardf:rolePermissions"],
    ["roleId", { "@id": "uardf:roleId", "@type": "@id" }],
    ["permissions", { "@id": "uardf:permissions", "@type": "xsd:integer" }],
    ["modelUri", { "@id": "uardf:modelUri", "@type": "@id" }],
    ["version", "uardf:version"],
    ["modelVersion", "uardf:modelVersion"],
    ["publicationDate", { "@id": "uardf:publicationDate", "@type": "xsd:dateTime" }],
    ["xmlSchemaUri", { "@id": "uardf:xmlSchemaUri", "@type": "@id" }],
    ["requiredModels", "uardf:requiredModels"],
    ["namespaceUri", { "@id": "uardf:namespaceUri", "@type": "@id" }],
    ["owl", "http://www.w3.org/2002/07/owl#"],
    ["nodeId", "uardf:nodeId"],
    ["references", "uardf:references"],
    ["referenceType", { "@id": "uardf:referenceType", "@type": "@id" }],
    ["target", { "@id": "uardf:target", "@type": "@id" }],
    ["label", "rdfs:label"],
    ["inverseOf", { "@id": "owl:inverseOf", "@type": "@id" }],
    ["subPropertyOf", { "@id": "rdfs:subPropertyOf", "@type": "@id" }],
    ["subClassOf", { "@id": "rdfs:subClassOf", "@type": "@id" }],
    ["symmetric", { "@id": "uardf:symmetric", "@type": "xsd:boolean" }]
];

const RDF_TYPE_OF: Record<number, string> = {
    [NodeClass.Object]: "uardf:UAObject",
    [NodeClass.Variable]: "uardf:UAVariable",
    [NodeClass.Method]: "uardf:UAMethod",
    [NodeClass.ObjectType]: "uardf:UAObjectType",
    [NodeClass.VariableType]: "uardf:UAVariableType",
    [NodeClass.ReferenceType]: "uardf:UAReferenceType",
    [NodeClass.DataType]: "uardf:UADataType",
    [NodeClass.View]: "uardf:UAView"
};

/** the NodeClasses named by their BrowseName, because they become OWL classes */
const IS_TYPE = new Set<number>([NodeClass.ObjectType, NodeClass.VariableType, NodeClass.ReferenceType, NodeClass.DataType]);

/** base64url without padding: a NodeId carries `=`, `;`, `:` and `/`, none legal in an IRI segment */
function base64Url(text: string): string {
    return Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** the prefix a namespace uri is abbreviated to: its last non-empty segment, lowercased */
export function prefixOfNamespace(uri: string): string {
    if (uri === OPCUA_NAMESPACE) {
        return "opcua";
    }
    const segment =
        uri
            .replace(/[/#]+$/, "")
            .split(/[/:#]/)
            .filter(Boolean)
            .pop() ?? "ns";
    return segment.toLowerCase();
}

/** a BrowseName naming a placeholder rather than a node, which never becomes a predicate */
const isPlaceholder = (name: string) => name.startsWith("<");

export interface JsonLdOptions {
    /** the model to export; the default is the last namespace the address space holds */
    modelUri?: string;
    /**
     * two fields of the ontology node the address space does not retain.
     *
     * They are written in the source document's `Models` element and dropped by the loader, so a
     * caller that wants them in the output supplies them again.
     */
    model?: { xmlSchemaUri?: string; modelVersion?: string };
}

/** a collected model as a JSON-LD document */
export function modelToJsonLd(model: RdfModel, options: JsonLdOptions = {}): Record<string, unknown> {
    const { target, nodes } = model;

    const uriOf = (index: number) => model.namespaceUris[index] ?? "";
    const prefixOf = (index: number) => prefixOfNamespace(uriOf(index));

    const identifierOf = (nodeId: NodeId): string => {
        switch (nodeId.identifierType) {
            case NodeIdType.NUMERIC:
                return `i=${nodeId.value as number}`;
            case NodeIdType.STRING:
                return `s=${nodeId.value as string}`;
            case NodeIdType.GUID:
                return `g=${nodeId.value as string}`;
            default:
                return `b=${Buffer.from(nodeId.value as Uint8Array).toString("base64")}`;
        }
    };
    const canonical = (nodeId: NodeId): string =>
        nodeId.namespace === 0 ? identifierOf(nodeId) : `nsu=${uriOf(nodeId.namespace)};${identifierOf(nodeId)}`;

    const curie = (node: RdfNode): string => {
        const prefix = prefixOf(node.nodeId.namespace);
        return IS_TYPE.has(node.nodeClass as number)
            ? `${prefix}:${node.browseName.name}`
            : `${prefix}:${base64Url(canonical(node.nodeId))}`;
    };
    const curieOfType = (node: RdfNode) => `${prefixOf(node.nodeId.namespace)}:${node.browseName.name}`;

    /** whether a reference type expresses ownership rather than an arbitrary relation */
    const isHierarchical = (referenceType: RdfNode): boolean => {
        let current: RdfNode | undefined = referenceType;
        const seen = new Set<string>();
        while (current) {
            const name = current.browseName.name ?? "";
            if (name === "HierarchicalReferences") return true;
            if (name === "NonHierarchicalReferences") return false;
            const id = current.nodeId.toString();
            if (seen.has(id)) return false;
            seen.add(id);
            current = current.subtypeOf ? model.resolve(current.subtypeOf) : undefined;
        }
        return false;
    };

    // the legacy OPC Binary machinery is dropped: a dictionary, its descriptions, and everything
    // they own. The structure DataTypes stay; only the encoding blobs go.
    const dropped = new Set<string>();
    const markDropped = (node: RdfNode) => {
        if (dropped.has(node.nodeId.toString())) return;
        dropped.add(node.nodeId.toString());
        for (const reference of node.references) {
            if (!reference.isForward) continue;
            const child = model.resolve(reference.targetId);
            const referenceType = model.resolve(reference.referenceTypeId);
            if (child && referenceType && isHierarchical(referenceType)) markDropped(child);
        }
    };
    for (const node of nodes) {
        const id = node.typeDefinition;
        if (id?.namespace === 0 && (id.value === DATA_TYPE_DICTIONARY_TYPE || id.value === DATA_TYPE_DESCRIPTION_TYPE)) {
            markDropped(node);
        }
    }

    const context: Record<string, unknown> = { opcua: OPCUA_NAMESPACE };
    context[prefixOfNamespace(target.namespaceUri)] = target.namespaceUri;
    for (const [term, value] of PROPERTY_TERMS) {
        context[term] = value;
    }

    /** reference types used as predicates, and child predicates minted from BrowseNames */
    const referenceTerms = new Map<string, string>();
    const childTerms = new Map<string, string>();
    const graph: Record<string, unknown>[] = [ontologyNode(target, options)];
    /** children this model hangs on a node it does not own, which cannot be stated in @graph */
    const foreign = new Map<string, Record<string, unknown>>();

    for (const node of nodes) {
        if (dropped.has(node.nodeId.toString())) continue;

        const entry: Record<string, unknown> = {
            "@id": curie(node),
            "@type": rdfTypesOf(node, model, curie),
            nodeId: canonical(node.nodeId),
            namespaceUri: target.namespaceUri,
            browseName:
                node.browseName.namespaceIndex === 0
                    ? (node.browseName.name ?? "")
                    : `nsu=${uriOf(node.browseName.namespaceIndex)};${node.browseName.name}`,
            name: node.browseName.name ?? ""
        };

        variableFields(node, entry, (id) => {
            const found = model.resolve(id);
            return found ? curie(found) : undefined;
        });
        if (node.symbolicName) entry.symbolicName = node.symbolicName;
        const description = node.description?.text;
        if (description) {
            entry.description = { [node.description?.locale || "@none"]: description };
        }

        for (const reference of node.references) {
            const referenceType = model.resolve(reference.referenceTypeId);
            const other = model.resolve(reference.targetId);
            if (!referenceType || !other || dropped.has(other.nodeId.toString())) continue;
            const name = referenceType.browseName.name ?? "";

            if (!reference.isForward) {
                if (name === "HasSubtype") entry.subClassOf = curie(other);
                // a parent in another model is stated where that model's node is, in @included:
                // this document does not get to add fields to a node it does not own
                else if (isHierarchical(referenceType) && entry.parent === undefined && other.nodeId.namespace === target.index)
                    entry.parent = curie(other);
                continue;
            }
            if (name === "HasTypeDefinition" || name === "HasModellingRule" || name === "HasSubtype") continue;

            if (isHierarchical(referenceType)) {
                const childName = other.browseName.name ?? "";
                if (isPlaceholder(childName)) continue;
                const term = `${prefixOf(other.browseName.namespaceIndex)}:${childName}`;
                childTerms.set(term, curieOfType(referenceType));
                addValue(entry, term, curie(other));
            } else {
                referenceTerms.set(name, curieOfType(referenceType));
                addValue(entry, name, curie(other));
            }
        }
        graph.push(entry);
    }

    for (const node of nodes) {
        if (dropped.has(node.nodeId.toString())) continue;
        for (const reference of node.references) {
            if (reference.isForward) continue;
            const parent = model.resolve(reference.targetId);
            const referenceType = model.resolve(reference.referenceTypeId);
            if (!parent || !referenceType || !isHierarchical(referenceType)) continue;
            // HasSubtype is hierarchical but expresses derivation, not ownership, and is already
            // written as subClassOf; treating it as an attachment invents a predicate per type
            if (referenceType.browseName.name === "HasSubtype") continue;
            if (parent.nodeId.namespace === target.index) continue;
            const childName = node.browseName.name ?? "";
            if (isPlaceholder(childName)) continue;
            const term = `${prefixOf(node.browseName.namespaceIndex)}:${childName}`;
            childTerms.set(term, curieOfType(referenceType));
            const key = curie(parent);
            const entry = foreign.get(key) ?? { "@id": key };
            addValue(entry, term, curie(node));
            foreign.set(key, entry);
        }
    }

    for (const term of [...referenceTerms.keys()].sort()) {
        context[term] = { "@id": referenceTerms.get(term), "@type": "@id" };
    }
    for (const term of [...childTerms.keys()].sort()) {
        context[term] = { "@type": "@id" };
    }

    const included: Record<string, unknown>[] = [];
    for (const node of nodes) {
        if (node.nodeClass !== NodeClass.ReferenceType) continue;
        included.push(objectPropertyOf(node, model, curie, prefixOf));
    }
    for (const term of [...childTerms.keys()].sort()) {
        included.push({ "@id": term, "@type": "owl:ObjectProperty", subPropertyOf: childTerms.get(term) });
    }
    included.push(...foreign.values());

    const document: Record<string, unknown> = { "@context": context, "@graph": graph };
    if (included.length) document["@included"] = included;
    return document;
}

function rdfTypesOf(node: RdfNode, model: RdfModel, curie: (node: RdfNode) => string): string | string[] {
    const base = RDF_TYPE_OF[node.nodeClass as number] ?? "uardf:UANode";
    if (IS_TYPE.has(node.nodeClass as number)) return [base, "owl:Class"];
    const typeDefinition = node.typeDefinition ? model.resolve(node.typeDefinition) : undefined;
    return typeDefinition ? [base, curie(typeDefinition)] : base;
}

function variableFields(node: RdfNode, entry: Record<string, unknown>, curieOfId: (nodeId: NodeId) => string | undefined): void {
    if (node.nodeClass !== NodeClass.Variable && node.nodeClass !== NodeClass.VariableType) return;
    if (node.dataType) {
        const dataType = curieOfId(node.dataType);
        if (dataType) entry.dataType = dataType;
    }
    if (node.valueRank !== undefined && node.valueRank !== -1) entry.valueRank = node.valueRank;
    if (node.arrayDimensions?.length) entry.arrayDimensions = node.arrayDimensions.join(",");
    if (node.value && node.value.dataType !== 0) {
        entry.value = opcuaJsonEncodeVariant105(new Variant(node.value), JsonEncoderMode105.Verbose, []);
    }
}

function addValue(entry: Record<string, unknown>, term: string, value: string): void {
    const existing = entry[term];
    if (existing === undefined) entry[term] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else entry[term] = [existing, value];
}

function objectPropertyOf(
    referenceType: RdfNode,
    model: RdfModel,
    curie: (node: RdfNode) => string,
    prefixOf: (index: number) => string
): Record<string, unknown> {
    const symmetric = !!referenceType.symmetric;
    const entry: Record<string, unknown> = {
        "@id": curie(referenceType),
        "@type": "owl:ObjectProperty",
        label: referenceType.browseName.name ?? "",
        symmetric
    };
    const inverseName = referenceType.inverseName?.text;
    if (symmetric) {
        entry.inverseOf = curie(referenceType);
    } else if (inverseName) {
        entry.inverseOf = `${prefixOf(referenceType.nodeId.namespace)}:${inverseName}`;
        entry.inverseName = { "@none": inverseName };
    }
    const supertype = referenceType.subtypeOf ? model.resolve(referenceType.subtypeOf) : undefined;
    if (supertype) entry.subPropertyOf = curie(supertype);
    return entry;
}

function ontologyNode(target: RdfTarget, options: JsonLdOptions): Record<string, unknown> {
    const entry: Record<string, unknown> = {
        "@id": target.namespaceUri,
        "@type": ["uardf:UANodeSet", "owl:Ontology"],
        modelUri: target.namespaceUri
    };
    if (options.model?.xmlSchemaUri) entry.xmlSchemaUri = options.model.xmlSchemaUri;
    if (target.version) entry.version = target.version;
    const modelVersion = options.model?.modelVersion;
    if (modelVersion) {
        entry.modelVersion = modelVersion;
        entry["owl:versionInfo"] = modelVersion;
        entry["owl:versionIRI"] = { "@id": `${target.namespaceUri}${modelVersion}` };
    }
    const iso = (date: Date | undefined) =>
        date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().replace(/\.\d{3}Z$/, "Z") : undefined;
    const published = iso(target.publicationDate);
    if (published) entry.publicationDate = published;

    const required = target.requiredModels;
    if (required?.length) {
        entry.requiredModels = required.map((model) => {
            const out: Record<string, unknown> = { modelUri: model.modelUri };
            if (model.version) out.version = model.version;
            const date = iso(model.publicationDate);
            if (date) out.publicationDate = date;
            return out;
        });
        entry["owl:imports"] = required.map((model) => ({ "@id": model.modelUri }));
    }
    return entry;
}
