import { ModellingRuleType, UAObject, UAObjectType, UAVariableT } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { coerceQualifiedName, QualifiedName, QualifiedNameLike } from "node-opcua-data-model";

export interface InstantiateAddInOptions {
    defaultName?: QualifiedNameLike;
    modellingRule?: ModellingRuleType;
    addInOf: UAObject | UAObjectType;
    copyAlsoModellingRules?: boolean;
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
        namespace: objectType.namespace,
        browseName: browseName,
        modellingRule: options.modellingRule,
        copyAlsoModellingRules: options.copyAlsoModellingRules,
    });
    options.addInOf.addReference({
        referenceType: "HasAddIn",
        nodeId: addIn.nodeId
    })
    return addIn;
}

export function addDefaultInstanceBrowseName(objectType: UAObjectType, defaultBrowseName: string)
    : UAVariableT<QualifiedName, DataType.QualifiedName> {

    const namespace1 = objectType.namespace;
    const uaVaraible = namespace1.addVariable({
        browseName: coerceQualifiedName({ name: "DefaultInstanceBrowseName", namespaceIndex: 0 }),
        propertyOf: objectType,
        typeDefinition: "PropertyType",
        dataType: DataType.QualifiedName,
        value: {
            dataType: DataType.QualifiedName,
            value: { namespaceIndex: namespace1.index, name: defaultBrowseName }
        },
        modellingRule: null
    });
    return uaVaraible as UAVariableT<QualifiedName, DataType.QualifiedName>;

}