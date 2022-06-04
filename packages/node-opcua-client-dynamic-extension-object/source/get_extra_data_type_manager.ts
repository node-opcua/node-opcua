import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { IBasicSession, readNamespaceArray } from "node-opcua-pseudo-session";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager } from "./populate_data_type_manager";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

interface IBasicSessionEx extends IBasicSession {
    $$extraDataTypeManager?: ExtraDataTypeManager;
}

export async function getExtraDataTypeManager(session: IBasicSession): Promise<ExtraDataTypeManager> {
    const sessionPriv: IBasicSessionEx = session as IBasicSessionEx;
    if (!sessionPriv.$$extraDataTypeManager) {
        const dataTypeManager = new ExtraDataTypeManager();

        const namespaceArray = await readNamespaceArray(sessionPriv);
        // istanbul ignore next
        if (namespaceArray.length === 0) {
            errorLog("namespaceArray is not populated ! Your server must expose a list of namespace ");
        }
        // istanbul ignore next
        if (doDebug) {
            debugLog("Namespace Array = ", namespaceArray.join("\n                   "));
        }
        sessionPriv.$$extraDataTypeManager = dataTypeManager;
        dataTypeManager.setNamespaceArray(namespaceArray);
        for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
            const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
            dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
        }
        await populateDataTypeManager(session, dataTypeManager, true);
    }
    // istanbul ignore next
    if (sessionPriv.$$extraDataTypeManager.namespaceArray.length === 0) {
        throw new Error("namespaceArray is not populated ! Your server must expose a list of namespace ");
    }
    return sessionPriv.$$extraDataTypeManager;
}
