import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { IBasicSession, readNamespaceArray } from "node-opcua-pseudo-session";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager } from "./populate_data_type_manager";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = errorLog;

interface IBasicSessionEx extends IBasicSession {
    $$extraDataTypeManager?: ExtraDataTypeManager;
    $$extraDataTypeManagerToResolve?: [(a: ExtraDataTypeManager) => void, (err: Error) => void][];
}
export async function invalidateExtraDataTypeManager(session: IBasicSession): Promise<void> {
    const sessionPriv: IBasicSessionEx = session as IBasicSessionEx;
    sessionPriv.$$extraDataTypeManager = undefined;
    if (sessionPriv.$$extraDataTypeManagerToResolve) {
        warningLog("Warning: invalidateExtraDataTypeManager is called while getExtraDataTypeManager is in progress");
    }
}

async function extractDataTypeManager(session: IBasicSession): Promise<ExtraDataTypeManager> {
    const namespaceArray = await readNamespaceArray(session);
    // istanbul ignore next
    if (namespaceArray.length === 0) {
        errorLog("namespaceArray is not populated ! Your server must expose a list of namespace ");
    }
    // istanbul ignore next
    if (doDebug) {
        debugLog("Namespace Array = ", namespaceArray.join("\n                   "));
    }
    const dataTypeManager = new ExtraDataTypeManager();
    dataTypeManager.setNamespaceArray(namespaceArray);
    for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
        const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
        dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
    }
    await populateDataTypeManager(session, dataTypeManager);
    // istanbul ignore next
    if (dataTypeManager.namespaceArray.length === 0) {
        throw new Error("namespaceArray is not populated ! Your server must expose a list of namespace ");
    }
    return dataTypeManager;
}

export async function getExtraDataTypeManager(session: IBasicSession): Promise<ExtraDataTypeManager> {
    const sessionPriv: IBasicSessionEx = session as IBasicSessionEx;
    if (sessionPriv.$$extraDataTypeManager) {
        return sessionPriv.$$extraDataTypeManager;
    }

    if (sessionPriv.$$extraDataTypeManagerToResolve) {
        doDebug && debugLog("getExtraDataTypeManager is re-entering !");
        return await new Promise<ExtraDataTypeManager>((resolve, reject) => {
            sessionPriv.$$extraDataTypeManagerToResolve?.push([resolve, reject]);
        });
    }
    sessionPriv.$$extraDataTypeManagerToResolve = [];

    return await new Promise<ExtraDataTypeManager>((_resolve, _reject) => {
        sessionPriv.$$extraDataTypeManagerToResolve!.push([_resolve, _reject]);
        (async () => {
            try {
                const dataTypeManager = await extractDataTypeManager(session);
                const tmp = sessionPriv.$$extraDataTypeManagerToResolve!;
                sessionPriv.$$extraDataTypeManagerToResolve = undefined;
                for (const [resolve] of tmp) {
                    resolve(dataTypeManager);
                }
                sessionPriv.$$extraDataTypeManager = dataTypeManager;
            } catch (err) {
                const tmp = sessionPriv.$$extraDataTypeManagerToResolve!;
                sessionPriv.$$extraDataTypeManagerToResolve = undefined;
                for (const [_resolve, reject] of tmp) {
                    reject(err as Error);
                }
            }
        })();
    });
}
