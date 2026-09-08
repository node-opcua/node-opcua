/**
 * Annex I Nodes to the loader's records.
 *
 * The records are the loader's one intermediate form: whatever a document is written in, it
 * becomes a stream of them, and the address space, the NodeSet2 XML writer and the image writer
 * neither know nor ask. So this module is the whole of what "node-opcua reads Annex I" means.
 *
 * The one thing it has to *add* rather than translate is the two references the annex removes:
 *
 * > HasTypeDefinition References are not emitted for Objects and Variables.
 * > HasModellingRule References are not emitted.
 *
 * They are stated as the `TypeId` and `ModellingRuleId` fields instead, which is a better shape
 * for something single-valued and always forward. The address space still wants them as edges, so
 * they are put back here.
 */

import type {
    NodesetHeaderRecord,
    NodesetNodeRecord,
    NodesetReferenceRecord,
    NodesetRolePermissionRecord
} from "node-opcua-address-space";
import type { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import type { AnnexIModelDefinition, AnnexINode, AnnexIUANodeSet } from "./annex_i_types.js";
import { decodeAnnexIVariant, localizedTextValue, parseArrayDimensions } from "./annex_i_variant.js";
import { annexINamespaceTable, parseAnnexINodeId, parseAnnexIQualifiedName } from "./canonical_nodeid.js";

/** `HasTypeDefinition`, the reference `TypeId` stands in for */
const HAS_TYPE_DEFINITION = new NodeId(NodeIdType.NUMERIC, 40, 0);
/** `HasModellingRule`, the reference `ModellingRuleId` stands in for */
const HAS_MODELLING_RULE = new NodeId(NodeIdType.NUMERIC, 37, 0);

/** a date the loader treats as "not stated", which is what an absent or unparsable one means */
const invalidDate = () => new Date(Number.NaN);

function modelOf(model: AnnexIModelDefinition) {
    return {
        modelUri: model.ModelUri ?? "",
        version: model.Version ?? model.ModelVersion ?? "",
        publicationDate: model.PublicationDate ? new Date(model.PublicationDate) : undefined,
        requiredModels: (model.RequiredModels ?? []).map((required) => ({
            modelUri: required.ModelUri ?? "",
            version: required.Version ?? required.ModelVersion ?? "",
            publicationDate: required.PublicationDate ? new Date(required.PublicationDate) : invalidDate()
        }))
    };
}

/**
 * the header record, and the namespace table every later line is read against.
 *
 * The table is returned rather than kept, because it is the document's, not this module's: the
 * reader threads it through every node so that two documents read at once cannot confuse their
 * namespaces.
 */
export function annexIHeaderRecord(nodeSet: AnnexIUANodeSet): { record: NodesetHeaderRecord; namespaces: string[] } {
    const namespaces = annexINamespaceTable(nodeSet.Models);
    const record: NodesetHeaderRecord = {
        kind: "header",
        namespaceUris: namespaces,
        models: (nodeSet.Models ?? []).map(modelOf),
        // I.1: "No aliases: NodeId strings are always fully qualified; no alias substitution
        // table is provided." There is nothing to carry, and the records refer to none.
        aliases: {}
    };
    return { record, namespaces };
}

function rolePermissionsOf(node: AnnexINode, namespaces: string[]): NodesetRolePermissionRecord[] | undefined {
    if (!node.RolePermissions?.length) {
        return undefined;
    }
    return node.RolePermissions.map((permission) => ({
        roleId: parseAnnexINodeId(permission.RoleId ?? "", namespaces),
        permissions: permission.Permissions ?? 0
    }));
}

function referencesOf(node: AnnexINode, namespaces: string[]): NodesetReferenceRecord[] {
    const references: NodesetReferenceRecord[] = [];

    // the two the annex states as fields rather than edges, put back in the order a NodeSet2
    // document would have written them
    if (node.TypeId) {
        references.push({
            isForward: true,
            referenceType: HAS_TYPE_DEFINITION,
            nodeId: parseAnnexINodeId(node.TypeId, namespaces)
        });
    }
    if (node.ModellingRuleId) {
        references.push({
            isForward: true,
            referenceType: HAS_MODELLING_RULE,
            nodeId: parseAnnexINodeId(node.ModellingRuleId, namespaces)
        });
    }

    for (const reference of node.References ?? []) {
        references.push({
            // the annex writes the flag only to say "inverse", so an absent one is forward
            isForward: reference.IsForward !== false,
            referenceType: parseAnnexINodeId(reference.ReferenceTypeId ?? "", namespaces),
            nodeId: parseAnnexINodeId(reference.TargetId ?? "", namespaces)
            // inverseDeclared is deliberately left unset. A streaming reader has not seen the
            // rest of the document, and the loader checks at the end of the load when it is
            // absent. Annex I never writes the parent's forward edge to a child, so guessing
            // here would be guessing wrong on every hierarchical reference in the file.
        });
    }
    return references;
}

/**
 * one Node.
 *
 * Fields the records have no room for are dropped rather than smuggled: `WriteMask`,
 * `UserWriteMask`, `DesignToolOnly`, and a DataType's `Purpose`. That is a real and currently
 * one-way loss, and it is why this reader is not yet the basis for an Annex I *writer*.
 */
export function annexINodeRecord(node: AnnexINode, namespaces: string[]): NodesetNodeRecord {
    const record: NodesetNodeRecord = {
        kind: "node",
        nodeClass: (node.NodeClass ?? 0) as unknown as NodeClass,
        nodeId: parseAnnexINodeId(node.NodeId ?? "", namespaces),
        browseName: parseAnnexIQualifiedName(node.BrowseName ?? "", namespaces),
        references: referencesOf(node, namespaces)
    };

    const displayName = localizedTextValue(node.DisplayName);
    if (displayName !== undefined) record.displayName = displayName;
    const description = localizedTextValue(node.Description);
    if (description !== undefined) record.description = description;
    const inverseName = localizedTextValue(node.InverseName);
    if (inverseName !== undefined) record.inverseName = inverseName;

    if (node.SymbolicName !== undefined) record.symbolicName = node.SymbolicName;
    if (node.Documentation !== undefined) record.documentation = node.Documentation;
    // the annex calls them ConformanceUnits; the XML calls the same thing Category, and the
    // records follow the XML because that is what they are read back out as
    if (node.ConformanceUnits?.length) record.category = [...node.ConformanceUnits];
    if (node.ReleaseStatus === "Draft" || node.ReleaseStatus === "Deprecated") record.releaseStatus = node.ReleaseStatus;
    if (node.IsAbstract !== undefined) record.isAbstract = node.IsAbstract;
    if (node.HasNoPermissions !== undefined) record.hasNoPermissions = node.HasNoPermissions;
    // the XML attribute is text, so the records keep text; the annex makes it a number
    if (node.AccessRestrictions !== undefined && node.AccessRestrictions !== null) {
        record.accessRestrictions = String(node.AccessRestrictions);
    }
    const rolePermissions = rolePermissionsOf(node, namespaces);
    if (rolePermissions) record.rolePermissions = rolePermissions;

    if (node.EventNotifier !== undefined) record.eventNotifier = node.EventNotifier;
    if (node.ContainsNoLoops !== undefined) record.containsNoLoops = node.ContainsNoLoops;
    if (node.Symmetric !== undefined) record.symmetric = node.Symmetric;

    if (node.ParentId) record.parentNodeId = parseAnnexINodeId(node.ParentId, namespaces);
    if (node.MethodDeclarationId) record.methodDeclarationId = parseAnnexINodeId(node.MethodDeclarationId, namespaces);
    if (node.DataType) record.dataType = parseAnnexINodeId(node.DataType, namespaces);
    // I.13: "If omitted, the ValueRank is Scalar (-1)." The XML reader materialises that default
    // too, and the address space synthesises a different initial value without it
    if (node.ValueRank !== undefined) {
        record.valueRank = node.ValueRank;
    } else if (node.NodeClass === 2 || node.NodeClass === 16) {
        record.valueRank = -1;
    }
    const arrayDimensions = parseArrayDimensions(node.ArrayDimensions);
    if (arrayDimensions) record.arrayDimensions = arrayDimensions;
    if (node.MinimumSamplingInterval !== undefined) record.minimumSamplingInterval = node.MinimumSamplingInterval;
    if (node.Historizing !== undefined) record.historizing = node.Historizing;
    if (node.AccessLevel !== undefined) record.accessLevel = String(node.AccessLevel);
    if (node.UserAccessLevel !== undefined) record.userAccessLevel = String(node.UserAccessLevel);

    const value = decodeAnnexIVariant(node.Value, namespaces);
    if (value) record.value = value;

    if (node.Definition) {
        record.definition = {
            // "A DataTypeDefinition carries no Name. The BrowseName of the containing DataType
            // is the normative source, and the XML Definition/@Name attribute is restored from
            // it." The records carry the name because the XML writer needs it back.
            name: record.browseName.name ?? undefined,
            isUnion: node.Definition.IsUnion,
            isOptionSet: node.Definition.IsOptionSet,
            fields: (node.Definition.Fields ?? []).map((field) => {
                const description = localizedTextValue(field.Description);
                return {
                    name: field.Name ?? "",
                    ...(description !== undefined ? { description } : {}),
                    value: field.Value,
                    dataType: field.DataType ? parseAnnexINodeId(field.DataType, namespaces) : undefined,
                    valueRank: field.ValueRank,
                    arrayDimensions: parseArrayDimensions(field.ArrayDimensions),
                    maxStringLength: field.MaxStringLength,
                    // Part 3 8.51 gives isOptional a second meaning on a subtyped structure, so
                    // AllowSubTypes rides the same field rather than getting one of its own
                    isOptional: field.IsOptional ?? field.AllowSubTypes
                };
            })
        };
    }

    return record;
}
