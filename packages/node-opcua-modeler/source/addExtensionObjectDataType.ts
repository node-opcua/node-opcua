import {
    type Namespace as INamespace,
    PseudoSession,
    type UADataType,
    type UAObject,
    type UAVariableType
} from "node-opcua-address-space";
import assert from "node-opcua-assert";
import {
    convertDataTypeDefinitionToStructureTypeSchema,
    type ExtraDataTypeManager
} from "node-opcua-client-dynamic-extension-object";
import { coerceQualifiedName, type LocalizedTextLike, type QualifiedNameLike } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { createDynamicObjectConstructor } from "node-opcua-schemas";
import { StructureDefinition, type StructureDefinitionOptions } from "node-opcua-types";

/**
 * create the deprecated DataTypeDictionary node that was
 * used up to version 1.03
 */
export function getOrCreateDataTypeSystem(namespace: INamespace): UAObject {
    const addressSpace = namespace.addressSpace;

    const opcBinaryTypeSystem = addressSpace.findNode("OPCBinarySchema_TypeSystem") as UAObject;
    /* c8 ignore next */
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
    subtypeOf?: UADataType;
}

export async function addExtensionObjectDataType(namespace: INamespace, options: ExtensionObjectDefinition): Promise<UADataType> {
    const addressSpace = namespace.addressSpace;

    // encodings
    const dataTypeEncodingType = addressSpace.findObjectType("DataTypeEncodingType");
    /* c8 ignore next */
    if (!dataTypeEncodingType) {
        throw new Error("Cannot find DataTypeEncodingType");
    }

    /* c8 ignore next */
    if (!options.browseName.toString().match(/DataType$/)) {
        throw new Error(`DataType name must end up with DataType ! ${options.browseName.toString()}`);
    }

    const baseSuperType = "Structure";
    const subtypeOf = addressSpace.findDataType(options.subtypeOf ? options.subtypeOf : baseSuperType);
    if (!subtypeOf) {
        throw new Error("Cannot find  base DataType ");
    }
    const structureDefinition = options.structureDefinition;
    structureDefinition.baseDataType = resolveNodeId(structureDefinition.baseDataType || "Structure");

    // Resolve string/enum dataType names (e.g. "Double", DataType.Float)
    // to proper NodeIds before constructing StructureDefinition, because
    // the StructureField constructor calls coerceNodeId() which cannot
    // handle plain DataType names like "Double".
    if (structureDefinition.fields) {
        for (const field of structureDefinition.fields) {
            if (field.dataType !== undefined && field.dataType !== null && !(field.dataType instanceof NodeId)) {
                const dt = addressSpace.findDataType(field.dataType as string | number);
                if (dt) {
                    field.dataType = dt.nodeId;
                } else if (typeof field.dataType === "string" || typeof field.dataType === "number") {
                    field.dataType = resolveNodeId(field.dataType);
                }
            }
        }
    }

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
    });
    assert(defaultBinary);
    assert(defaultBinary.browseName.toString() === "Default Binary");

    const defaultXml = dataTypeEncodingType.instantiate({
        browseName: coerceQualifiedName("0:Default XML"),
        encodingOf: dataType
    });
    assert(defaultXml);
    assert(defaultXml.browseName.toString() === "Default XML");

    (dataType as unknown as { $fullDefinition?: StructureDefinition }).$fullDefinition = new StructureDefinition(
        structureDefinition
    );

    const d = dataType.getStructureDefinition();
    assert(!NodeId.sameNodeId(d.baseDataType, NodeId.nullNodeId));

    /// --------------- Create constructor
    const dataTypeManager = (addressSpace as unknown as { $$extraDataTypeManager: ExtraDataTypeManager }).$$extraDataTypeManager;
    const dataTypeFactory = dataTypeManager.getDataTypeFactory(namespace.index);
    const session = new PseudoSession(addressSpace);

    const className = dataType.browseName.name ?? "";
    const cache: Record<string, unknown> = {};
    const schema = await convertDataTypeDefinitionToStructureTypeSchema(
        session,
        dataType.nodeId,
        className,
        dataType.getStructureDefinition(),
        null,
        dataTypeManager,
        isAbstract,
        cache
    );
    createDynamicObjectConstructor(schema, dataTypeFactory);
    return dataType;
}

export function addVariableTypeForDataType(namespace: INamespace, dataType: UADataType): UAVariableType {
    const addressSpace = namespace.addressSpace;

    // get Definition
    const definition = dataType.getStructureDefinition();
    // c8 ignore next
    if (!definition || !(definition instanceof StructureDefinition)) {
        throw new Error("dataType is not a structure");
    }

    const variableTypeName = dataType.browseName.name?.replace("DataType", "Type");
    const variableType = namespace.addVariableType({
        browseName: variableTypeName || "",
        dataType: dataType.nodeId
    });

    const structure = addressSpace.findDataType("Structure");
    /* c8 ignore next */
    if (!structure) {
        throw new Error("Cannot find Structure");
    }
    for (const field of definition.fields || []) {
        let typeDefinition: UAVariableType | string = "BaseVariableType";
        const fType = addressSpace.findDataType(field.dataType);
        /* c8 ignore next */
        if (!fType) {
            throw new Error(`Cannot find dataType${field.dataType.toString()}`);
        }
        if (fType.isSubtypeOf(structure)) {
            const name = fType.browseName.name?.replace("DataType", "Type");
            /* c8 ignore next */
            if (!name) {
                throw new Error(`Cannot find name for dataType${field.dataType.toString()}`);
            }
            typeDefinition = addressSpace.findVariableType(name, field.dataType.namespace) as UAVariableType;
            /* c8 ignore next */
            if (!typeDefinition) {
                throw new Error(`Cannot find typeDefinition for dataType${field.dataType.toString()}`);
            }
            typeDefinition.instantiate({
                browseName: field.name || "",
                componentOf: variableType,
                dataType: field.dataType,
                description: field.description,
                modellingRule: "Mandatory",
                valueRank: field.valueRank === undefined ? -1 : field.valueRank
            });
        } else {
            namespace.addVariable({
                browseName: field.name || "",
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
