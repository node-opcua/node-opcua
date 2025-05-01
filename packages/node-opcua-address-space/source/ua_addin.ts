import { INamespace, ModellingRuleType, UAObject, UAObjectType, UAVariableT } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { coerceQualifiedName, QualifiedName, QualifiedNameLike } from "node-opcua-data-model";
import { NodeIdLike } from "node-opcua-nodeid";

export interface InstantiateAddInOptions {
    defaultName?: QualifiedNameLike;
    modellingRule?: ModellingRuleType;
    addInOf: UAObject | UAObjectType;
    copyAlsoModellingRules?: boolean;

    namespace?: INamespace;
    nodeId?: NodeIdLike;
}

export function instantiateAddIn(objectType: UAObjectType, options: InstantiateAddInOptions): UAObject {

    let defaultName = options.defaultName;
    // check that objectType has he shape of an addInd
    const defaultInstanceBrowseName = objectType.getPropertyByName("DefaultInstanceBrowseName");
    if (!defaultInstanceBrowseName) {
        throw new Error("objectType must have a DefaultInstanceBrowseName property");
    }

    const browseName = coerceQualifiedName(defaultName || defaultInstanceBrowseName.readValue().value.value as QualifiedName);
    const addIn = objectType.instantiate({
        namespace: options.namespace || objectType.namespace,
        browseName: browseName,
        modellingRule: options.modellingRule,
        copyAlsoModellingRules: options.copyAlsoModellingRules,
        addInOf: options.addInOf,
        nodeId: options.nodeId
    });
    return addIn;
}

export function addDefaultInstanceBrowseName(objectType: UAObjectType, defaultBrowseName: QualifiedName | string)
    : UAVariableT<QualifiedName, DataType.QualifiedName> {

    const namespace1 = objectType.namespace;
    if (typeof defaultBrowseName === "string") {
        defaultBrowseName = coerceQualifiedName({ name: defaultBrowseName, namespaceIndex: namespace1.index });
    }

    const uaVaraible = namespace1.addVariable({
        browseName: coerceQualifiedName({ name: "DefaultInstanceBrowseName", namespaceIndex: 0 }),
        propertyOf: objectType,
        typeDefinition: "PropertyType",
        dataType: DataType.QualifiedName,
        value: {
            dataType: DataType.QualifiedName,
            value: defaultBrowseName
        },
        modellingRule: null // DefaultInstanceBrowseName must have no ModellingRule
    });
    return uaVaraible as UAVariableT<QualifiedName, DataType.QualifiedName>;

}