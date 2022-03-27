import { INamespace, UADataType, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { StructureField } from "node-opcua-types";
import { NamespacePrivate } from "../namespace_private";
import { BaseNodeImpl, getReferenceType } from "../base_node_impl";

function _constructNamespaceDependency(
    namespace: INamespace,
    dependency: INamespace[],
    depMap: Set<number>,
    _visitedDataType: Set<string>
): void {
    const addressSpace = namespace.addressSpace;
    const namespace_ = namespace as NamespacePrivate;
    // navigate all namespace recursively to

    function consider(namespaceIndex: number) {
        if (!depMap.has(namespaceIndex)) {
            depMap.add(namespaceIndex);
            const namespace = addressSpace.getNamespace(namespaceIndex);
            dependency.push(namespace);
            if (namespaceIndex > 0) {
                _constructNamespaceDependency(namespace, dependency, depMap, _visitedDataType);
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
                if (dataTypeNodeId.value!=0) {
                    console.log("Internal error: Cannot find dataType", dataTypeNodeId.toString());
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

export function constructNamespaceDependency(namespace: INamespace): INamespace[] {
    const addressSpace = namespace.addressSpace;

    const dependency: INamespace[] = [];
    const depMap = new Set<number>();

    dependency.push(addressSpace.getDefaultNamespace());
    depMap.add(0);

    if (namespace !== addressSpace.getDefaultNamespace()) {
        dependency.push(namespace);
        depMap.add(namespace.index);
    }
    const _visitedDataType = new Set<string>();

    _constructNamespaceDependency(namespace, dependency, depMap, _visitedDataType);

    return dependency;
}
