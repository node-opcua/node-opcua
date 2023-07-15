import { AttributeIds } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { constructEventFilter, ofType } from "node-opcua-service-filter";
import { ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import { CreateSubscriptionRequestOptions, MonitoringParametersOptions } from "node-opcua-service-subscription";
import { DataType, Variant } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";

import { ClientMonitoredItem } from "../client_monitored_item";
import { ClientSubscription } from "../client_subscription";
import { ClientSession } from "../client_session";
import { EventStuff, fieldsToJson } from "./client_alarm";
import { ClientAlarmList } from "./client_alarm_list";
import { extractConditionFields } from "./client_alarm_tools_extractConditionFields";
import { callConditionRefresh } from "./client_tools";

const doDebug = checkDebugFlag("A&E");
const debugLog = make_debugLog("A&E");
const warningLog = make_warningLog("A&E");

function r(_key: string, o: { dataType?: unknown; value?: unknown }) {
    if (o && o.dataType === "Null") {
        return undefined;
    }
    return o;
}
interface ClientSessionPriv extends ClientSession {
    $clientAlarmList: ClientAlarmList | null;
    $monitoredItemForAlarmList: ClientMonitoredItem | null;
    $subscriptionForAlarmList: ClientSubscription | null;
}
// ------------------------------------------------------------------------------------------------------------------------------
export async function uninstallAlarmMonitoring(session: ClientSession): Promise<void> {
    const _sessionPriv = session as ClientSessionPriv;
    if (!_sessionPriv.$clientAlarmList) {
        return;
    }

    const mi = _sessionPriv.$monitoredItemForAlarmList as ClientMonitoredItem;
    mi.removeAllListeners();

    _sessionPriv.$monitoredItemForAlarmList = null;
    await _sessionPriv.$subscriptionForAlarmList!.terminate();
    _sessionPriv.$clientAlarmList = null;
    return;
}

// Release 1.04 8 OPC Unified Architecture, Part 9
// 4.5 Condition state synchronization
//
// A Client that wishes to display the current status of Alarms and Conditions (known as a
// “current Alarm display”) would use the following logic to process Refresh Event Notifications.
// The Client flags all Retained Conditions as suspect on reception of the Event of the
// RefreshStartEventType. The Client adds any new Events that are received during the Refresh
// without flagging them as suspect. The Client also removes the suspect flag from any Retained
// Conditions that are returned as part of the Refresh. When the Client receives a
// RefreshEndEvent, the Client removes any remaining suspect Events, since they no longer
// apply.

// ------------------------------------------------------------------------------------------------------------------------------
export async function installAlarmMonitoring(session: ClientSession): Promise<ClientAlarmList> {
    const _sessionPriv = session as ClientSessionPriv;
    // create
    if (_sessionPriv.$clientAlarmList) {
        return _sessionPriv.$clientAlarmList;
    }
    const clientAlarmList = new ClientAlarmList();
    _sessionPriv.$clientAlarmList = clientAlarmList;

    const request: CreateSubscriptionRequestOptions = {
        maxNotificationsPerPublish: 100,
        priority: 6,
        publishingEnabled: true,
        requestedLifetimeCount: 10000,
        requestedMaxKeepAliveCount: 10,
        requestedPublishingInterval: 500
    };
    const subscription = await session.createSubscription2(request);
    _sessionPriv.$subscriptionForAlarmList = subscription;

    const itemToMonitor: ReadValueIdOptions = {
        attributeId: AttributeIds.EventNotifier,
        nodeId: resolveNodeId("Server") // i=2253
    };

    const fields = await extractConditionFields(session, "AlarmConditionType");

    const AcknowledgeableConditionType = resolveNodeId("AcknowledgeableConditionType");

    const eventFilter = constructEventFilter(fields, ofType(AcknowledgeableConditionType));

    const monitoringParameters: MonitoringParametersOptions = {
        discardOldest: false,
        filter: eventFilter,
        queueSize: 1000,
        samplingInterval: 0
    };

    // now create a event monitored Item
    const eventMonitoringItem = await subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Both);

    const queueEvent: EventStuff[] = [];
    function flushQueue() {
        const q = [...queueEvent];
        queueEvent.length = 0;
        for (const pojo of q) {
            clientAlarmList.update(pojo);
        }
    }

    let inInit = true;
    eventMonitoringItem.on("changed", (eventFields: Variant[]) => {
        
        const pojo = fieldsToJson(fields, eventFields);
        const { eventType, eventId, conditionId, conditionName } = pojo;

        debugLog(
            "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ---- ALARM RECEIVED " +
                eventType.value.toString() +
                " " +
                eventId.value?.toString("hex")
        );
        try {
            if (!conditionId || !conditionId.value || conditionId.dataType === DataType.Null) {
                // not a acknowledgeable condition
                warningLog(
                    " not acknowledgeable condition ---- " + eventType.value.toString() + " ",
                    conditionId,
                    conditionName?.value,
                    " " + eventId.value?.toString("hex")
                );
                return;
            }
            queueEvent.push(pojo);
            if (queueEvent.length === 1 && !inInit) {
                setTimeout(() => flushQueue(), 10);
            }
        } catch (err) {
            warningLog(JSON.stringify(pojo, r, " "));
            warningLog("Error !!", err);
        }

        // Release 1.04 8 OPC Unified Architecture, Part 9
        // 4.5 Condition state synchronization
        // RefreshRequiredEventType
        // Under some circumstances a Server may not be capable of ensuring the Client is fully
        //  in sync with the current state of Condition instances. For example, if the underlying
        // system represented by the Server is reset or communications are lost for some period
        // of time the Server may need to resynchronize itself with the underlying system. In
        // these cases, the Server shall send an Event of the RefreshRequiredEventType to
        // advise the Client that a Refresh may be necessary. A Client receiving this special
        // Event should initiate a ConditionRefresh as noted in this clause.
        // TODO
    });

    try {
        await callConditionRefresh(subscription);
    } catch (err) {
        if ((err as Error).message.match(/BadNothingToDo/)) {
            /** fine! nothing to do */
        } else {
            warningLog("Server may not implement condition refresh", (<Error>err).message);
        }
    }
    _sessionPriv.$monitoredItemForAlarmList = eventMonitoringItem;

    setTimeout(() => flushQueue(), 10);
    inInit = false;

    // also request updates
    return clientAlarmList;
}
