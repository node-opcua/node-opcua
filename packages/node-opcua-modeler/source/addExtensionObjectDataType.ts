import {
    Namespace,
    UADataType,
    UAObject,
    UAVariable
} from "node-opcua-address-space";
import assert from "node-opcua-assert";
import {
    LocalizedTextLike,
    NodeClass,
    QualifiedNameLike,
} from "node-opcua-data-model";
import {
    NodeId
} from "node-opcua-nodeid";
import {
    StructureDefinition,
    StructureDefinitionOptions
} from "node-opcua-types";
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

    return opcBinaryTypeSystem;
}

function getDataTypeDictionary(namespace: Namespace) {

    const addressSpace = namespace.addressSpace;

    const opcBinaryTypeSystem = getOrCreateDataTypeSystem(namespace);
    assert(opcBinaryTypeSystem.nodeId.toString() === "ns=0;i=93");

    const name = namespace.namespaceUri.replace(/.*:/, "");

    const node: UAVariable = opcBinaryTypeSystem.getComponentByName(name) as UAVariable;
    if (node) {
        assert(node.nodeClass === NodeClass.Variable);
        // already exits ....
        return node;
    }

    const dataTypeDictionaryType = addressSpace.findVariableType("DataTypeDictionaryType");
    /* istanbul ignore next */
    if (!dataTypeDictionaryType) {
        throw new Error("Cannot find DataTypeDictionaryType");
    }
    const dataTypeDictionary = dataTypeDictionaryType.instantiate({
        browseName: name!,
        description: `Collects the data type descriptions of ${namespace.namespaceUri}`,

        componentOf: opcBinaryTypeSystem,

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

export function addDataTypeDescription(namespace: Namespace, dataType: UADataType) {

    const addressSpace = namespace.addressSpace;

    const dataTypeDictionnary = getDataTypeDictionary(namespace);

    const dataTypeDescriptionType = addressSpace.findVariableType("DataTypeDescriptionType");
    if (!dataTypeDescriptionType) {
        throw new Error("Cannot find DataTypeDescriptionType");
    }

    const dataTypeDescription = dataTypeDescriptionType.instantiate({
        browseName: dataType.browseName.name!,
        componentOf: dataTypeDictionnary,
    });
    dataTypeDescription.setValueFromSource({
        dataType: DataType.String,
        value: dataType.browseName.name!
    });

    return dataTypeDescription;

}
export interface ExtensionObjectDefinition {

    browseName: QualifiedNameLike;
    description: LocalizedTextLike;
    isAbstract: boolean;

    structureDefinition: StructureDefinitionOptions;
    binaryEncoding: NodeId;
    xmlEncoding: NodeId;

    subtypeOf?: UADataType;
}

export function addExtensionObjectDataType(
    namespace: Namespace,
    options: ExtensionObjectDefinition
): UADataType {

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
        browseName: { name: "Default Binary", namespaceIndex: 0 }
    })!;
    assert(defaultBinary.browseName.toString() === "Default Binary");

    const baseSuperType = "Structure";
    const subtypeOf = addressSpace.findDataType(options.subtypeOf ? options.subtypeOf : baseSuperType)!;

    const structureDefinition = options.structureDefinition || [];

    const dataType = namespace.createDataType({
        browseName: options.browseName,
        description: options.description,
        isAbstract: options.isAbstract,
        subtypeOf,

        references: [
            {
                isForward: true,
                nodeId: defaultBinary.nodeId,
                referenceType: "HasEncoding",
            }
        ],
    });

    (dataType as any).$definition = new StructureDefinition(structureDefinition);

    const dataTypeDescription = addDataTypeDescription(namespace, dataType);
    defaultBinary.addReference({
        isForward: true,
        nodeId: dataTypeDescription,
        referenceType: "HasDescription",
    });
    const v = dataType.getEncodingNode("Default Binary");
    assert(v?.browseName.toString() === "Default Binary");
    return dataType;
}
