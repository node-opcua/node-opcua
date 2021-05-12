/**
 * @module node-opcua-pseudo-session
 */
import { 
     makeNodeId, 
} from "node-opcua-nodeid";
import { 
    VariableIds, 
} from "node-opcua-constants";
import { 
    DataValue 
} from "node-opcua-data-value";
    import { 
    AttributeIds, 
 
} from "node-opcua-service-read";
import { IBasicSession } from "./basic_session_interface";

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

 export async function readOperationLimits(session: IBasicSession): Promise<OperationLimits> {
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
 
   function prepare(dataValue: DataValue): number {
     if (dataValue.statusCode.value === 0x00) {
       return dataValue.value.value as number;
     } else {
       console.log("dataValue = ", dataValue.toString());
     }
     return 0;
   }
   const results: OperationLimits = {
     maxNodesPerRead: prepare(dataValues[0]),
     maxNodesPerBrowse: prepare(dataValues[1]),
     maxNodesPerWrite: prepare(dataValues[2]),
     maxNodesPerMethodCall: prepare(dataValues[3]),
     // tslint:disable-next-line: object-literal-sort-keys
     maxNodesPerRegisterNodes: prepare(dataValues[4]),
     maxNodesPerNodeManagement: prepare(dataValues[5]),
     maxMonitoredItemsPerCall: prepare(dataValues[6]),
     maxNodesPerHistoryReadData: prepare(dataValues[7]),
     maxNodesPerHistoryReadEvents: prepare(dataValues[8]),
     maxNodesPerHistoryUpdateData: prepare(dataValues[9]),
     maxNodesPerHistoryUpdateEvents: prepare(dataValues[10]),
     maxNodesPerTranslateBrowsePathsToNodeIds: prepare(dataValues[11])
   };
    return results;
 }
 