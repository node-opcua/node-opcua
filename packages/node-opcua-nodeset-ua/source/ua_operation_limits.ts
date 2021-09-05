// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |OperationLimitsType ns=0;i=11564                  |
 * |isAbstract      |false                                             |
 */
export interface UAOperationLimits_Base extends UAFolder_Base {
    maxNodesPerRead?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerHistoryReadData?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerHistoryReadEvents?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerWrite?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerHistoryUpdateData?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerHistoryUpdateEvents?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerMethodCall?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerBrowse?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerRegisterNodes?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerTranslateBrowsePathsToNodeIds?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxNodesPerNodeManagement?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxMonitoredItemsPerCall?: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAOperationLimits extends UAFolder, UAOperationLimits_Base {
}