import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import {
    IBasicSessionAsync2,
    clearSessionCache,
    readNamespaceArray
} from "node-opcua-pseudo-session";
import { NodeId } from "node-opcua-nodeid";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { DataTypeExtractStrategy, populateDataTypeManager } from "./populate_data_type_manager";


const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = errorLog;

export interface IBasicSessionAsync2Private extends IBasicSessionAsync2 {
    $$namespaceArray?: string[];
    $$extraDataTypeManager?: ExtraDataTypeManager;
    $$extraDataTypeManagerToResolve?: [(a: ExtraDataTypeManager) => void, (err: Error) => void][];

    $$getSessionForDataTypeExtraction?: () => IBasicSessionAsync2;

    on?: (this: IBasicSessionAsync2Private,  event: "session_restored", func: () => void)=> void;

    sessionId?: NodeId;

}
export async function invalidateExtraDataTypeManager(session: IBasicSessionAsync2): Promise<void> {
    const sessionPriv = session as IBasicSessionAsync2Private;
    clearSessionCache(session);
    sessionPriv.$$namespaceArray = undefined;
    sessionPriv.$$extraDataTypeManager = undefined;
    if (sessionPriv.$$extraDataTypeManagerToResolve) {
        warningLog("Warning: invalidateExtraDataTypeManager is called while getExtraDataTypeManager is in progress");
    }
}

export async function extractDataTypeManagerPrivate(session: IBasicSessionAsync2, strategy: DataTypeExtractStrategy): Promise<ExtraDataTypeManager> {
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
    await populateDataTypeManager(session, dataTypeManager, strategy);
    // istanbul ignore next
    if (dataTypeManager.namespaceArray.length === 0) {
        throw new Error("namespaceArray is not populated ! Your server must expose a list of namespace ");
    }
    return dataTypeManager;
}


function getStrategy(session: IBasicSessionAsync2, strategy?: DataTypeExtractStrategy): DataTypeExtractStrategy {
    if (strategy !== undefined) {
        return strategy;
    }
    const client =  (session as any).client;
    if (client && client.dataTypeExtractStrategy!== undefined) {
        return client.dataTypeExtractStrategy;
    }
    return DataTypeExtractStrategy.Auto;
}

function getSessionForDataTypeManagerExtraction(session: IBasicSessionAsync2): IBasicSessionAsync2 {
    const _session: IBasicSessionAsync2Private = session as IBasicSessionAsync2Private;
    if (_session.$$getSessionForDataTypeExtraction) {
        return _session.$$getSessionForDataTypeExtraction();
    }
    return session;
}

type ICascadingSession = { session?: IBasicSessionAsync2; }
function followSession(session: IBasicSessionAsync2Private & ICascadingSession): IBasicSessionAsync2Private {
    if (session.session) {
        return followSession(session.session);
    }
    return session;
}

export async function getExtraDataTypeManager(session: IBasicSessionAsync2, strategy?: DataTypeExtractStrategy ): Promise<ExtraDataTypeManager> {
    
    const sessionPriv: IBasicSessionAsync2Private = followSession(session) as IBasicSessionAsync2Private;

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
                strategy = getStrategy(session, strategy);
                const sessionToUse = getSessionForDataTypeManagerExtraction(session);

                const dataTypeManager = await extractDataTypeManagerPrivate(sessionToUse, strategy);
                // note: reconnection will call invalidateExtraDataTypeManager
                // if the session is recreated
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
