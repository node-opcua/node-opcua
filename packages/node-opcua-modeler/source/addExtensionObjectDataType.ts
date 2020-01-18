import assert from "node-opcua-assert";
import {
    Namespace,
    UADataType,
    AddressSpace,
    UAObject
} from "node-opcua-address-space";
import {
    QualifiedNameLike,
    LocalizedText,
    LocalizedTextLike,
    NodeClass
} from "node-opcua-data-model";
import {
    DataTypeDefinition,
    StructureDefinition,
    EnumDefinition,
    StructureDefinitionOptions,
    EnumDefinitionOptions
} from "node-opcua-types";
import {
    NodeId,
    NodeIdLike,
    resolveNodeId
} from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";


/**
 * create the deprecated DataTypeDictionnary node that was
 * used up to version 1.03
 */
export function getOrCreateDataTypeSystem(namespace: Namespace): UAObject {

    const addressSpace = namespace.addressSpace;

    const opcBinaryTypeSystem = addressSpace.findNode("OPCBinarySchema_TypeSystem") as UAObject;
    /* istanbul ignore next */
    if (!opcBinaryTypeSystem) {
        throw new Error("Cannot find OPCBinarySchema_TypeSystem");
    }
    assert(opcBinaryTypeSystem.nodeId.toString() === "ns=0;i=93");
    assert(opcBinaryTypeSystem.browseName.toString() === "OPC Binary");

    const name = namespace.namespaceUri;

    let node: UAObject = opcBinaryTypeSystem.getComponentByName(name) as UAObject;
    if (node) {
        assert(node.nodeClass === NodeClass.Object);
        return node;
    }

    const dataTypeSystemType = addressSpace.findObjectType("DataTypeSystemType");
    /* istanbul ignore next */
    if (!dataTypeSystemType) {
        throw new Error("Cannot find DataTypeSystemType");
    }
    node = dataTypeSystemType.instantiate({
        browseName: name,
        componentOf: opcBinaryTypeSystem,
    })!;

    return node;
}

export function addOldDataTypeDictionary(namespace: Namespace, dataType: UADataType) {

    const addressSpace = namespace.addressSpace;

    const dataTypeDictionaryType = addressSpace.findVariableType("DataTypeDictionaryType");
    /* istanbul ignore next */
    if (!dataTypeDictionaryType) {
        throw new Error("Cannot find DataTypeDictionaryType");
    }
    const dataTypeSystem = getOrCreateDataTypeSystem(namespace);
    const dataTypeDictionary = dataTypeDictionaryType.instantiate({
        browseName: dataType.browseName.name!,
        componentOf: dataTypeSystem,
        optionals: [
            "Deprecated",
            "DataTypeVersion",
            "NamespaceUri"
        ]
    });
    const namespaceUriProp = dataTypeDictionary.getPropertyByName("NamespaceUri");
    if (namespaceUriProp) {
        namespaceUriProp.setValueFromSource({ dataType: DataType.String, value: namespace.namespaceUri });
    }
    const deprecatedProp = dataTypeDictionary.getPropertyByName("Deprecated");
    if (deprecatedProp) {
        deprecatedProp.setValueFromSource({ dataType: DataType.Boolean, value: true });
    }
    return dataTypeDictionary;
}
export interface ExtensionObjectDefinition {

    browseName: QualifiedNameLike;
    description: LocalizedTextLike;
    isAbstract: boolean;

    structureDefinition: StructureDefinitionOptions;
    binaryEncoding: NodeId;
    xmlEncoding: NodeId;

    superType?: UADataType;
}

export function addExtensionObjectDataType(
    namespace: Namespace,
    options: ExtensionObjectDefinition): UADataType {

    const addressSpace = namespace.addressSpace;

    // encodings
    const dataTypeEncodingType = addressSpace.findObjectType("DataTypeEncodingType");
    /* istanbul ignore next */
    if (!dataTypeEncodingType) {
        throw new Error("Cannot find DataTypeEncodingType");
    }

    /* istanbul ignore next */
    if (!options.browseName.toString().match(/DataType$/)) {
        throw new Error("DataType name must end up with DataType ! " + options.browseName.toString());
    }

    const defaultBinary = dataTypeEncodingType.instantiate({
        nodeId: `$$${options.browseName.toString() + "_Encoding_DefaultBinary"}`,
        browseName: { name: "Default Binary", namespaceIndex: 0 }
    })!;
    assert(defaultBinary.browseName.toString() === "Default Binary");

    const baseSuperType = "Structure";
    const superType = addressSpace.findDataType(options.superType ? options.superType : baseSuperType);

    const structureDefinition = options.structureDefinition || [];

    const dataType = namespace.createDataType({
        browseName: options.browseName,
        description: options.description,
        isAbstract: options.isAbstract,
        superType: superType?.nodeId,
        references: [
            {
                referenceType: "HasEncoding",
                isForward: true,
                nodeId: defaultBinary.nodeId
            }
        ],
    });

    (dataType as any).$definition = new StructureDefinition(structureDefinition);

    addOldDataTypeDictionary(namespace, dataType);

    const v = (dataType as any).__findReferenceWithBrowseName("HasEncoding", "Default Binary");
    assert(v.browseName.toString() === "Default Binary");
    return dataType;

}