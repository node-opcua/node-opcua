/**
 * @module node-opcua-address-space
 *
 * A namespace as a record producer: `namespace.toNodesetRecords()` yields the header record and
 * one record per node, the same records the XML loader yields for the equivalent NodeSet2 file,
 * in the order `toNodeset2XML` writes its elements. Any consumer of records (the image writer,
 * a loader, a diff) then works on a live namespace, whether it came from a file, from code or
 * from the modeler.
 *
 * Ids are translated to the exported file's own namespace table, as in the XML export: the
 * dependency set of the namespace in loading order, 0 for the UA namespace.
 */
import type {
    BaseNode,
    IAddressSpace,
    INamespace,
    UADataType,
    UAObject,
    UAReference,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space-base";
import { AttributeIds, coerceInt64, type Int64 } from "node-opcua-basic-types";
import { DataTypeIds, ObjectIds, VariableIds } from "node-opcua-constants";
import { Range } from "node-opcua-data-access";
import {
    BrowseDirection,
    LocalizedText,
    makeAccessLevelFlag,
    makeNodeClassMask,
    makeResultMask,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import type { ExtensionObject } from "node-opcua-extension-object";
import { ExpandedNodeId, NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import {
    Argument,
    BrowseDescription,
    EnumValueType,
    EUInformation,
    type StructureDefinition,
    StructureType
} from "node-opcua-types";
import { isNullOrUndefined } from "node-opcua-utils";
import { DataType, Variant, VariantArrayType, type VariantOptions } from "node-opcua-variant";
import XMLWriter from "xml-writer";
import { makeDefinitionMap } from "../../api/loader/decode_xml_extension_object.js";
import type { DefinitionMap2 } from "../../api/loader/make_xml_extension_object_parser.js";
import { NodesetImageWriter, type NodesetImageWriterOptions } from "../../api/loader/nodeset_image.js";
import {
    type NodesetDataTypeDefinitionRecord,
    type NodesetDefinitionField,
    type NodesetHeaderRecord,
    type NodesetNodeRecord,
    type NodesetRecord,
    type NodesetReferenceRecord,
    XmlExtensionObjectFragment
} from "../../api/loader/nodeset_record.js";
import { sha256Hex } from "../../api/loader/nodeset_source.js";
import type { XmlWriter } from "../../api/xml_writer.js";
import { type BaseNodeImpl, getReferenceType } from "../base_node_impl.js";
import { NamespaceImpl } from "../namespace_impl.js";
import { ReferenceImpl } from "../reference_impl.js";
import { UAMethodImpl } from "../ua_method_impl.js";
import { UAObjectImpl } from "../ua_object_impl.js";
import { UAVariableImpl } from "../ua_variable_impl.js";
import type { UAVariableTypeImpl } from "../ua_variable_type_impl.js";
import {
    _constructNamespaceTranslationTable,
    constructNamespaceDependency,
    constructNamespacePriorityTable
} from "./construct_namespace_dependency.js";
import {
    _dumpVariantExtensionObjectValue_Body,
    coerceInt64ToInt32,
    initXmlWriterEx,
    makeTypeXsd,
    sortByBrowseName
} from "./nodeset_to_xml.js";

const warningLog = make_warningLog("nodeset_to_records");

export interface ToNodesetRecordsOptions {
    /**
     * a loaded node carries no release status, so these have no effect today; they are the
     * mirror of the loader's `loadDraftNodes` and `loadDeprecatedNodes` for a future that keeps it
     */
    includeDraft?: boolean;
    includeDeprecated?: boolean;
}

/** the order the exporters list nodes in: by NodeId string, what the XML writer sorted by all along */
export const sortByNodeId = (a: { nodeId: NodeId }, b: { nodeId: NodeId }): number =>
    a.nodeId.toString() < b.nodeId.toString() ? -1 : 1;
const currentReadFlag = makeAccessLevelFlag("CurrentRead");

/** what the exporter cannot turn into a record: named by the node so that the caller can act */
export class NodesetExportError extends Error {}

/**
 * a comment the XML export writes at a point of the walk (a section, the start or end of an
 * object); not a record: the image writer and the loader never see one
 */
export interface SectionMarker {
    kind: "section";
    text: string;
}
export type NodesetWalkEvent = NodesetRecord | SectionMarker;

class RecordExporter {
    private readonly addressSpace: IAddressSpace;
    private readonly priorityTable: number[];
    private readonly dependency: INamespace[];
    private readonly sortedDependencies: INamespace[];
    private readonly translationTable: Map<number, number>;
    private readonly namespaceArray: string[];
    private readonly namespacesMap: Record<string, string>;
    private readonly definitionMap: DefinitionMap2;
    private readonly visited = new Set<string>();
    private readonly records: NodesetWalkEvent[] = [];

    private section(text: string): void {
        this.records.push({ kind: "section", text });
    }

    constructor(private readonly namespace: NamespaceImpl) {
        const addressSpace = namespace.addressSpace;
        this.addressSpace = addressSpace;
        this.priorityTable = constructNamespacePriorityTable(addressSpace).priorityTable;
        this.dependency = constructNamespaceDependency(namespace, this.priorityTable);
        this.translationTable = _constructNamespaceTranslationTable(this.dependency, namespace) as Map<number, number>;
        this.sortedDependencies = [...this.dependency].sort((a, b) =>
            (this.translationTable.get(a.index) ?? 0) > (this.translationTable.get(b.index) ?? 0) ? 1 : -1
        );
        const namespaceArrayNode = addressSpace.findNode(VariableIds.Server_NamespaceArray);
        this.namespaceArray = namespaceArrayNode ? namespaceArrayNode.readAttribute(null, AttributeIds.Value).value.value : [];
        this.namespacesMap = {
            "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd": "",
            "http://opcfoundation.org/UA/2008/02/Types.xsd": "uax",
            "http://www.w3.org/2001/XMLSchema-instance": "xsi"
        };
        for (const dependency of this.dependency) {
            if (dependency.index === 0) continue;
            this.namespacesMap[dependency.namespaceUri] = `ns${this.translationTable.get(dependency.index)}`;
        }
        this.definitionMap = makeDefinitionMap(addressSpace);
    }

    // #region ids
    private t(nodeId: NodeId): NodeId {
        const namespace = this.translationTable.get(nodeId.namespace);
        if (namespace === undefined) {
            throw new NodesetExportError(
                `namespace ${nodeId.namespace} of ${nodeId.toString()} is not in the dependency set of ${this.namespace.namespaceUri}`
            );
        }
        if (nodeId instanceof ExpandedNodeId) {
            return new ExpandedNodeId(nodeId.identifierType, nodeId.value, namespace, nodeId.namespaceUri, nodeId.serverIndex);
        }
        return new NodeId(nodeId.identifierType, nodeId.value, namespace);
    }
    private tq(browseName: QualifiedName): QualifiedName {
        return new QualifiedName({ namespaceIndex: this.translationTable.get(browseName.namespaceIndex), name: browseName.name });
    }
    /** the browse name as the XML writes it: `ns=0;` dropped */
    private b(browseName: QualifiedName): string {
        return this.tq(browseName).toString().replace("ns=0;", "");
    }
    private hash(node: { nodeId: NodeId }): string {
        return node.nodeId.toString();
    }
    private hasHigherPriorityThan(namespaceIndex1: number, namespaceIndex2: number): boolean {
        return this.priorityTable[namespaceIndex1] > this.priorityTable[namespaceIndex2];
    }
    // #endregion

    /** the events of one node and what the walk brings with it (type, supertype, children); no header */
    public walkFrom(node: BaseNode): NodesetWalkEvent[] {
        this.dumpNode(node);
        return this.records;
    }

    /** the exported file's namespace table, address-space index to file index */
    public get translation(): Map<number, number> {
        return this.translationTable;
    }

    public run(): NodesetWalkEvent[] {
        const namespace = this.namespace;
        this.records.push(this.header());

        this.section("ReferenceTypes");
        const referenceTypes = [...namespace._referenceTypeIterator()].sort(sortByBrowseName);
        for (const referenceType of referenceTypes) {
            this.dumpReferenceType(referenceType);
        }

        const dataTypes = [...namespace._dataTypeIterator()].sort(sortByBrowseName);
        if (dataTypes.length) {
            this.section("DataTypes");
            for (const dataType of dataTypes.sort(sortByNodeId)) {
                if (!this.visited.has(this.hash(dataType))) {
                    this.dumpNode(dataType);
                }
            }
            this.dumpDictionaries();
        }

        this.section("ObjectTypes");
        const objectTypes = [...namespace._objectTypeIterator()].sort(sortByBrowseName);
        for (const objectType of objectTypes.sort(sortByNodeId)) {
            if (!this.visited.has(this.hash(objectType))) {
                this.dumpNode(objectType);
            }
        }
        this.section("VariableTypes");
        const variableTypes = [...namespace._variableTypeIterator()].sort(sortByBrowseName);
        for (const variableType of variableTypes.sort(sortByNodeId)) {
            if (!this.visited.has(this.hash(variableType))) {
                this.dumpNode(variableType);
            }
        }
        this.section("Other Nodes");
        const nodes = [...namespace.nodeIterator()].sort(sortByBrowseName);
        for (const node of nodes.sort(sortByNodeId)) {
            if (!this.visited.has(this.hash(node))) {
                this.dumpNode(node);
            }
        }
        return this.records;
    }

    // #region header
    private header(): NodesetHeaderRecord {
        const namespace = this.namespace;
        const namespaceUris = this.sortedDependencies.filter((d) => d.index !== 0).map((d) => d.namespaceUri);
        const requiredModels = this.sortedDependencies
            .filter((d) => d.index !== namespace.index)
            .map((d) => ({ modelUri: d.namespaceUri, version: d.version, publicationDate: d.publicationDate }));
        const aliases: Record<string, NodeId> = {};
        const aliasesVisited = new Set<string>();
        for (const node of namespace.nodeIterator()) {
            this.buildUpAliases(node, aliases, aliasesVisited);
        }
        // sorted by name, as the XML writes them: two exports of one namespace are diffable line by line
        const sortedAliases: Record<string, NodeId> = {};
        for (const key of Object.keys(aliases).sort()) sortedAliases[key] = aliases[key];
        return {
            kind: "header",
            namespaceUris,
            models: [
                {
                    modelUri: namespace.namespaceUri,
                    version: namespace.version,
                    publicationDate: namespace.publicationDate,
                    requiredModels
                }
            ],
            aliases: sortedAliases
        };
    }

    private buildUpAliases(node: BaseNode, aliases: Record<string, NodeId>, aliasesVisited: Set<string>): void {
        const k = this.hash(node);
        if (aliasesVisited.has(k)) return;
        aliasesVisited.add(k);
        if (node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.VariableType) {
            const nodeV = node as UAVariableType | UAVariable;
            if (nodeV.dataType && nodeV.dataType.value !== 0) {
                const dataTypeName = this.b(this.resolveDataTypeName(nodeV.dataType));
                if (dataTypeName && !aliases[dataTypeName]) {
                    aliases[dataTypeName] = this.t(nodeV.dataType);
                }
            }
        }
        for (const reference of node.allReferences()) {
            const key = this.b(getReferenceType(reference).browseName);
            // the XML export overwrites a reference-type alias each time it meets it; same value every time
            aliases[key] = this.t(reference.referenceType);
        }
    }

    private resolveDataTypeName(dataType: NodeId): QualifiedName {
        const dataTypeNode = this.addressSpace.findNode(dataType);
        if (!dataTypeNode) {
            warningLog(`resolveDataTypeName: cannot find DataType ${dataType.toString()}`);
            return new QualifiedName({ name: "", namespaceIndex: 0 });
        }
        return dataTypeNode.browseName;
    }
    // #endregion

    // #region references and common fields
    private referencesOf(node: BaseNode): NodesetReferenceRecord[] {
        const addressSpace = this.addressSpace;
        const must = (name: string) => {
            const referenceType = addressSpace.findReferenceType(name);
            if (!referenceType)
                throw new NodesetExportError(`Cannot find standard reference type ${name}: please check your nodeset file`);
            return referenceType;
        };
        const aggregates = must("Aggregates");
        const hasSubtype = must("HasSubtype");
        const hasTypeDefinition = must("HasTypeDefinition");
        const nonHierarchical = must("NonHierarchicalReferences");
        const organizes = must("Organizes");
        const connectsTo = addressSpace.findReferenceType("ConnectsTo");
        const hasEventSource = must("HasEventSource");

        const keep = (reference: UAReference): boolean => {
            // resolved here: a reference nobody has looked at since the load carries only the NodeId of its type
            const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);
            if (!referenceType) return false;
            if (
                referenceType.isSubtypeOf(aggregates) &&
                !reference.isForward &&
                reference.nodeId.namespace !== node.nodeId.namespace
            )
                return true;
            if (referenceType.isSubtypeOf(aggregates) && reference.isForward) {
                return !this.hasHigherPriorityThan(reference.nodeId.namespace, node.nodeId.namespace);
            }
            if (referenceType.isSubtypeOf(hasSubtype) && !reference.isForward) return true;
            if (referenceType.isSubtypeOf(hasTypeDefinition) && reference.isForward) return true;
            if (referenceType.isSubtypeOf(nonHierarchical) && reference.isForward) return true;
            if (referenceType.isSubtypeOf(organizes) && !reference.isForward) return true;
            if (connectsTo && referenceType.isSubtypeOf(connectsTo) && reference.isForward) return true;
            if (referenceType.isSubtypeOf(hasEventSource) && reference.isForward) return true;
            return false;
        };
        // the node's own order: the XML writer sorts them when it writes, a reload keeps them as they were
        const references = node.allReferences().filter(keep);
        const out: NodesetReferenceRecord[] = [];
        for (const reference of references) {
            if (getReferenceType(reference).browseName.toString() === "HasSubtype" && reference.isForward) continue;
            out.push({
                isForward: reference.isForward,
                referenceType: this.t(reference.referenceType),
                nodeId: this.t(reference.nodeId)
            });
        }
        return out;
    }

    private parentOf(node: BaseNode): BaseNode | null {
        if (node instanceof UAVariableImpl || node instanceof UAMethodImpl || node instanceof UAObjectImpl) {
            return node.parent;
        }
        return null;
    }

    /** what `dumpCommonAttributes` and `dumpCommonElements` write, for every class */
    private common(node: BaseNode): NodesetNodeRecord {
        const record: NodesetNodeRecord = {
            kind: "node",
            nodeClass: node.nodeClass,
            nodeId: this.t(node.nodeId),
            browseName: this.tq(node.browseName),
            references: this.referencesOf(node)
        };
        if (node.releaseStatus) {
            record.releaseStatus = node.releaseStatus;
        }
        const parentNode = this.parentOf(node);
        if (parentNode && parentNode.nodeId.namespace <= node.nodeId.namespace) {
            record.parentNodeId = this.t(parentNode.nodeId);
        }
        if (Object.hasOwn(node, "symbolicName")) {
            const symbolicName = (node as unknown as { symbolicName?: string | null }).symbolicName;
            if (symbolicName) record.symbolicName = symbolicName;
        }
        if (Object.hasOwn(node, "isAbstract") && (node as unknown as { isAbstract: boolean }).isAbstract) {
            record.isAbstract = true;
        }
        if (node.nodeClass === NodeClass.Variable) {
            const variable = node as UAVariable;
            if (variable.accessLevel !== currentReadFlag) record.accessLevel = variable.accessLevel.toString();
            if (variable.userAccessLevel !== undefined && variable.userAccessLevel !== variable.accessLevel) {
                record.userAccessLevel = variable.userAccessLevel.toString();
            }
        }
        // the declared spelling first: the loader's accessRestrictions option governs what is
        // enforced, not what the document said, and only the latter belongs in an export
        const accessRestrictions = node.declaredAccessRestrictions ?? node.accessRestrictions?.toString();
        if (accessRestrictions !== undefined) record.accessRestrictions = accessRestrictions;
        if (node.rolePermissions !== undefined && node.rolePermissions.length === 0) record.hasNoPermissions = true;
        if (Object.hasOwn(node, "minimumSamplingInterval")) {
            const minimumSamplingInterval = (node as UAVariable).minimumSamplingInterval;
            if (minimumSamplingInterval > 0) record.minimumSamplingInterval = minimumSamplingInterval;
        }
        if (node.nodeClass === NodeClass.Variable && (node as UAVariable).historizing) record.historizing = true;

        if (node.displayName?.[0]) record.displayName = node.displayName[0].text || "";
        if (node.description?.text?.length) record.description = node.description.text;
        if (node.rolePermissions && node.rolePermissions.length > 0) {
            record.rolePermissions = node.rolePermissions.map((p) => ({ roleId: this.t(p.roleId), permissions: p.permissions }));
        }
        return record;
    }
    // #endregion

    // #region the walk
    private markVisited(node: BaseNode): void {
        const k = this.hash(node);
        if (this.visited.has(k)) throw new NodesetExportError(`${node.nodeId.toString()} exported twice`);
        this.visited.add(k);
    }

    private dumpNode(node: BaseNode): void {
        switch (node.nodeClass) {
            case NodeClass.Object:
                this.dumpObject(node as UAObject);
                break;
            case NodeClass.Variable:
                this.dumpVariable(node as UAVariable);
                break;
            case NodeClass.Method:
                this.dumpMethod(node as UAMethodImpl);
                break;
            case NodeClass.ObjectType:
                this.dumpObjectType(node);
                break;
            case NodeClass.VariableType:
                this.dumpVariableType(node as UAVariableType);
                break;
            case NodeClass.DataType:
                this.dumpDataType(node as UADataType);
                break;
            case NodeClass.ReferenceType:
                this.dumpReferenceType(node as BaseNode & { inverseName?: LocalizedText | null });
                break;
            case NodeClass.View:
                this.dumpView(node);
                break;
            default:
                throw new NodesetExportError(`${node.nodeId.toString()}: unexpected node class ${node.nodeClass}`);
        }
    }

    /** the type definition and the supertype of a node, when they belong to the same namespace and are not out yet */
    private dumpReferencedNodes(node: BaseNode): void {
        const addressSpace = this.addressSpace;
        const typeDefinitions = node.findReferencesEx("HasTypeDefinition");
        if (typeDefinitions?.length) {
            const typeDefinition = ReferenceImpl.resolveReferenceNode(addressSpace, typeDefinitions[0]) as BaseNode | null;
            if (!typeDefinition) {
                warningLog(
                    `dumpReferencedNodes: ${node.browseName.toString()} unknown typeDefinition ${typeDefinitions[0].toString()}`
                );
            } else if (typeDefinition.nodeId.namespace === node.nodeId.namespace && !this.visited.has(this.hash(typeDefinition))) {
                this.dumpNode(typeDefinition);
            }
        }
        const supertypes = node.findReferencesEx("HasSubtype", BrowseDirection.Inverse);
        if (supertypes?.length) {
            const supertype = ReferenceImpl.resolveReferenceNode(addressSpace, supertypes[0]) as BaseNode | null;
            if (supertype && supertype.nodeId.namespace === node.nodeId.namespace && !this.visited.has(this.hash(supertype))) {
                this.dumpNode(supertype);
            }
        }
    }

    private dumpAggregates(node: BaseNode): void {
        const aggregates = node.getAggregates().sort(sortByBrowseName);
        for (const aggregate of aggregates.sort(sortByNodeId)) {
            if (node.nodeId.namespace !== aggregate.nodeId.namespace) continue;
            if (this.hasHigherPriorityThan(aggregate.nodeId.namespace, node.nodeId.namespace)) continue;
            if (!this.visited.has(this.hash(aggregate))) this.dumpNode(aggregate);
        }
    }

    private dumpElementsInFolder(node: BaseNodeImpl): void {
        const elements = node
            .getFolderElements()
            .sort((x: BaseNode, y: BaseNode) =>
                (x?.browseName.name?.toString() || 0) > (y?.browseName.name?.toString() || 0) ? 1 : -1
            );
        for (const element of elements.sort(sortByNodeId)) {
            // the XML export stops at the first element of another namespace; kept, so that both agree
            if (node.nodeId.namespace !== element.nodeId.namespace) return;
            if (!this.visited.has(this.hash(element))) this.dumpNode(element);
        }
    }

    private dumpReferenceType(node: BaseNode & { inverseName?: LocalizedText | null }): void {
        this.markVisited(node);
        const record = this.common(node);
        const isSymmetric = !node.inverseName || node.inverseName?.text === node.browseName?.name;
        if (isSymmetric) {
            record.symmetric = true;
        } else {
            record.inverseName = node.inverseName?.text || "";
        }
        this.records.push(record);
    }

    private dumpDataType(node: UADataType): void {
        this.markVisited(node);
        const record = this.common(node);
        // as the XML: the symbolic name only when it differs from the browse name
        if (node.symbolicName !== node.browseName.name) record.symbolicName = node.symbolicName;
        else delete record.symbolicName;
        if (node.isAbstract) record.isAbstract = true;
        const definition = this.definitionOf(node);
        if (definition) record.definition = definition;
        this.records.push(record);
        // the encodings, then the aggregates
        // in the order the references were added, as the XML export always walked them; a record
        // stream keeps that order in its references, so a reload reproduces it
        for (const encoding of node.findReferencesExAsObject("HasEncoding", BrowseDirection.Forward)) {
            if (encoding.nodeClass !== NodeClass.Object) continue;
            const description = encoding.findReferencesAsObject("HasDescription")[0];
            if (description) this.dumpVariable(description as UAVariable);
            this.dumpObjectInner(encoding as UAObject);
        }
        this.dumpAggregates(node);
    }

    /** the fields as the XML loader's definition parser shapes them: an absent rank is -1, an absent type BaseDataType */
    private definitionOf(node: UADataType): NodesetDataTypeDefinitionRecord | undefined {
        const baseDataType = this.t(resolveNodeId(DataTypeIds.BaseDataType));
        // an OptionSet is neither an enumeration nor a structure to node-opcua -- it is a plain
        // UInt16 or UInt32 subtype -- so the only account of it is the one the loader kept
        const asImpl = node as unknown as {
            isOptionSetDataType?: boolean;
            declaredDefinitionFields?: NodesetDefinitionField[];
            declaredDefinitionName?: string;
        };
        // what the document called this definition, or -- for a DataType built here, which never
        // had a declaration -- the browse name, which is the only name available
        const definitionName = asImpl.declaredDefinitionName ?? this.b(node.browseName);
        if (asImpl.isOptionSetDataType && asImpl.declaredDefinitionFields) {
            const fields = asImpl.declaredDefinitionFields.map((f) => {
                const field: NodesetDefinitionField = { ...f, allowSubTypes: f.allowSubTypes ?? false };
                field.valueRank = f.valueRank ?? -1;
                field.dataType = f.dataType ? this.t(f.dataType as unknown as NodeId) : baseDataType;
                return field;
            });
            return { name: definitionName, isOptionSet: true, fields };
        }
        if (node.isEnumeration()) {
            const enumDefinition = node.getEnumDefinition();
            const fields: NodesetDefinitionField[] = (enumDefinition.fields || []).map((f) => {
                const field: NodesetDefinitionField = { name: f.name as string, allowSubTypes: false };
                if (f.description?.text?.length) field.description = { text: f.description.text } as unknown as string;
                if (!isNullOrUndefined(f.value)) field.value = coerceInt64ToInt32(f.value as Int64);
                field.valueRank = -1;
                field.dataType = baseDataType;
                return field;
            });
            return { name: definitionName, fields };
        }
        if (node.isStructure()) {
            const definition = node.getStructureDefinition();
            // a structure's supertype need not be a structure: `Structure` itself subtypes BaseDataType,
            // which has no definition at all. Asking it for one threw, and took the whole export with it
            const baseNode = node.subtypeOfObj as UADataType | null;
            const base = baseNode?.isStructure() ? baseNode.getStructureDefinition() : null;
            const nbFieldsInBase = base ? base.fields?.length || 0 : 0;
            // Part 3 8.51: in a *WithSubtypedValues structure, isOptional does not mean optional --
            // it is where "subtyping allowed" is held. The document spells that AllowSubTypes, and
            // says nothing about IsOptional there, so the two must be swapped back on the way out
            const subtypedValues =
                definition.structureType === StructureType.StructureWithSubtypedValues ||
                definition.structureType === StructureType.UnionWithSubtypedValues;
            const fields: NodesetDefinitionField[] = [];
            const all = definition.fields || [];
            for (let index = nbFieldsInBase; index < all.length; index++) {
                const f = all[index];
                const field: NodesetDefinitionField = {
                    name: f.name as string,
                    allowSubTypes: subtypedValues
                        ? !!f.isOptional
                        : !!(f as unknown as { allowSubTypes?: boolean }).allowSubTypes
                };
                if (f.description?.text?.length) field.description = { text: f.description.text } as unknown as string;
                field.valueRank = f.valueRank === undefined || f.valueRank === -1 ? -1 : f.valueRank;
                if (f.arrayDimensions && f.arrayDimensions.length > 0) field.arrayDimensions = f.arrayDimensions;
                if (f.isOptional && !subtypedValues) field.isOptional = f.isOptional;
                if (f.maxStringLength !== undefined && f.maxStringLength !== 0) field.maxStringLength = f.maxStringLength;
                field.dataType = f.dataType && !f.dataType.isEmpty() ? this.t(f.dataType) : baseDataType;
                fields.push(field);
            }
            const record: NodesetDataTypeDefinitionRecord = { name: definitionName, fields };
            if (definition.structureType === StructureType.Union) record.isUnion = true;
            return record;
        }
        return undefined;
    }

    private dumpVariable(node: UAVariable): void {
        if (this.visited.has(this.hash(node))) return;
        this.markVisited(node);
        this.dumpReferencedNodes(node);
        const record = this.common(node);
        if (node.valueRank !== -1) record.valueRank = node.valueRank;
        this.arrayDimensionsOf(node, record);
        if (this.addressSpace.findNode(node.dataType)) record.dataType = this.t(node.dataType);
        const dataValue = (node as UAVariableImpl).$dataValue;
        // a value the loader made up for a variable the document left unvalued is not the document's
        // to write back; see valueWasSynthesized in nodeset_record_applier
        const synthesized = (node as unknown as { valueWasSynthesized?: boolean }).valueWasSynthesized;
        if (dataValue?.value && !synthesized && !dataValue.statusCode.equals(StatusCodes.BadWaitingForInitialData)) {
            const value = this.valueOf(node, dataValue.value);
            if (value) record.value = value;
        }
        this.records.push(record);
        this.dumpAggregates(node);
    }

    private dumpVariableType(node: UAVariableType): void {
        this.markVisited(node);
        this.dumpReferencedNodes(node);
        const record = this.common(node);
        if (node.valueRank !== -1) record.valueRank = node.valueRank;
        if (this.addressSpace.findNode(node.dataType)) record.dataType = this.t(node.dataType);
        this.arrayDimensionsOf(node, record);
        const value = (node as UAVariableTypeImpl).value as Variant | undefined;
        if (value) {
            const exported = this.valueOf(node, value);
            if (exported) record.value = exported;
        }
        this.records.push(record);
        this.dumpAggregates(node);
    }

    private arrayDimensionsOf(node: UAVariable | UAVariableType, record: NodesetNodeRecord): void {
    // ArrayDimensions="0" is written only when the document declared it: node-opcua synthesizes [0]
        // on the variables it generates, so writing it unconditionally would invent the attribute on
        // every generated node. See arrayDimensionsWereDeclared in nodeset_record_applier
        if (!node.arrayDimensions || node.valueRank <= 0) return;
        // all-zero dimensions are what node-opcua synthesizes when nobody declared any, at whatever
        // rank: [0] for a one-dimensional value, [0,0] for a matrix
        const degenerate = node.arrayDimensions.every((d) => d === 0);
        if (degenerate && !(node as unknown as { arrayDimensionsWereDeclared?: boolean }).arrayDimensionsWereDeclared) return;
        record.arrayDimensions = node.arrayDimensions;
    }

    private dumpObject(node: UAObject): void {
        this.section(`Object - ${this.b(node.browseName)} {{{{ `);
        this.dumpObjectInner(node);
        this.dumpElementsInFolder(node as unknown as BaseNodeImpl);
        this.section(`Object - ${this.b(node.browseName)} }}}} `);
    }
    private dumpObjectInner(node: UAObject): void {
        this.markVisited(node);
        this.dumpReferencedNodes(node);
        const record = this.common(node);
        // typeof, not truthiness: a node with a child called "EventNotifier" resolves the name to that
        // child through the shared child accessors, so this is a BaseNode there, not the attribute
        if (typeof node.eventNotifier === "number" && node.eventNotifier !== 0) record.eventNotifier = node.eventNotifier;
        this.records.push(record);
        this.dumpAggregates(node);
    }

    private dumpObjectType(node: BaseNode): void {
        this.section(`ObjectType - ${this.b(node.browseName)} {{{{ `);
        this.markVisited(node);
        this.dumpReferencedNodes(node);
        const record = this.common(node);
        // typeof, not truthiness: a node with a child called "EventNotifier" resolves the name to that
        // child through the shared child accessors, so this is a BaseNode there, not the attribute
        const eventNotifier = (node as unknown as { eventNotifier?: unknown }).eventNotifier;
        if (typeof eventNotifier === "number" && eventNotifier !== 0) record.eventNotifier = eventNotifier;
        this.records.push(record);
        this.dumpAggregates(node);
        this.section(`ObjectType - ${this.b(node.browseName)} }}}}`);
    }

    private dumpMethod(node: UAMethodImpl): void {
        this.markVisited(node);
        this.dumpReferencedNodes(node);
        const record = this.common(node);
        if (node.methodDeclarationId) record.methodDeclarationId = this.t(node.methodDeclarationId);
        this.records.push(record);
        this.dumpAggregates(node);
    }

    private dumpView(node: BaseNode): void {
        this.markVisited(node);
        const record = this.common(node);
        const view = node as unknown as { containsNoLoops?: boolean; eventNotifier?: unknown };
        if (view.containsNoLoops) record.containsNoLoops = true;
        if (typeof view.eventNotifier === "number" && view.eventNotifier !== 0) record.eventNotifier = view.eventNotifier;
        this.records.push(record);
        this.dumpAggregates(node);
    }

    /** the data type dictionaries of the namespace, after its data types, as the XML export */
    private dumpDictionaries(): void {
        const addressSpace = this.addressSpace;
        const describe = (typeSystem: UAObject) => {
            const nodeToBrowse = new BrowseDescription({
                browseDirection: BrowseDirection.Forward,
                includeSubtypes: false,
                nodeClassMask: makeNodeClassMask("Variable"),
                nodeId: typeSystem.nodeId,
                referenceTypeId: resolveNodeId("HasComponent"),
                resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
            });
            return typeSystem.browseNode(nodeToBrowse).filter((r) => r.nodeId.namespace === this.namespace.index);
        };
        for (const typeSystemId of [ObjectIds.OPCBinarySchema_TypeSystem, ObjectIds.XmlSchema_TypeSystem]) {
            const typeSystem = addressSpace.findNode(typeSystemId) as UAObject | null;
            if (!typeSystem) continue;
            const result = describe(typeSystem);
            if (result.length !== 1) continue;
            const dictionary = addressSpace.findNode(result[0].nodeId) as UAVariable | null;
            if (!dictionary) continue;
            this.section(typeSystemId === ObjectIds.OPCBinarySchema_TypeSystem ? "DataSystem - Binary" : "DataSystem - Xml");
            for (const component of dictionary.getComponents()) {
                if (!this.visited.has(this.hash(component))) this.dumpNode(component);
            }
            if (!this.visited.has(this.hash(dictionary))) this.dumpNode(dictionary);
        }
    }
    // #endregion

    // #region values
    private valueOf(node: UAVariable | UAVariableType, variant: Variant): VariantOptions | undefined {
        if (!(variant instanceof Variant)) return undefined;
        if (variant.dataType === DataType.Null) return undefined;
        // a null value is nothing to write down, whatever its declared data type
        if (variant.value === null || variant.value === undefined) return undefined;
        if (!this.addressSpace.findDataType(node.dataType)) return undefined;
        // no _isDefaultValue test here: it dropped every zero and every empty string, which threw
        // away the ones the document actually declared in order to suppress the ones the loader
        // made up. valueWasSynthesized now separates the two, so a declared "" survives the trip
        const element = (v: unknown) => this.elementOf(node, variant.dataType, v);
        const out: VariantOptions = { dataType: variant.dataType, arrayType: variant.arrayType };
        if (variant.arrayType === VariantArrayType.Scalar) {
            out.value = element(variant.value);
        } else {
            out.value = Array.from(variant.value as ArrayLike<unknown>, element);
            if (variant.arrayType === VariantArrayType.Matrix) out.dimensions = variant.dimensions;
        }
        return out;
    }

    private elementOf(node: UAVariable | UAVariableType, dataType: DataType, value: unknown): unknown {
        if (value === null || value === undefined) return null;
        switch (dataType) {
            case DataType.NodeId:
            case DataType.ExpandedNodeId:
                return value instanceof NodeId ? this.t(value) : value;
            case DataType.QualifiedName:
                return value instanceof QualifiedName ? this.tq(value) : value;
            case DataType.LocalizedText: {
                const text = value as LocalizedText;
                return new LocalizedText({ locale: text.locale ?? undefined, text: text.text ?? undefined });
            }
            case DataType.ExtensionObject:
                return this.extensionObjectOf(node, value as ExtensionObject);
            case DataType.Variant: {
                const inner = value as Variant;
                return new Variant(this.valueOf(node, inner) ?? { dataType: DataType.Null });
            }
            default:
                return value;
        }
    }

    /** the four types the XML reader decodes itself travel as instances; every other one as the XML body the reader would capture */
    private extensionObjectOf(
        node: UAVariable | UAVariableType,
        value: ExtensionObject
    ): ExtensionObject | XmlExtensionObjectFragment {
        if (value instanceof Argument) {
            const argument = new Argument({});
            argument.name = value.name;
            argument.dataType = this.t(value.dataType);
            argument.valueRank = value.valueRank;
            // an empty list and null say the same thing; a stored value comes back as null
            argument.arrayDimensions =
                value.arrayDimensions && value.arrayDimensions.length > 0 ? [...value.arrayDimensions] : null;
            argument.description = new LocalizedText({
                locale: value.description?.locale ?? undefined,
                text: value.description?.text ?? undefined
            });
            return argument;
        }
        if (value instanceof EUInformation) {
            return new EUInformation({
                namespaceUri: value.namespaceUri,
                unitId: value.unitId,
                displayName: new LocalizedText({
                    locale: value.displayName?.locale ?? undefined,
                    text: value.displayName?.text ?? undefined
                }),
                description: new LocalizedText({
                    locale: value.description?.locale ?? undefined,
                    text: value.description?.text ?? undefined
                })
            });
        }
        if (value instanceof Range) {
            const range = new Range({});
            range.low = value.low;
            range.high = value.high;
            return range;
        }
        if (value instanceof EnumValueType) {
            return new EnumValueType({
                value: coerceInt64(value.value),
                displayName: new LocalizedText({
                    locale: value.displayName?.locale ?? undefined,
                    text: value.displayName?.text ?? undefined
                }),
                description: new LocalizedText({
                    locale: value.description?.locale ?? undefined,
                    text: value.description?.text ?? undefined
                })
            });
        }
        const schema = value.schema;
        const dataTypeNode = schema?.dataTypeNodeId ? this.addressSpace.findDataType(schema.dataTypeNodeId) : null;
        if (!dataTypeNode) {
            throw new NodesetExportError(
                `${node.nodeId.toString()}: the value holds a ${schema?.name ?? value.constructor.name} whose data type is not in the address space`
            );
        }
        const encodingDefaultXml = schema.encodingDefaultXml;
        if (!encodingDefaultXml || encodingDefaultXml.isEmpty()) {
            throw new NodesetExportError(`${node.nodeId.toString()}: ${schema.name} has no XML encoding`);
        }
        const xw = new XMLWriter(false) as unknown as XmlWriter;
        xw.translationTable = this.translationTable;
        xw.priorityTable = this.priorityTable;
        xw.visitedNode = new Set();
        initXmlWriterEx(xw, { ...this.namespacesMap }, this.namespaceArray);
        const { name, definition } = this.definitionMap.findDefinition(dataTypeNode.nodeId);
        _dumpVariantExtensionObjectValue_Body(
            xw,
            this.definitionMap,
            name,
            definition as StructureDefinition,
            this.addressSpace,
            value
        );
        return new XmlExtensionObjectFragment(this.t(encodingDefaultXml), xw.toString());
    }
    // #endregion
}

/** the records of a namespace with the comment markers the XML export places between them */
export function namespaceToWalkEvents(namespace: INamespace): NodesetWalkEvent[] {
    return new RecordExporter(namespace as NamespaceImpl).run();
}

/**
 * the walk from one node: the node, its type definition and supertype when they belong to the
 * same namespace and are not out yet, its aggregates after it; with the namespace table the
 * events' ids are in
 */
export function nodeToWalkEvents(node: BaseNode): { events: NodesetWalkEvent[]; translationTable: Map<number, number> } {
    const exporter = new RecordExporter(node.namespace as NamespaceImpl);
    return { events: exporter.walkFrom(node), translationTable: exporter.translation };
}

/** the records of a namespace; see {@link ToNodesetRecordsOptions} */
export function namespaceToRecords(namespace: INamespace, _options: ToNodesetRecordsOptions = {}): NodesetRecord[] {
    return namespaceToWalkEvents(namespace).filter((event): event is NodesetRecord => event.kind !== "section");
}

export interface NamespaceToImageOptions extends Pick<NodesetImageWriterOptions, "addressSpaceVersion" | "createdAt"> {}

/** the sha256 of the lines the digest covers, hex */
const sha256 = (text: string): Promise<string> => sha256Hex(new TextEncoder().encode(text));

/**
 * the precompiled image of a namespace: the records, JSON Lines, gzip; the trailer digest is the
 * SHA-256 of the node lines, so that a re-import keys on the content and not on a file that does
 * not exist
 */
export async function namespaceToImage(namespace: INamespace, options: NamespaceToImageOptions = {}): Promise<Uint8Array> {
    const writer = new NodesetImageWriter({ ...options });
    for (const record of namespaceToRecords(namespace)) {
        writer.apply(record);
    }
    return writer.finish(await sha256(writer.bodyText()));
}

NamespaceImpl.prototype.toNodesetRecords = function (
    this: NamespaceImpl,
    options?: ToNodesetRecordsOptions
): Iterable<NodesetRecord> {
    return namespaceToRecords(this, options);
};
NamespaceImpl.prototype.toNodesetImage = function (this: NamespaceImpl, options?: NamespaceToImageOptions): Promise<Uint8Array> {
    return namespaceToImage(this, options);
};

// referenced so that the unused-type rule does not drop them from the public surface of this module
export type { NodesetRecord };
export { DataTypeIds, makeTypeXsd, NodeIdType };
