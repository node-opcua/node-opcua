import { Byte, Double, UABoolean, UInt32 } from "node-opcua-basic-types";
import { NodeIdLike } from "node-opcua-nodeid";
import { SubscriptionDiagnosticsDataType } from "node-opcua-types";
import { UAVariable, UAVariableT} from "../address_space_ts";

export interface SubscriptionDiagnosticsVariable extends UAVariable {

    $extensionObject: SubscriptionDiagnosticsDataType;
    
    sessionId: UAVariable; // <NodeIdLike | null);
    subscriptionId: UAVariableT<UInt32>;
    priority: UAVariableT<Byte>;
    publishingInterval: UAVariableT<Double>;
    maxKeepAliveCount: UAVariableT<UInt32>;
    maxLifetimeCount: UAVariableT<UInt32>;
    maxNotificationsPerPublish: UAVariableT<UInt32>;
    publishingEnabled: UAVariableT<UABoolean>;
    modifyCount: UAVariableT<UInt32>;
    enableCount: UAVariableT<UInt32>;
    disableCount: UAVariableT<UInt32>;
    republishRequestCount: UAVariableT<UInt32>;
    republishMessageRequestCount: UAVariableT<UInt32>;
    republishMessageCount: UAVariableT<UInt32>;
    transferRequestCount: UAVariableT<UInt32>;
    transferredToAltClientCount: UAVariableT<UInt32>;
    transferredToSameClientCount: UAVariableT<UInt32>;
    publishRequestCount: UAVariableT<UInt32>;
    dataChangeNotificationsCount: UAVariableT<UInt32>;
    eventNotificationsCount: UAVariableT<UInt32>;
    notificationsCount: UAVariableT<UInt32>;
    latePublishRequestCount: UAVariableT<UInt32>;
    currentKeepAliveCount: UAVariableT<UInt32>;
    currentLifetimeCount: UAVariableT<UInt32>;
    unacknowledgedMessageCount: UAVariableT<UInt32>;
    discardedMessageCount: UAVariableT<UInt32>;
    monitoredItemCount: UAVariableT<UInt32>;
    disabledMonitoredItemCount: UAVariableT<UInt32>;
    monitoringQueueOverflowCount: UAVariableT<UInt32>;
    nextSequenceNumber: UAVariableT<UInt32>;
    eventQueueOverFlowCount: UAVariableT<UInt32>;
}
