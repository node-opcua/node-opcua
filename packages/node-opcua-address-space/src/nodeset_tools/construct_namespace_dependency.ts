import { IAddressSpace, INamespace, UADataType, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { StructureField } from "node-opcua-types";
import { DataType } from "node-opcua-basic-types";
import { ExtensionObject } from "node-opcua-extension-object";
import { Variant } from "node-opcua-variant";
import assert from "node-opcua-assert";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { NamespacePrivate } from "../namespace_private";
import { BaseNodeImpl, getReferenceType } from "../base_node_impl";
import { UAVariableImpl } from "../ua_variable_impl";
import { ITranslationTable } from "../../source/xml_writer";

const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);

// eslint-disable-next-line max-statements, complexity
export function _recomputeRequiredModelsFromTypes(
    namespace: INamespace,
    cache?: Map<number, { requiredNamespaceIndexes: number[]; nbTypes: number }>
): { requiredNamespaceIndexes: number[]; nbTypes: number } {
    if (namespace.index === 0) {
        return { requiredNamespaceIndexes: [], nbTypes: 1 };
    }
    if (cache) {
        if (cache.has(namespace.index)) {
            return cache.get(namespace.index)!;
        }
    }
    const requiredNamespaceIndexes = [0];
    const requiredModelsSet = new Set<number>();
    requiredModelsSet.add(0);
    const namespace_ = namespace as NamespacePrivate;
    let nbTypes = 0;
    const addressSpace = namespace.addressSpace;
    const types = [NodeClass.VariableType, NodeClass.ObjectType, NodeClass.ReferenceType, NodeClass.DataType];
    const instances = [NodeClass.Variable, NodeClass.Object, NodeClass.Method];

    const consider = (requiredModel: number) => {
        if (requiredModel !== namespace.index && !requiredModelsSet.has(requiredModel)) {
            requiredModelsSet.add(requiredModel);
            requiredNamespaceIndexes.push(requiredModel);
        }
    };

    const _visitedDataType: Set<string> = new Set<string>();

    function exploreDataTypeField(field: StructureField) {
        const dataType = field.dataType;
        const namespaceIndex = dataType.namespace;
        consider(namespaceIndex);
        const dataTypeNode = addressSpace.findDataType(field.dataType);
        if (dataTypeNode) {
            exploreDataTypes(dataTypeNode);
        }
    }
    function exploreDataTypes(dataTypeNode: UADataType): void {
        if (!dataTypeNode) {
            return;
        }
        const dataType = dataTypeNode.nodeId;
        if (_visitedDataType.has(dataType.toString())) {
            return;
        }
        // istanbul ignore next
        if (dataTypeNode.nodeClass !== NodeClass.DataType) {
            warningLog("exploreDataTypes! ignoring ", dataTypeNode.toString());
            return;
        }

        const namespaceIndex = dataType.namespace;
        consider(namespaceIndex);
        if (dataTypeNode.isStructure()) {
            const definition = dataTypeNode.getStructureDefinition();
            for (const field of definition.fields || []) {
                exploreDataTypeField(field);
            }
        }
        _visitedDataType.add(dataType.toString());
    }

    function exploreExtensionObject(e: ExtensionObject) {
        assert(!(e instanceof Variant));
        const nodeId = e.schema.encodingDefaultXml || e.schema.dataTypeNodeId || e.schema.dataTypeNodeId;
        consider(nodeId.namespace);
        // istanbul ignore next
        if (e.schema.dataTypeNodeId.isEmpty()) {
            warningLog("Cannot find dataTypeNodeId for ", e.schema.name);
        }
        const d = addressSpace.findNode(e.schema.dataTypeNodeId) as UADataType | null;
        // istanbul ignore next
        if (!d) return;
        exploreDataTypes(d);
    }

    function exploreDataValue(uaVariable: UAVariableImpl) {
        if (uaVariable.getBasicDataType() !== DataType.ExtensionObject) {
            return;
        }
        if (!uaVariable.$dataValue) return;
        const variant = uaVariable.$dataValue.value;
        if (!variant) return;
        const value: any | any[] = variant.value;
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(exploreExtensionObject);
        } else {
            exploreExtensionObject(value);
        }
    }
    for (const node of namespace_.nodeIterator()) {
        const isType = types.indexOf(node.nodeClass);
        const isInstance = instances.indexOf(node.nodeClass);
        if (isType !== -1) {
            nbTypes++;
            const superTypes = node.findReferencesAsObject("HasSubtype", false);
            if (superTypes.length === 0) {
                continue;
            }
            if (superTypes.length !== 1) {
                continue;
            }
            const superType = superTypes[0];
            if (superType.nodeId.namespace === 0) {
                continue;
            }
            const requiredModel = superType.nodeId.namespace;
            consider(requiredModel);
        } else if (isInstance !== -1) {
            if (node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.VariableType) {
                const dataTypeNodeId = (node as UAVariable | UAVariableType).dataType;
                const dataTypeNode = addressSpace.findDataType(dataTypeNodeId)!;
                if (dataTypeNode) {
                    consider(dataTypeNode.nodeId.namespace);
                } else {
                    // istanbul ignore next
                    if (dataTypeNodeId.value != 0) {
                        warningLog("Warning: Cannot find dataType", dataTypeNodeId.toString());
                    }
                }
                const nodeV = node as UAVariableImpl;
                exploreDataValue(nodeV);
            }

            const typeDefinitions = node.findReferencesAsObject("HasTypeDefinition", true);
            if (typeDefinitions.length === 0) {
                continue;
            }
            if (typeDefinitions.length !== 1) {
                continue;
            }
            const typeDefinition = typeDefinitions[0];
            const requiredModel = typeDefinition.nodeId.namespace;
            consider(requiredModel);
        }
    }

    const result = { requiredNamespaceIndexes: requiredNamespaceIndexes, nbTypes: nbTypes };
    if (cache) {
        cache.set(namespace.index, result);
    }
    return result;
}

export function _recomputeRequiredModelsFromTypes2(
    namespace: INamespace,
    cache?: Map<number, { requiredNamespaceIndexes: number[]; nbTypes: number }>
): { requiredNamespaceIndexes: number[] } {
    const addressSpace = namespace.addressSpace;

    const { requiredNamespaceIndexes } = _recomputeRequiredModelsFromTypes(namespace, cache);

    const set = new Set<number>(requiredNamespaceIndexes);
    const pass2: number[] = [];
    for (const r of requiredNamespaceIndexes) {
        if (r === 0) {
            pass2.push(0);
            continue;
        }
        const namespaces = _recomputeRequiredModelsFromTypes(addressSpace.getNamespace(r), cache);
        for (const nIndex of namespaces.requiredNamespaceIndexes) {
            if (!set.has(nIndex)) {
                set.add(nIndex);
                pass2.push(nIndex);
            }
        }
        pass2.push(r);
    }

    return { requiredNamespaceIndexes: pass2 };
}

export function _getCompleteRequiredModelsFromValuesAndReferences(
    namespace: INamespace,
    priorityList: number[],
    cache?: Map<number, { requiredNamespaceIndexes: number[]; nbTypes: number }>
): number[] {

    const namespace_ = namespace as NamespacePrivate;

    const thisPriority = priorityList[namespace.index];

    const requiredNamespaceIndexes = _recomputeRequiredModelsFromTypes2(namespace, cache).requiredNamespaceIndexes;
    const requiredModelsSet: Set<number> = new Set<number>([... requiredNamespaceIndexes]);

    const consider = (requiredModel: number) => {
        if (requiredModel !== namespace.index && !requiredModelsSet.has(requiredModel)) {
            requiredModelsSet.add(requiredModel);
            requiredNamespaceIndexes.push(requiredModel);
        }
    }

    //const maxIndex = Math.max(...requiredNamespaceIndexes);
    for (const node of namespace_.nodeIterator()) {
        const references = (<BaseNodeImpl>node).allReferences();
        for (const reference of references) {
            // if (reference.isForward) continue;
            // only look at backward reference
            // check referenceId
            const namespaceIndexOfReferenceType = getReferenceType(reference)!.nodeId.namespace;
            if (namespaceIndexOfReferenceType !== 0 && namespaceIndexOfReferenceType !== namespace.index) {
                const refPriority = priorityList[namespaceIndexOfReferenceType];
                if (refPriority <= thisPriority) {
                    consider(namespaceIndexOfReferenceType);
                }
            }
            const namespaceIndexOfTargetNode = reference.nodeId.namespace;
            if (namespaceIndexOfTargetNode !== 0 && namespaceIndexOfTargetNode !== namespace.index) {
                const refPriority = priorityList[namespaceIndexOfTargetNode];
                if (refPriority <= thisPriority) {
                    consider(namespaceIndexOfTargetNode);
                }
            }
        }
    }
    return requiredNamespaceIndexes;
}

/**
 *
 * @param namespace
 * @returns the order
 *
 *      ---
 *  ua, own , di  => 0 , 2,  1
 *
 *      ---
 *  ua, own , di , kitchen , own2,  adi  => 0 , 2,  3, 1
 *
 *                           ---
 *  ua, own , di , kitchen , own2,  adi  => 0 , 2,  3,  5, 1
 */
export function constructNamespacePriorityTable(addressSpace: IAddressSpace): { loadingOrder: number[]; priorityTable: number[] } {
    // - Namespace 0 will always be 0
    // - Namespace with requiredModels are considered to be companion specification,
    //   so RequireModel will be used to determine the order
    // - Namespaces with no requiredModel are more complicated:
    //
    //   we study ObjectType,ReferenceType, DataType and VariableType
    //   to find strong dependencies between namespace.
    //
    //   if the namespace doesn't define ObjectType,ReferenceType, DataType and VariableType
    //   it will be considered as instance namespaces and will added at the end
    //   in the same order as they appear,
    const namespaces = addressSpace.getNamespaceArray();

    const loadingOrder: number[] = [0];

    const map = new Map<number, { nbTypes: number; requiredNamespaceIndexes: number[]; namespace: INamespace }>();
    for (let i = 0; i < namespaces.length; i++) {
        const { nbTypes, requiredNamespaceIndexes } = _recomputeRequiredModelsFromTypes(namespaces[i], map);
        map.set(namespaces[i].index, { nbTypes, requiredNamespaceIndexes, namespace: namespaces[i] });
    }

    const visited = new Set<number>();
    visited.add(0);

    const h = (n: INamespace) => {
        if (visited.has(n.index)) {
            return;
        }
        visited.add(n.index);
        const data = map.get(n.index);
        if (!data) return;
        const { requiredNamespaceIndexes } = data;
        for (const r of requiredNamespaceIndexes || []) {
            h(namespaces[r]);
        }
        loadingOrder.push(n.index);
    };

    for (let i = 0; i < namespaces.length; i++) {
        const { nbTypes } = map.get(i)!;
        if (nbTypes) {
            h(namespaces[i]);
        }
    }
    for (let i = 0; i < namespaces.length; i++) {
        const { nbTypes } = map.get(i)!;
        if (!nbTypes) {
            h(namespaces[i]);
        }
    }

    const priorityTable: number[] = [];
    for (let i = 0; i < loadingOrder.length; i++) {
        const namespaceIndex = loadingOrder[i];
        assert(namespaceIndex !== -1);
        priorityTable[namespaceIndex] = i;
    }

    return { loadingOrder, priorityTable };
}

const doDebug = false;
export function constructNamespaceDependency(namespace: INamespace, priorityTable?: number[]): INamespace[] {
    const addressSpace = namespace.addressSpace;
    priorityTable = priorityTable || constructNamespacePriorityTable(addressSpace).priorityTable;
    const requiredNamespaceIndexes = _getCompleteRequiredModelsFromValuesAndReferences(namespace, priorityTable);
    return [...requiredNamespaceIndexes.map((r) => addressSpace.getNamespace(r)), namespace];
}

/**
 * @private
 */
export function _constructNamespaceTranslationTable(dependency: INamespace[], exportedNamespace: INamespace): ITranslationTable {
    if (!dependency || dependency.length === 0) {
        return { 0: 0 };
        // throw new Error("Cannot constructNamespaceTranslationTable on empty dependency");
    }
    const translationTable: ITranslationTable = {};
    assert(dependency[0].namespaceUri === "http://opcfoundation.org/UA/");

    let counter = 0;
    translationTable[dependency[0].index] = counter++;
    //
    if (exportedNamespace) {
        translationTable[exportedNamespace.index] = counter++;
    }
    for (let i = 1; i < dependency.length; i++) {
        const dep = dependency[i];
        if (exportedNamespace && exportedNamespace === dep) {
            continue;
        }
        translationTable[dep.index] = counter++;
    }
    return translationTable;
}
