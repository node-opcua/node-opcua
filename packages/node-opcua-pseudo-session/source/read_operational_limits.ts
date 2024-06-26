/**
 * @module node-opcua-pseudo-session
 */
import { resolveNodeId, NodeIdLike } from "node-opcua-nodeid";
import { VariableIds } from "node-opcua-constants";
import { AttributeIds } from "node-opcua-service-read";
import { make_warningLog } from "node-opcua-debug";
import { IBasicSessionReadAsyncMultiple } from "./basic_session_interface";
import { SignedSoftwareCertificate } from "node-opcua-types";
import { QualifiedName } from "node-opcua-data-model";
import { UInt32 } from "node-opcua-basic-types";

const warningLog = make_warningLog(__filename);





export interface IOperationLimits2 {
    maxNodesPerRead?: number;
    maxNodesPerBrowse?: number;
    maxNodesPerWrite?: number;
    maxNodesPerMethodCall?: number;
    maxNodesPerRegisterNodes?: number;
    maxNodesPerNodeManagement?: number;
    maxMonitoredItemsPerCall?: number;
    maxNodesPerHistoryReadData?: number;
    maxNodesPerHistoryReadEvents?: number;
    maxNodesPerHistoryUpdateData?: number;
    maxNodesPerHistoryUpdateEvents?: number;
    maxNodesPerTranslateBrowsePathsToNodeIds?: number;
}

export interface IServerCapabilities2 {
    maxBrowseContinuationPoints: number;
    maxHistoryContinuationPoints: number;
    maxStringLength: number;
    maxArrayLength: number;
    maxByteStringLength: number;
    maxQueryContinuationPoints: number;
    minSupportedSampleRate: number;
    operationLimits: IOperationLimits2;
    serverProfileArray: string[];
    localeIdArray: string[];
    softwareCertificates: SignedSoftwareCertificate[];
    maxSessions: UInt32;
    maxSubscriptions: UInt32;
    maxMonitoredItems: UInt32;
    maxSubscriptionsPerSession: UInt32;
    maxMonitoredItemsPerSubscription: UInt32;
    maxSelectClauseParameters: UInt32;
    maxWhereClauseParameters: UInt32;
    maxMonitoredItemsQueueSize: UInt32;
    conformanceUnits: QualifiedName[];
}


async function _readMany<T extends Record<string, any>>(session: IBasicSessionReadAsyncMultiple, ids: Record<keyof T, NodeIdLike>): Promise<T> {
    const entries = Object.entries(ids);

    const nodesToRead = entries.map(([key, value]) => ({ nodeId: resolveNodeId(value), attributeId: AttributeIds.Value }));

    const dataValues = await session.read(nodesToRead);

    const results: Record<keyof T, any> = {} as any;
    entries.forEach(([key], index) => {
        const dataValue = dataValues[index];
        if (dataValue.statusCode.value === 0x00) {
            results[key as keyof T] = dataValue.value.value as number;
        } else {
            warningLog("dataValue = ", dataValue.toString(), " for ", nodesToRead[index].nodeId.toString());
        }
    });
    return results as T;
}
export async function readOperationLimits(session: IBasicSessionReadAsyncMultiple): Promise<IOperationLimits2> {
    const ids: Record<keyof IOperationLimits2, NodeIdLike> = {
        maxNodesPerRead: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead,
        maxNodesPerBrowse: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse,
        maxNodesPerWrite: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerWrite,
        maxNodesPerMethodCall: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerMethodCall,
        maxNodesPerRegisterNodes: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRegisterNodes,
        maxNodesPerNodeManagement: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerNodeManagement,
        maxMonitoredItemsPerCall: VariableIds.Server_ServerCapabilities_OperationLimits_MaxMonitoredItemsPerCall,
        maxNodesPerHistoryReadData: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryReadData,
        maxNodesPerHistoryReadEvents: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryReadEvents,
        maxNodesPerHistoryUpdateData: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryUpdateData,
        maxNodesPerHistoryUpdateEvents: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryUpdateEvents,
        maxNodesPerTranslateBrowsePathsToNodeIds: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerTranslateBrowsePathsToNodeIds,
    };

    return await _readMany(session, ids);


}

export const serverCapabilitiesIds = [
    VariableIds.Server_ServerCapabilities_MaxArrayLength,
    VariableIds.Server_ServerCapabilities_MaxStringLength,
    VariableIds.Server_ServerCapabilities_MaxByteStringLength,

    VariableIds.Server_ServerCapabilities_MinSupportedSampleRate,
    VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
    VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints,
    VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints,

    // new in 1.05

    VariableIds.Server_ServerCapabilities_MaxSessions,
    VariableIds.Server_ServerCapabilities_MaxSubscriptions,
    VariableIds.Server_ServerCapabilities_MaxMonitoredItems,
    VariableIds.Server_ServerCapabilities_MaxSubscriptionsPerSession,
    VariableIds.Server_ServerCapabilities_MaxSelectClauseParameters,
    VariableIds.Server_ServerCapabilities_MaxWhereClauseParameters,
    VariableIds.Server_ServerCapabilities_ConformanceUnits,
    VariableIds.Server_ServerCapabilities_MaxMonitoredItemsPerSubscription,

    VariableIds.Server_ServerCapabilities_MaxMonitoredItemsQueueSize
];

export async function readServerCapabilities(session: IBasicSessionReadAsyncMultiple): Promise<IServerCapabilities2> {

    const ids: Record<keyof IServerCapabilities2, NodeIdLike> = {
        maxBrowseContinuationPoints: VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
        maxHistoryContinuationPoints: VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints,
        maxStringLength: VariableIds.Server_ServerCapabilities_MaxStringLength,
        maxArrayLength: VariableIds.Server_ServerCapabilities_MaxArrayLength,
        maxByteStringLength: VariableIds.Server_ServerCapabilities_MaxByteStringLength,
        maxQueryContinuationPoints: VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints,
        minSupportedSampleRate: VariableIds.Server_ServerCapabilities_MinSupportedSampleRate,
        // operationLimits: OperationLimits;
        serverProfileArray: VariableIds.Server_ServerCapabilities_ServerProfileArray,
        localeIdArray: VariableIds.Server_ServerCapabilities_LocaleIdArray,
        softwareCertificates: VariableIds.Server_ServerCapabilities_SoftwareCertificates,
        maxSessions: VariableIds.Server_ServerCapabilities_MaxSessions,
        maxSubscriptions: VariableIds.Server_ServerCapabilities_MaxSubscriptions,
        maxMonitoredItems: VariableIds.Server_ServerCapabilities_MaxMonitoredItems,
        maxSubscriptionsPerSession: VariableIds.Server_ServerCapabilities_MaxSubscriptionsPerSession,
        maxMonitoredItemsPerSubscription: VariableIds.Server_ServerCapabilities_MaxMonitoredItemsPerSubscription,
        maxSelectClauseParameters: VariableIds.Server_ServerCapabilities_MaxSelectClauseParameters,
        maxWhereClauseParameters: VariableIds.Server_ServerCapabilities_MaxWhereClauseParameters,
        maxMonitoredItemsQueueSize: VariableIds.Server_ServerCapabilities_MaxMonitoredItemsQueueSize,
        conformanceUnits: VariableIds.Server_ServerCapabilities_ConformanceUnits,
        operationLimits: 0
    };
    const serverCapabilities = await _readMany(session, ids);
    const limits = await readOperationLimits(session);
    serverCapabilities.operationLimits = limits;
    return serverCapabilities;

}