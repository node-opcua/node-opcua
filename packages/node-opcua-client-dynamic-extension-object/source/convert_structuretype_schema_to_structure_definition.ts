import { FieldCategory, type FieldType, type IStructuredTypeSchema } from "node-opcua-factory";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StructureDefinition, type StructureDefinitionOptions, type StructureFieldOptions, StructureType } from "node-opcua-types";

function _getDataType(field: FieldType): NodeId {
    switch (field.category) {
        case FieldCategory.complex:
            return resolveNodeId((field.schema as unknown as IStructuredTypeSchema).dataTypeNodeId);
        case FieldCategory.basic:
            return resolveNodeId(field.fieldType);
        default:
            if (!field.dataType) {
                throw new Error(`Internal error: expecting dataType to be defined for field ${field.name}`);
            }
            return resolveNodeId(field.dataType);
    }
}

export function convertStructureTypeSchemaToStructureDefinition(st: IStructuredTypeSchema): StructureDefinition {
    let structureType = StructureType.Invalid;
    let isUnion = false;
    if (st.baseType === "Union") {
        structureType = StructureType.Union;
        isUnion = true;
    } else {
        structureType = StructureType.Structure;
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
            isOptional: isUnion ? undefined : f.switchValue !== undefined,
            description: f.documentation || undefined,
            name: f.originalName
        });
    }
    return new StructureDefinition(structureDefinition);
}
