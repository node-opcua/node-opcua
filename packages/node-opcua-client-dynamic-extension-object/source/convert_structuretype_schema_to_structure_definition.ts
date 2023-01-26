import { CommonInterface, FieldCategory, FieldEnumeration, FieldType, IStructuredTypeSchema } from "node-opcua-factory";
import { StructureDefinition, StructureType, StructureDefinitionOptions, StructureFieldOptions } from "node-opcua-types";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

function _getDataType(field: FieldType): NodeId {
    switch (field.category) {
        case FieldCategory.complex:
            return resolveNodeId((field.schema as any).dataTypeNodeId);
        case FieldCategory.basic:
            return resolveNodeId(field.fieldType);
        case FieldCategory.enumeration:
        default:
            return resolveNodeId(field.dataType!);
    }
}

export function convertStructureTypeSchemaToStructureDefinition(st: IStructuredTypeSchema): StructureDefinition {

    let structureType = StructureType.Invalid;
    let isUnion = false;
    if (st.baseType === "Union") {
        structureType = StructureType.Union;
        isUnion = true;
    } else {
        structureType =  StructureType.Structure;
    }
    // convert partial field (not including base class)
    const structureDefinition: StructureDefinitionOptions = {
        fields: [],
        baseDataType: st.getBaseSchema()?.dataTypeNodeId,
        defaultEncodingId: st.encodingDefaultBinary,
        structureType
    };
    const fields: StructureFieldOptions[] = structureDefinition.fields || [];
    for (const f of st.fields) {
        const dataType = _getDataType(f);
        if (isUnion && f.originalName === "SwitchField") {
            continue;
        }
        fields.push({
            arrayDimensions: f.isArray ? [] : undefined,
            valueRank: f.isArray ? 1 : -1,
            dataType,
            isOptional: isUnion ? undefined: f.switchValue !== undefined,
            description: f.documentation || undefined,
            name: f.originalName
        });
    }
    return new StructureDefinition(structureDefinition);
}
