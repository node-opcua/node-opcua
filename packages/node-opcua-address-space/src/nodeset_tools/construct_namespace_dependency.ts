import { INamespace, UADataType, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { StructureField } from "node-opcua-types";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { NamespacePrivate } from "../namespace_private";
import { BaseNodeImpl, getReferenceType } from "../base_node_impl";

const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);

function _constructNamespaceDependency(
    namespace: INamespace,
    dependency: INamespace[],
    depMap: Set<number>,
    _visitedDataType: Set<string>,
    priorityTable: number[]
): void {
    const addressSpace = namespace.addressSpace;
    const namespace_ = namespace as NamespacePrivate;
    // navigate all namespace recursively to

    function consider(namespaceIndex: number) {
        if (hasHigherPriorityThan(namespaceIndex, namespace.index, priorityTable)) {
            return;
        }
        if (!depMap.has(namespaceIndex)) {
            depMap.add(namespaceIndex);
            const namespace = addressSpace.getNamespace(namespaceIndex);
            dependency.push(namespace);
            if (namespaceIndex > 0) {
                _constructNamespaceDependency(namespace, dependency, depMap, _visitedDataType, priorityTable);
            }
        }
    }

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
    for (const node of namespace_.nodeIterator()) {
        if (node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.VariableType) {
            const dataTypeNodeId = (node as UAVariable | UAVariableType).dataType;
            const dataTypeNode = addressSpace.findDataType(dataTypeNodeId)!;
            if (dataTypeNode) {
                exploreDataTypes(dataTypeNode);
            } else {
                // istanbul ignore next
                if (dataTypeNodeId.value != 0) {
                    warningLog("Warning: Cannot find dataType", dataTypeNodeId.toString());
                }
            }
        }
        // visit all references
        const references = (<BaseNodeImpl>node).ownReferences();
        for (const reference of references) {
            // check referenceId
            const namespaceIndex = getReferenceType(reference)!.nodeId.namespace;
            consider(namespaceIndex);
            const namespaceIndex2 = reference.nodeId.namespace;
            consider(namespaceIndex2);
        }
    }
}


export function hasHigherPriorityThan(namespaceIndex1: number, namespaceIndex2: number, priorityTable: number[]) {
    const order1 = priorityTable[namespaceIndex1];
    const order2 = priorityTable[namespaceIndex2];
    return order1 > order2;
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
export function constructNamespacePriorityTable(namespace: INamespace): number[] {

    // Namespace 0 will always be 0 
    // Namespaces with no requiredModel will be considered as instance namespaces and will added at the end
    // in the same order as they appear,
    // Namespace with requiredModels are considered to be companion specification, so already loaded in the correct order

    const addressSpace = namespace.addressSpace;
    const namespaces = addressSpace.getNamespaceArray();

    const namespaceWithReq = namespaces.filter((n) => (n.getRequiredModels() !== undefined) && n.index !== 0);
    const namespaceWithoutReq = namespaces.filter((n) => (n.getRequiredModels() === undefined) && n.index !== 0);

    const priorityList: number[] = [0];
    let counter = 1;
    for (let i = 0; i < namespaceWithReq.length; i++) {
        priorityList[namespaceWithReq[i].index] = counter++;
    }
    for (let i = 0; i < namespaceWithoutReq.length; i++) {
        priorityList[namespaceWithoutReq[i].index] = counter++;
    }
    return priorityList;
}
const doDebug = false;
export function constructNamespaceDependency(namespace: INamespace, priorityTable?: number[]): INamespace[] {
    const addressSpace = namespace.addressSpace;

    priorityTable = priorityTable || constructNamespacePriorityTable(namespace);

    const dependency: INamespace[] = [];
    const depMap = new Set<number>();

    dependency.push(addressSpace.getDefaultNamespace());
    depMap.add(0);

    if (namespace !== addressSpace.getDefaultNamespace()) {
        dependency.push(namespace);
        depMap.add(namespace.index);
    }
    const _visitedDataType = new Set<string>();

    _constructNamespaceDependency(namespace, dependency, depMap, _visitedDataType, priorityTable);

    // istanbul ignore next
    doDebug && debugLog("namespace : ", namespace.index, namespace.namespaceUri);
    // istanbul ignore next
    doDebug && debugLog("   ", dependency.map((d) => d.index + " " + d.namespaceUri).join("\n   "));

    const sorted = dependency.sort((a, b) => (priorityTable![a.index] < priorityTable![b.index] ? -1 : 1));
    // istanbul ignore next
    doDebug && debugLog("sorted:");
    // istanbul ignore next
    doDebug && debugLog("   ", sorted.map((d) => d.index + " " + d.namespaceUri).join("\n   "));

    return sorted;
}
