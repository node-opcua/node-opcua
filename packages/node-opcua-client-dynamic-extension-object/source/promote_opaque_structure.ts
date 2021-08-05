import { OpaqueStructure } from "node-opcua-extension-object";
import { IBasicSession } from "node-opcua-pseudo-session";
import { DataType, VariantArrayType, Variant } from "node-opcua-variant";
//
import { getExtraDataTypeManager } from "./get_extra_data_type_manager";
import { resolveDynamicExtensionObject } from "./resolve_dynamic_extension_object";


export interface PseudoDataValue { value: Variant };

export async function promoteOpaqueStructure(
    session: IBasicSession,
    dataValues: PseudoDataValue[]
) {

    // count number of Opaque Structures
    const dataValuesToFix = dataValues.filter((dataValue: PseudoDataValue) =>
        dataValue.value && dataValue.value.dataType === DataType.ExtensionObject &&
        (
            (dataValue.value.arrayType === VariantArrayType.Scalar
                && dataValue.value.value instanceof OpaqueStructure)
            ||
            (dataValue.value.arrayType !== VariantArrayType.Scalar
                && dataValue.value.value && dataValue.value.value.length >= 0
                && dataValue.value.value[0] instanceof OpaqueStructure)
        )
    );

    if (dataValuesToFix.length === 0) {
        return;
    }

    // construct dataTypeManager if not already present
    const extraDataTypeManager = await getExtraDataTypeManager(session);

    const promises = dataValuesToFix.map(
        async (dataValue: PseudoDataValue) => {
            return await resolveDynamicExtensionObject(session, dataValue.value, extraDataTypeManager)
        });
    // https://medium.com/swlh/dealing-with-multiple-promises-in-javascript-41d6c21f20ff
    await Promise.all(promises.map(p => p.catch(e => e)));
}
