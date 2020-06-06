/**
 * @module node-opcua-address-space
 */
import { Byte, Double, UABoolean, UInt32 } from "node-opcua-basic-types";
import { NodeIdLike } from "node-opcua-nodeid";
import { SubscriptionDiagnosticsDataType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { UAVariable, UAVariableT } from "../address_space_ts";

export interface SubscriptionDiagnosticsVariable extends UAVariable {

    $extensionObject: SubscriptionDiagnosticsDataType;

    sessionId: UAVariable; // <NodeIdLike | null);
    subscriptionId: UAVariableT<UInt32, DataType.UInt32>;
    priority: UAVariableT<Byte, DataType.Byte>;
    publishingInterval: UAVariableT<Double, DataType.Double>;
    maxKeepAliveCount: UAVariableT<UInt32, DataType.UInt32>;
    maxLifetimeCount: UAVariableT<UInt32, DataType.UInt32>;
    maxNotificationsPerPublish: UAVariableT<UInt32, DataType.UInt32>;
    publishingEnabled: UAVariableT<UABoolean, DataType.Boolean>;
    modifyCount: UAVariableT<UInt32, DataType.UInt32>;
    enableCount: UAVariableT<UInt32, DataType.UInt32>;
    disableCount: UAVariableT<UInt32, DataType.UInt32>;
    republishRequestCount: UAVariableT<UInt32, DataType.UInt32>;
    republishMessageRequestCount: UAVariableT<UInt32, DataType.UInt32>;
    republishMessageCount: UAVariableT<UInt32, DataType.UInt32>;
    transferRequestCount: UAVariableT<UInt32, DataType.UInt32>;
    transferredToAltClientCount: UAVariableT<UInt32, DataType.UInt32>;
    transferredToSameClientCount: UAVariableT<UInt32, DataType.UInt32>;
    publishRequestCount: UAVariableT<UInt32, DataType.UInt32>;
    dataChangeNotificationsCount: UAVariableT<UInt32, DataType.UInt32>;
    eventNotificationsCount: UAVariableT<UInt32, DataType.UInt32>;
    notificationsCount: UAVariableT<UInt32, DataType.UInt32>;
    latePublishRequestCount: UAVariableT<UInt32, DataType.UInt32>;
    currentKeepAliveCount: UAVariableT<UInt32, DataType.UInt32>;
    currentLifetimeCount: UAVariableT<UInt32, DataType.UInt32>;
    unacknowledgedMessageCount: UAVariableT<UInt32, DataType.UInt32>;
    discardedMessageCount: UAVariableT<UInt32, DataType.UInt32>;
    monitoredItemCount: UAVariableT<UInt32, DataType.UInt32>;
    disabledMonitoredItemCount: UAVariableT<UInt32, DataType.UInt32>;
    monitoringQueueOverflowCount: UAVariableT<UInt32, DataType.UInt32>;
    nextSequenceNumber: UAVariableT<UInt32, DataType.UInt32>;
    eventQueueOverFlowCount: UAVariableT<UInt32, DataType.UInt32>;
}
