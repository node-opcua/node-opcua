import {
    Namespace,
    PseudoSession,
    UADataType,
    UAObject,
    UAVariable,
    UAVariableT,
    UAVariableType,
    dumpToBSD,
    UADataTypeDictionary,
    DTDataTypeDefinition,
    UAProperty
} from "node-opcua-address-space";
import assert from "node-opcua-assert";
import { convertDataTypeDefinitionToStructureTypeSchema, ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { coerceQualifiedName, LocalizedTextLike, NodeClass, QualifiedNameLike } from "node-opcua-data-model";
import { ConstructorFuncWithSchema } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { createDynamicObjectConstructor } from "node-opcua-schemas";
import { StructureDefinition, StructureDefinitionOptions } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

/**
 * create the deprecated DataTypeDictionary node that was
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

export function getDataTypeDictionary(namespace: Namespace): UADataTypeDictionary<Buffer> {
    const addressSpace = namespace.addressSpace;

    const opcBinaryTypeSystem = getOrCreateDataTypeSystem(namespace);
    assert(opcBinaryTypeSystem.nodeId.toString() === "ns=0;i=93");

    const name = namespace.namespaceUri.replace(/.*:/, "");

    const node: UAVariable = opcBinaryTypeSystem.getComponentByName(name) as UAVariable;
    if (node) {
        assert(node.nodeClass === NodeClass.Variable);
        // already exits ....
        return node as UADataTypeDictionary<Buffer>;
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

        optionals: ["Deprecated", "DataTypeVersion", "NamespaceUri"]
    }) as UADataTypeDictionary<Buffer>;

    dataTypeDictionary.bindVariable({
        get: () => {
            const bsd = dumpToBSD(namespace);
            return new Variant({
                dataType: DataType.ByteString,
                value: Buffer.from(bsd, "utf-8")
            });
        }
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

    const dataTypeDictionary = getDataTypeDictionary(namespace);

    const dataTypeDescriptionType = addressSpace.findVariableType("DataTypeDescriptionType");
    if (!dataTypeDescriptionType) {
        throw new Error("Cannot find DataTypeDescriptionType");
    }

    const dataTypeDescription = dataTypeDescriptionType.instantiate({
        browseName: dataType.browseName.name!,
        componentOf: dataTypeDictionary
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
    binaryEncoding?: NodeId;
    xmlEncoding?: NodeId;
    jsonEncoding?: NodeId;

    subtypeOf?: UADataType;
}

export async function addExtensionObjectDataType(namespace: Namespace, options: ExtensionObjectDefinition): Promise<UADataType> {
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

    const baseSuperType = "Structure";
    const subtypeOf = addressSpace.findDataType(options.subtypeOf ? options.subtypeOf : baseSuperType)!;

    const structureDefinition = options.structureDefinition;
    structureDefinition.baseDataType = structureDefinition.baseDataType
        ? resolveNodeId(structureDefinition.baseDataType)
        : resolveNodeId("Structure");

    const dataType = namespace.createDataType({
        browseName: options.browseName,
        description: options.description,
        isAbstract: options.isAbstract,
        subtypeOf
    });

    const defaultBinary = dataTypeEncodingType.instantiate({
        browseName: coerceQualifiedName("0:Default Binary"),
        encodingOf: dataType
        // nodeId: defaultBinaryEncodingNode,
    })!;
    assert(defaultBinary.browseName.toString() === "Default Binary");

    (dataType as any).$definition = new StructureDefinition(structureDefinition);
    assert(!NodeId.sameNodeId((dataType as any).$definition.baseDataType, NodeId.nullNodeId));

    const dataTypeDescription = addDataTypeDescription(namespace, dataType);
    defaultBinary.addReference({
        isForward: true,
        nodeId: dataTypeDescription,
        referenceType: "HasDescription"
    });
    const v = dataType.getEncodingNode("Default Binary")!;
    assert(v?.browseName.toString() === "Default Binary");

    /// --------------- Create constructor
    const dataTypeManager = (addressSpace as any).$$extraDataTypeManager as ExtraDataTypeManager;
    const dataTypeFactory = dataTypeManager.getDataTypeFactory(namespace.index);
    const session = new PseudoSession(addressSpace);

    const className = dataType.browseName.name!;
    const cache: any = {};
    const schema = await convertDataTypeDefinitionToStructureTypeSchema(
        session,
        dataType.nodeId,
        className,
        (dataType as any).$definition,
        dataTypeFactory,
        cache
    );
    const Constructor = createDynamicObjectConstructor(schema, dataTypeFactory) as ConstructorFuncWithSchema;

    return dataType;
}

export function addVariableTypeForDataType(namespace: Namespace, dataType: UADataType): UAVariableType {
    const addressSpace = namespace.addressSpace;

    // get Definition
    const definition = (dataType as any).$definition as StructureDefinition;
    if (!definition || !(definition instanceof StructureDefinition)) {
        throw new Error("dataType is not a structure");
    }

    const variableTypeName = dataType.browseName.name?.replace("DataType", "Type")!;
    const variableType = namespace.addVariableType({
        browseName: variableTypeName,
        dataType: dataType.nodeId
    });

    const structure = addressSpace.findDataType("Structure")!;
    for (const field of definition.fields || []) {
        let typeDefinition: UAVariableType | string = "BaseVariableType";
        const fType = addressSpace.findDataType(field.dataType);
        /* istanbul ignore next */
        if (!fType) {
            throw new Error("Cannot find dataType" + field.dataType.toString());
        }
        if (fType.isSupertypeOf(structure)) {
            const name = fType.browseName.name!.replace("DataType", "Type");
            typeDefinition = addressSpace.findVariableType(name, field.dataType.namespace)!;
            const comp = typeDefinition.instantiate({
                browseName: field.name!,
                componentOf: variableType,
                dataType: field.dataType,
                description: field.description,
                modellingRule: "Mandatory",
                valueRank: field.valueRank === undefined ? -1 : field.valueRank
            });
        } else {
            const comp = namespace.addVariable({
                browseName: field.name!,
                componentOf: variableType,
                dataType: field.dataType,
                description: field.description,
                modellingRule: "Mandatory",
                typeDefinition,
                valueRank: field.valueRank === undefined ? -1 : field.valueRank
            });
        }
    }
    return variableType;
}
