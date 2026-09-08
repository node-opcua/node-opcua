/**
 * The loader's records back to an Annex I document.
 *
 * This is the inverse of `annex_i_to_records.ts`, and it has three jobs the reader does not.
 *
 * It **removes** what the annex states as fields rather than edges: `HasTypeDefinition` and
 * `HasModellingRule` become `TypeId` and `ModellingRuleId`, and the forward edge from a parent to
 * a child is dropped because `ParentId` implies it. The reader puts all three back, and the two
 * halves have to agree exactly or a round trip loses references.
 *
 * It **nests**, because the document form carries a Node's children inside it.
 *
 * And it **orders**. I.2 is what lets a decoder read forwards without a DOM, so an encoder that
 * ignores it must not set `Ordered`. Where the graph makes ordering impossible -- recursive types
 * that name each other -- the annex says the encoder provides forward declarations instead.
 */

import type { NodesetHeaderRecord, NodesetNodeRecord, NodesetRecord } from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import {
    ANNEX_I_CHILD_ORDER,
    ANNEX_I_CONTAINER_ORDER,
    type AnnexIChildList,
    type AnnexILocalizedText,
    type AnnexINode,
    type AnnexINodeContainer,
    type AnnexIUANodeSet
} from "./annex_i_types.js";
import { encodeAnnexIVariant } from "./annex_i_variant.js";
import { formatAnnexINodeId, formatAnnexIQualifiedName } from "./canonical_nodeid.js";

/** `HasTypeDefinition`, which the annex states as `TypeId` */
const HAS_TYPE_DEFINITION = 40;
/** `HasModellingRule`, which the annex states as `ModellingRuleId` */
const HAS_MODELLING_RULE = 37;
/** `HasSubtype`, whose direction decides the order of the types */
const HAS_SUBTYPE = 45;

/** which of the eight containers a NodeClass belongs in */
const CONTAINER_OF: Record<number, keyof AnnexINodeContainer> = {
    [NodeClass.ReferenceType]: "ReferenceTypes",
    [NodeClass.DataType]: "DataTypes",
    [NodeClass.VariableType]: "VariableTypes",
    [NodeClass.ObjectType]: "ObjectTypes",
    [NodeClass.Variable]: "Variables",
    [NodeClass.Method]: "Methods",
    [NodeClass.Object]: "Objects",
    [NodeClass.View]: "Views"
};

/** which of the three child lists a NodeClass belongs in; anything else is never nested */
const CHILD_LIST_OF: Record<number, keyof AnnexIChildList | undefined> = {
    [NodeClass.Object]: "Objects",
    [NodeClass.Variable]: "Variables",
    [NodeClass.Method]: "Methods"
};

const localizedText = (text: string | undefined): AnnexILocalizedText | undefined =>
    text === undefined ? undefined : { t: [["", text]] };

/**
 * one Node, with the three implied references taken out.
 *
 * `childrenOf` says which of this node's forward references point at a node that names it as its
 * parent: those are the edges the nesting will express, and the annex does not write them.
 */
function toAnnexINode(record: NodesetNodeRecord, namespaces: string[], childIds: Set<string>): AnnexINode {
    const node: AnnexINode = {
        NodeId: formatAnnexINodeId(record.nodeId, namespaces),
        NodeClass: record.nodeClass as unknown as AnnexINode["NodeClass"],
        BrowseName: formatAnnexIQualifiedName(record.browseName, namespaces)
    };
    if (record.symbolicName !== undefined) node.SymbolicName = record.symbolicName;
    if (record.parentNodeId) node.ParentId = formatAnnexINodeId(record.parentNodeId, namespaces);

    const references: AnnexINode["References"] = [];
    for (const reference of record.references) {
        const type = reference.referenceType;
        if (reference.isForward && type.namespace === 0 && type.value === HAS_TYPE_DEFINITION) {
            node.TypeId = formatAnnexINodeId(reference.nodeId, namespaces);
            continue;
        }
        if (reference.isForward && type.namespace === 0 && type.value === HAS_MODELLING_RULE) {
            node.ModellingRuleId = formatAnnexINodeId(reference.nodeId, namespaces);
            continue;
        }
        // the parent to child direction is implied by the child's ParentId and is not repeated
        if (reference.isForward && childIds.has(reference.nodeId.toString())) {
            continue;
        }
        const out: NonNullable<AnnexINode["References"]>[number] = {
            ReferenceTypeId: formatAnnexINodeId(type, namespaces),
            TargetId: formatAnnexINodeId(reference.nodeId, namespaces)
        };
        // the annex writes the flag only to say "inverse"
        if (!reference.isForward) out.IsForward = false;
        references.push(out);
    }
    if (references.length) node.References = references;

    const displayName = localizedText(record.displayName);
    if (displayName) node.DisplayName = displayName;
    const description = localizedText(record.description);
    if (description) node.Description = description;
    const inverseName = localizedText(record.inverseName);
    if (inverseName) node.InverseName = inverseName;

    if (record.releaseStatus !== undefined) node.ReleaseStatus = record.releaseStatus;
    if (record.documentation !== undefined) node.Documentation = record.documentation;
    if (record.category?.length) node.ConformanceUnits = [...record.category];
    if (record.isAbstract !== undefined) node.IsAbstract = record.isAbstract;
    if (record.hasNoPermissions !== undefined) node.HasNoPermissions = record.hasNoPermissions;
    if (record.accessRestrictions !== undefined) node.AccessRestrictions = Number(record.accessRestrictions);
    if (record.rolePermissions?.length) {
        node.RolePermissions = record.rolePermissions.map((permission) => ({
            RoleId: formatAnnexINodeId(permission.roleId, namespaces),
            Permissions: permission.permissions
        }));
    }
    if (record.eventNotifier !== undefined) node.EventNotifier = record.eventNotifier;
    if (record.containsNoLoops !== undefined) node.ContainsNoLoops = record.containsNoLoops;
    if (record.symmetric !== undefined) node.Symmetric = record.symmetric;
    if (record.dataType) node.DataType = formatAnnexINodeId(record.dataType, namespaces);
    // I.13: an omitted ValueRank is Scalar, so the default is not written back out
    if (record.valueRank !== undefined && record.valueRank !== -1) node.ValueRank = record.valueRank;
    if (record.arrayDimensions?.length) node.ArrayDimensions = record.arrayDimensions.join(",");
    if (record.minimumSamplingInterval) node.MinimumSamplingInterval = record.minimumSamplingInterval;
    if (record.historizing) node.Historizing = record.historizing;
    if (record.accessLevel !== undefined) node.AccessLevel = Number(record.accessLevel);
    if (record.methodDeclarationId) node.MethodDeclarationId = formatAnnexINodeId(record.methodDeclarationId, namespaces);

    const value = encodeAnnexIVariant(record.value, namespaces);
    if (value) node.Value = value;

    if (record.definition) {
        node.Definition = {
            IsUnion: record.definition.isUnion,
            IsOptionSet: record.definition.isOptionSet,
            Fields: record.definition.fields.map((field) => {
                return {
                    Name: field.name ?? undefined,
                    Description:
                        typeof field.description === "string"
                            ? localizedText(field.description)
                            : localizedText((field.description as { text?: string } | undefined)?.text ?? undefined),
                    Value: field.value as number | undefined,
                    DataType: field.dataType ? formatAnnexINodeId(field.dataType as NodeId, namespaces) : undefined,
                    ValueRank: field.valueRank,
                    ArrayDimensions: field.arrayDimensions?.length ? field.arrayDimensions.join(",") : undefined,
                    MaxStringLength: field.maxStringLength,
                    IsOptional: field.isOptional
                };
            })
        };
    }
    return node;
}

/** a Node whose identifying fields point at something defined later, reduced to a stub */
function declarationOf(node: AnnexINode): AnnexINode {
    return { NodeId: node.NodeId, NodeClass: node.NodeClass, BrowseName: node.BrowseName };
}

/** the NodeIds an object names through the fields I.2 governs; References are exempt */
function identifyingIds(node: AnnexINode): string[] {
    const ids: string[] = [];
    const push = (id: string | undefined) => {
        if (id) ids.push(id);
    };
    push(node.ParentId);
    push(node.TypeId);
    push(node.ModellingRuleId);
    push(node.DataType);
    push(node.MethodDeclarationId);
    for (const permission of node.RolePermissions ?? []) push(permission.RoleId);
    for (const field of node.Definition?.Fields ?? []) push(field.DataType);
    return ids;
}

/**
 * the document a stream of records describes.
 *
 * `Ordered` is only set when the ordering actually holds, which here means: every type precedes
 * its subtypes, the containers are in NodeClass order, and anything an identifying field names
 * too early has been declared first. An encoder that set the flag without doing the work would
 * mislead exactly the decoders the flag exists for.
 */
export function recordsToAnnexIDocument(records: Iterable<NodesetRecord>): AnnexIUANodeSet {
    let header: NodesetHeaderRecord | undefined;
    const nodeRecords: NodesetNodeRecord[] = [];
    for (const record of records) {
        if (record.kind === "header") header = record;
        else nodeRecords.push(record);
    }
    if (!header) {
        throw new Error("a nodeset document begins with a header record");
    }
    const namespaces = header.namespaceUris;

    // which nodes are someone's child, so the parent can drop the forward edge to them
    const childrenOf = new Map<string, NodesetNodeRecord[]>();
    const byId = new Map<string, NodesetNodeRecord>();
    for (const record of nodeRecords) byId.set(record.nodeId.toString(), record);
    for (const record of nodeRecords) {
        const parent = record.parentNodeId?.toString();
        if (parent && byId.has(parent)) {
            const list = childrenOf.get(parent);
            if (list) list.push(record);
            else childrenOf.set(parent, [record]);
        }
    }

    const converted = new Map<string, AnnexINode>();
    for (const record of nodeRecords) {
        const id = record.nodeId.toString();
        const childIds = new Set((childrenOf.get(id) ?? []).map((c) => c.nodeId.toString()));
        converted.set(id, toAnnexINode(record, namespaces, childIds));
    }

    // nest: a child is written inside its parent, in the order Objects, Variables, Methods
    const nested = new Set<string>();
    for (const [parentId, children] of childrenOf) {
        const parent = converted.get(parentId);
        if (!parent) continue;
        const list: AnnexIChildList = parent.Children ?? {};
        for (const kind of ANNEX_I_CHILD_ORDER) {
            for (const child of children) {
                if (CHILD_LIST_OF[child.nodeClass as number] !== kind) continue;
                const node = converted.get(child.nodeId.toString());
                if (!node) continue;
                const bucket = list[kind] ?? [];
                bucket.push(node);
                list[kind] = bucket;
                nested.add(child.nodeId.toString());
            }
        }
        if (Object.keys(list).length) parent.Children = list;
    }

    // partition the roots, then put every supertype before its subtypes
    const containers: AnnexINodeContainer = {};
    for (const record of nodeRecords) {
        const id = record.nodeId.toString();
        if (nested.has(id)) continue;
        const container = CONTAINER_OF[record.nodeClass as number];
        const node = converted.get(id);
        if (!container || !node) continue;
        const bucket = containers[container] ?? [];
        bucket.push(node);
        containers[container] = bucket;
    }
    for (const container of ANNEX_I_CONTAINER_ORDER) {
        const nodes = containers[container];
        if (nodes) containers[container] = orderBySupertype(nodes, nodeRecords, namespaces);
    }

    const declarations = forwardDeclarations(containers);

    const document: AnnexIUANodeSet = { Ordered: true, Models: modelsOf(header) };
    if (declarations.length) document.Declarations = declarations;
    document.Nodes = containers;
    return document;
}

/**
 * a container with every supertype before its subtypes.
 *
 * A stable sort would not do it: the relation is a tree, so this is a topological order that
 * keeps the original sequence wherever the tree does not constrain it. A cycle, which the type
 * hierarchy should never contain, degrades to the original order rather than looping.
 */
function orderBySupertype(nodes: AnnexINode[], records: NodesetNodeRecord[], namespaces: string[]): AnnexINode[] {
    const superOf = new Map<string, string>();
    const byRecord = new Map(records.map((r) => [formatAnnexINodeId(r.nodeId, namespaces), r]));
    for (const node of nodes) {
        const record = node.NodeId ? byRecord.get(node.NodeId) : undefined;
        if (!record) continue;
        for (const reference of record.references) {
            const type = reference.referenceType;
            // the inverse of HasSubtype points at the supertype
            if (!reference.isForward && type.namespace === 0 && type.value === HAS_SUBTYPE) {
                superOf.set(node.NodeId as string, formatAnnexINodeId(reference.nodeId, namespaces));
            }
        }
    }
    const present = new Set(nodes.map((n) => n.NodeId as string));
    const emitted = new Set<string>();
    const out: AnnexINode[] = [];
    const byNodeId = new Map(nodes.map((n) => [n.NodeId as string, n]));
    const visit = (id: string, guard: Set<string>) => {
        if (emitted.has(id) || guard.has(id)) return;
        guard.add(id);
        const parent = superOf.get(id);
        // a supertype from another model is outside this document and constrains nothing
        if (parent && present.has(parent)) visit(parent, guard);
        const node = byNodeId.get(id);
        if (node && !emitted.has(id)) {
            emitted.add(id);
            out.push(node);
        }
    };
    for (const node of nodes) visit(node.NodeId as string, new Set());
    return out;
}

/** the stubs a decoder needs for the relationships no ordering can resolve */
function forwardDeclarations(containers: AnnexINodeContainer): AnnexINode[] {
    const order: AnnexINode[] = [];
    const walk = (node: AnnexINode) => {
        order.push(node);
        for (const kind of ANNEX_I_CHILD_ORDER) {
            for (const child of node.Children?.[kind] ?? []) walk(child);
        }
    };
    for (const container of ANNEX_I_CONTAINER_ORDER) {
        for (const node of containers[container] ?? []) walk(node);
    }

    const position = new Map<string, number>();
    order.forEach((node, index) => {
        if (node.NodeId) position.set(node.NodeId, index);
    });

    const declared = new Map<string, AnnexINode>();
    order.forEach((node, index) => {
        for (const id of identifyingIds(node)) {
            const at = position.get(id);
            // only a node this document defines, and only when it comes later than the reference
            if (at !== undefined && at > index && !declared.has(id)) {
                declared.set(id, declarationOf(order[at]));
            }
        }
    });
    return [...declared.values()];
}

function modelsOf(header: NodesetHeaderRecord): AnnexIUANodeSet["Models"] {
    return header.models.map((model) => ({
        ModelUri: model.modelUri,
        Version: model.version,
        PublicationDate: model.publicationDate?.toISOString(),
        RequiredModels: model.requiredModels.map((required) => ({
            ModelUri: required.modelUri,
            Version: required.version,
            PublicationDate:
                required.publicationDate instanceof Date && !Number.isNaN(required.publicationDate.getTime())
                    ? required.publicationDate.toISOString()
                    : undefined
        }))
    }));
}
