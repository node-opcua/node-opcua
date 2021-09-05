// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, Byte } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SubscriptionDiagnosticsType ns=0;i=2172           |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSubscriptionDiagnostics ns=0;i=874              |
 * |isAbstract      |false                                             |
 */
export interface UASubscriptionDiagnostics_Base<T extends DTSubscriptionDiagnostics/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    sessionId: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    subscriptionId: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    priority: UABaseDataVariable<Byte, /*z*/DataType.Byte>;
    publishingInterval: UABaseDataVariable<number, /*z*/DataType.Double>;
    maxKeepAliveCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    maxLifetimeCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    maxNotificationsPerPublish: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    publishingEnabled: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    modifyCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    enableCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    disableCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    republishRequestCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    republishMessageRequestCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    republishMessageCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    transferRequestCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    transferredToAltClientCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    transferredToSameClientCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    publishRequestCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    dataChangeNotificationsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    eventNotificationsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    notificationsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    latePublishRequestCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    currentKeepAliveCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    currentLifetimeCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    unacknowledgedMessageCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    discardedMessageCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    monitoredItemCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    disabledMonitoredItemCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    monitoringQueueOverflowCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    nextSequenceNumber: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    eventQueueOverflowCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UASubscriptionDiagnostics<T extends DTSubscriptionDiagnostics/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASubscriptionDiagnostics_Base<T /*B*/> {
}