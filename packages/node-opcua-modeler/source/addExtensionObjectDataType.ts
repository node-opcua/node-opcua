import { Namespace as INamespace, PseudoSession, UADataType, UAObject, UAVariableType } from "node-opcua-address-space";
import assert from "node-opcua-assert";
import { convertDataTypeDefinitionToStructureTypeSchema, ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { coerceQualifiedName, LocalizedTextLike, QualifiedNameLike } from "node-opcua-data-model";
import { ConstructorFuncWithSchema } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { createDynamicObjectConstructor } from "node-opcua-schemas";
import { StructureDefinition, StructureDefinitionOptions } from "node-opcua-types";

/**
 * create the deprecated DataTypeDictionary node that was
 * used up to version 1.03
 */
export function getOrCreateDataTypeSystem(namespace: INamespace): UAObject {
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

export async function addExtensionObjectDataType(namespace: INamespace, options: ExtensionObjectDefinition): Promise<UADataType> {
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
    if (!subtypeOf) {
        throw new Error("Cannot find  base DataType ");
    }
    const structureDefinition = options.structureDefinition;
    structureDefinition.baseDataType = resolveNodeId(structureDefinition.baseDataType || "Structure");

    const isAbstract = options.isAbstract || false;

    const dataType = namespace.createDataType({
        browseName: options.browseName,
        description: options.description,
        isAbstract,
        subtypeOf
    });

    const defaultBinary = dataTypeEncodingType.instantiate({
        browseName: coerceQualifiedName("0:Default Binary"),
        encodingOf: dataType
        // nodeId: defaultBinaryEncodingNode,
    })!;
    assert(defaultBinary.browseName.toString() === "Default Binary");

    (dataType as any).$fullDefinition = new StructureDefinition(structureDefinition);

    const d = dataType.getStructureDefinition();
    assert(!NodeId.sameNodeId(d.baseDataType, NodeId.nullNodeId));

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
        dataType.getStructureDefinition(),
        dataTypeFactory,
        isAbstract,
        cache
    );
    const Constructor = createDynamicObjectConstructor(schema, dataTypeFactory) as ConstructorFuncWithSchema;

    return dataType;
}

export function addVariableTypeForDataType(namespace: INamespace, dataType: UADataType): UAVariableType {
    const addressSpace = namespace.addressSpace;

    // get Definition
    const definition = dataType.getStructureDefinition();
    // istanbul ignore next
    if (!definition || !(definition instanceof StructureDefinition)) {
        throw new Error("dataType is not a structure");
    }

    const variableTypeName = dataType.browseName.name?.replace("DataType", "Type");
    const variableType = namespace.addVariableType({
        browseName: variableTypeName!,
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
        if (fType.isSubtypeOf(structure)) {
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
