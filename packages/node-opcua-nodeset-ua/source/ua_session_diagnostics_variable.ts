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
export interface UASessionDiagnosticsVariable_Base<T extends DTSessionDiagnostics/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    sessionId: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    sessionName: UABaseDataVariable<UAString, /*z*/DataType.String>;
    clientDescription: UABaseDataVariable<DTApplicationDescription, /*z*/DataType.ExtensionObject>;
    serverUri: UABaseDataVariable<UAString, /*z*/DataType.String>;
    endpointUrl: UABaseDataVariable<UAString, /*z*/DataType.String>;
    localeIds: UABaseDataVariable<UAString[], /*z*/DataType.String>;
    actualSessionTimeout: UABaseDataVariable<number, /*z*/DataType.Double>;
    maxResponseMessageSize: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    clientConnectionTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    clientLastContactTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    currentSubscriptionsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    currentMonitoredItemsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    currentPublishRequestsInQueue: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    totalRequestCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    unauthorizedRequestCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    readCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    historyReadCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    writeCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    historyUpdateCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    callCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    createMonitoredItemsCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    modifyMonitoredItemsCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    setMonitoringModeCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    setTriggeringCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    deleteMonitoredItemsCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    createSubscriptionCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    modifySubscriptionCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    setPublishingModeCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    publishCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    republishCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    transferSubscriptionsCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    deleteSubscriptionsCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    addNodesCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    addReferencesCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    deleteNodesCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    deleteReferencesCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    browseCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    browseNextCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    translateBrowsePathsToNodeIdsCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    queryFirstCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    queryNextCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    registerNodesCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
    unregisterNodesCount: UABaseDataVariable<DTServiceCounter, /*z*/DataType.ExtensionObject>;
}
export interface UASessionDiagnosticsVariable<T extends DTSessionDiagnostics/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASessionDiagnosticsVariable_Base<T /*B*/> {
}