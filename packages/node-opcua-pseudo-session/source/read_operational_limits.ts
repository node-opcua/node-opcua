/**
 * @module node-opcua-pseudo-session
 */
import { makeNodeId } from "node-opcua-nodeid";
import { VariableIds } from "node-opcua-constants";
import { DataValue } from "node-opcua-data-value";
import { AttributeIds } from "node-opcua-service-read";
import { make_warningLog } from "node-opcua-debug";
import { IBasicSessionReadAsyncMultiple } from "./basic_session_interface";

const warningLog = make_warningLog(__filename);

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

export interface OperationLimits {
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

export async function readOperationLimits(session: IBasicSessionReadAsyncMultiple): Promise<OperationLimits> {
    const ids = [
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerWrite,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerMethodCall,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRegisterNodes,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerNodeManagement,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxMonitoredItemsPerCall,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryReadData,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryReadEvents,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryUpdateData,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerHistoryUpdateEvents,
        VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerTranslateBrowsePathsToNodeIds
    ];
    const nodesToRead = ids.map((i) => ({ nodeId: makeNodeId(i), attributeId: AttributeIds.Value }));
    const dataValues = await session.read(nodesToRead);

    function prepare(index: number): number {
        const dataValue = dataValues[index];
        if (dataValue.statusCode.value === 0x00) {
            return dataValue.value.value as number;
        } else {
            warningLog("dataValue = ", dataValue.toString(), " for ", nodesToRead[index].nodeId.toString());
        }
        return 0;
    }
    // tslint:disable-next-line: object-literal-sort-keys
    const results: OperationLimits = {
        maxNodesPerRead: prepare(0),
        maxNodesPerBrowse: prepare(1),
        maxNodesPerWrite: prepare(2),
        maxNodesPerMethodCall: prepare(3),
        maxNodesPerRegisterNodes: prepare(4),
        maxNodesPerNodeManagement: prepare(5),
        maxMonitoredItemsPerCall: prepare(6),
        maxNodesPerHistoryReadData: prepare(7),
        maxNodesPerHistoryReadEvents: prepare(8),
        maxNodesPerHistoryUpdateData: prepare(9),
        maxNodesPerHistoryUpdateEvents: prepare(10),
        maxNodesPerTranslateBrowsePathsToNodeIds: prepare(11)
    };
    return results;
}
