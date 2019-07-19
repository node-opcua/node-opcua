import { DataValue } from "node-opcua-data-value";
import { OpaqueStructure } from "node-opcua-extension-object";
import { IBasicSession } from "node-opcua-pseudo-session";
import { DataType } from "node-opcua-variant";

import { extractNamespaceDataType } from "./client_dynamic_extension_object";
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { resolveDynamicExtensionObject } from "./resolve_dynamic_extension_object";

export async function getExtraDataTypeManager(
    session: IBasicSession
) {
    const sessionPriv: any = session as any;
    if (!sessionPriv.$$extraDataTypeManager) {
        const extraDataTypeManager = new ExtraDataTypeManager();
        await extractNamespaceDataType(session, extraDataTypeManager);
        sessionPriv.$$extraDataTypeManager = extraDataTypeManager;
    }
    return sessionPriv.$$extraDataTypeManager;
}

export async function promoteOpaqueStructure(
    session: IBasicSession,
    dataValues: DataValue[]
) {

    // count number of Opaque Structures
    const dataValuesToFix = dataValues.filter((dataValue: DataValue) =>
        dataValue.value.dataType === DataType.ExtensionObject &&
        dataValue.value.value instanceof OpaqueStructure);
    if (dataValuesToFix.length === 0) {
        return;
    }

    // construct dataTypeManager if not already present
    const extraDataTypeManager = await getExtraDataTypeManager(session);

    const promises = dataValuesToFix.map(async (dataValue: DataValue) => {
        resolveDynamicExtensionObject(dataValue.value, extraDataTypeManager);
    });
    await Promise.all(promises);
}
