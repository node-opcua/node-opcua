import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import type { NodeId } from "node-opcua-nodeid";
import { clearSessionCache, type IBasicSessionAsync2, readNamespaceArray } from "node-opcua-pseudo-session";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager.js";
import { DataTypeExtractStrategy, populateDataTypeManager } from "./populate_data_type_manager.js";

const doDebug = checkDebugFlag("get_extra_data_type_manager");
const debugLog = make_debugLog("get_extra_data_type_manager");
const errorLog = make_errorLog("get_extra_data_type_manager");
const warningLog = errorLog;

export interface IBasicSessionAsync2Private extends IBasicSessionAsync2 {
    $$namespaceArray?: string[];
    $$extraDataTypeManager?: ExtraDataTypeManager;
    $$extraDataTypeManagerToResolve?: [(a: ExtraDataTypeManager) => void, (err: Error) => void][];

    $$getSessionForDataTypeExtraction?: () => IBasicSessionAsync2;

    on?: (this: IBasicSessionAsync2Private, event: "session_restored", func: () => void) => void;

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

async function extractDataTypeManagerPrivate(
    session: IBasicSessionAsync2,
    strategy: DataTypeExtractStrategy
): Promise<ExtraDataTypeManager> {
    const namespaceArray = await readNamespaceArray(session);
    // c8 ignore next
    if (namespaceArray.length === 0) {
        errorLog("namespaceArray is not populated ! Your server must expose a list of namespace ");
    }
    // c8 ignore next
    if (doDebug) {
        debugLog("Namespace Array = ", namespaceArray.join("\n                   "));
    }
    const dataTypeManager = new ExtraDataTypeManager();
    dataTypeManager.setSession(session);
    dataTypeManager.setNamespaceArray(namespaceArray);
    for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
        const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
        dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
    }

    await populateDataTypeManager(session, dataTypeManager, strategy);
    // c8 ignore next
    if (dataTypeManager.namespaceArray.length === 0) {
        throw new Error("namespaceArray is not populated ! Your server must expose a list of namespace ");
    }
    return dataTypeManager;
}

function getStrategy(session: IBasicSessionAsync2, strategy?: DataTypeExtractStrategy): DataTypeExtractStrategy {
    if (strategy !== undefined) {
        return strategy;
    }
    const client = (session as IBasicSessionAsync2 & { _client: { dataTypeExtractStrategy: DataTypeExtractStrategy } })._client;
    if (client && client.dataTypeExtractStrategy !== undefined) {
        return client.dataTypeExtractStrategy;
    }
    return DataTypeExtractStrategy.Auto;
}

export function hasBoostedSession(session: IBasicSessionAsync2): boolean {
    const _session: IBasicSessionAsync2Private & ICascadingSession = session as IBasicSessionAsync2Private & ICascadingSession;
    return !!_session.$$getSessionForDataTypeExtraction || !!_session.session;
}
export function getSessionForDataTypeManagerExtraction(session: IBasicSessionAsync2): IBasicSessionAsync2 {
    const _session: IBasicSessionAsync2Private = session as IBasicSessionAsync2Private;
    if (_session.$$getSessionForDataTypeExtraction) {
        return _session.$$getSessionForDataTypeExtraction();
    }
    return session;
}

type ICascadingSession = { session?: IBasicSessionAsync2 };
function followSession(session: IBasicSessionAsync2Private & ICascadingSession): IBasicSessionAsync2Private {
    if (session.session) {
        return followSession(session.session);
    }
    return session;
}

export async function getExtraDataTypeManager(
    session: IBasicSessionAsync2,
    strategy?: DataTypeExtractStrategy
): Promise<ExtraDataTypeManager> {
    const sessionPriv: IBasicSessionAsync2Private = followSession(session) as IBasicSessionAsync2Private;

    if (sessionPriv.$$extraDataTypeManager) {
        return sessionPriv.$$extraDataTypeManager;
    }

    const pendingList = sessionPriv.$$extraDataTypeManagerToResolve;
    if (pendingList) {
        doDebug && debugLog("getExtraDataTypeManager is re-entering !");
        return await new Promise<ExtraDataTypeManager>((resolve, reject) => {
            pendingList.push([resolve, reject]);
        });
    }
    const newPendingList: [(a: ExtraDataTypeManager) => void, (err: Error) => void][] = [];
    sessionPriv.$$extraDataTypeManagerToResolve = newPendingList;

    return await new Promise<ExtraDataTypeManager>((_resolve, _reject) => {
        newPendingList.push([_resolve, _reject]);
        (async () => {
            try {
                strategy = getStrategy(session, strategy);

                const sessionToUse = getSessionForDataTypeManagerExtraction(session);

                const dataTypeManager = await extractDataTypeManagerPrivate(sessionToUse, strategy);
                // note: reconnection will call invalidateExtraDataTypeManager
                // if the session is recreated
                sessionPriv.$$extraDataTypeManagerToResolve = undefined;
                for (const [resolve] of newPendingList) {
                    resolve(dataTypeManager);
                }
                sessionPriv.$$extraDataTypeManager = dataTypeManager;
            } catch (err) {
                sessionPriv.$$extraDataTypeManagerToResolve = undefined;
                for (const [_resolve, reject] of newPendingList) {
                    reject(err as Error);
                }
            }
        })();
    });
}
