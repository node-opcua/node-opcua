// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSessionDiagnostics } from "./dt_session_diagnostics"
import { DTApplicationDescription } from "./dt_application_description"
import { DTServiceCounter } from "./dt_service_counter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SessionDiagnosticsVariableType ns=0;i=2197        |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSessionDiagnostics ns=0;i=865                   |
 * |isAbstract      |false                                             |
 */
export interface UASessionDiagnosticsVariable_Base<T extends DTSessionDiagnostics>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    sessionId: UABaseDataVariable<NodeId, DataType.NodeId>;
    sessionName: UABaseDataVariable<UAString, DataType.String>;
    clientDescription: UABaseDataVariable<DTApplicationDescription, DataType.ExtensionObject>;
    serverUri: UABaseDataVariable<UAString, DataType.String>;
    endpointUrl: UABaseDataVariable<UAString, DataType.String>;
    localeIds: UABaseDataVariable<UAString[], DataType.String>;
    actualSessionTimeout: UABaseDataVariable<number, DataType.Double>;
    maxResponseMessageSize: UABaseDataVariable<UInt32, DataType.UInt32>;
    clientConnectionTime: UABaseDataVariable<Date, DataType.DateTime>;
    clientLastContactTime: UABaseDataVariable<Date, DataType.DateTime>;
    currentSubscriptionsCount: UABaseDataVariable<UInt32, DataType.UInt32>;
    currentMonitoredItemsCount: UABaseDataVariable<UInt32, DataType.UInt32>;
    currentPublishRequestsInQueue: UABaseDataVariable<UInt32, DataType.UInt32>;
    totalRequestCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    unauthorizedRequestCount: UABaseDataVariable<UInt32, DataType.UInt32>;
    readCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    historyReadCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    writeCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    historyUpdateCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    callCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    createMonitoredItemsCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    modifyMonitoredItemsCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    setMonitoringModeCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    setTriggeringCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    deleteMonitoredItemsCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    createSubscriptionCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    modifySubscriptionCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    setPublishingModeCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    publishCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    republishCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    transferSubscriptionsCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    deleteSubscriptionsCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    addNodesCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    addReferencesCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    deleteNodesCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    deleteReferencesCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    browseCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    browseNextCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    translateBrowsePathsToNodeIdsCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    queryFirstCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    queryNextCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    registerNodesCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
    unregisterNodesCount: UABaseDataVariable<DTServiceCounter, DataType.ExtensionObject>;
}
export interface UASessionDiagnosticsVariable<T extends DTSessionDiagnostics> extends UABaseDataVariable<T, DataType.ExtensionObject>, UASessionDiagnosticsVariable_Base<T> {
}