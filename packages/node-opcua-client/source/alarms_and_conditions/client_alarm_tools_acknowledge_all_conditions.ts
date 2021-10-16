import { resolveNodeId } from "node-opcua-nodeid";
import { constructEventFilter } from "node-opcua-service-filter";
import { AttributeIds, ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import { CreateSubscriptionRequestOptions, MonitoringParametersOptions } from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { ClientMonitoredItem } from "../client_monitored_item";
import { ClientSession } from "../client_session";
import { EventStuff, fieldsToJson } from "./client_alarm";
import { extractConditionFields } from "./client_alarm_tools_extractConditionFields";
import { callConditionRefresh } from "./client_tools";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

/**
 *
 * @param session
 * @param eventStuff
 * @param comment
 */
export async function acknowledgeCondition(session: ClientSession, eventStuff: EventStuff, comment: string): Promise<StatusCode> {
    try {
        const conditionId = eventStuff.conditionId.value;
        const eventId = eventStuff.eventId.value;
        return await session.acknowledgeCondition(conditionId, eventId, comment);
    } catch (err) {
        errorLog("Acknowledging alarm has failed !", err);
        return StatusCodes.BadInternalError;
    }
}
export async function confirmCondition(session: ClientSession, eventStuff: EventStuff, comment: string): Promise<StatusCode> {
    try {
        const conditionId = eventStuff.conditionId.value;
        const eventId = eventStuff.eventId.value;
        return await session.confirmCondition(conditionId, eventId, comment);
    } catch (err) {
        errorLog("Acknowledging alarm has failed !", err);
        return StatusCodes.BadInternalError;
    }
}

/**
 * Enumerate all events
 * @param session
 */
export async function findActiveConditions(session: ClientSession): Promise<EventStuff[]> {
    const request: CreateSubscriptionRequestOptions = {
        maxNotificationsPerPublish: 10000,
        priority: 6,
        publishingEnabled: true,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 100,
        requestedPublishingInterval: 100
    };

    const subscription = await session.createSubscription2(request);

    const itemToMonitor: ReadValueIdOptions = {
        attributeId: AttributeIds.EventNotifier,
        nodeId: resolveNodeId("Server") // i=2253
    };

    const fields = await extractConditionFields(session, "AcknowledgeableConditionType");

    const eventFilter = constructEventFilter(fields, [resolveNodeId("AcknowledgeableConditionType")]);

    const monitoringParameters: MonitoringParametersOptions = {
        discardOldest: false,
        filter: eventFilter,
        queueSize: 100,
        samplingInterval: 0
    };

    const event_monitoringItem = await subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Both);

    const acknowledgeableConditions: EventStuff[] = [];

    let refreshStartEventHasBeenReceived = false;
    let RefreshEndEventHasBeenReceived = false;

    const RefreshStartEventType = resolveNodeId("RefreshStartEventType").toString();
    const RefreshEndEventType = resolveNodeId("RefreshEndEventType").toString();

    const promise: Promise<void> = new Promise((resolve, reject) => {
        // now create a event monitored Item
        event_monitoringItem.on("changed", (_eventFields: any) => {
            const eventFields = _eventFields as Variant[];
            try {
                if (RefreshEndEventHasBeenReceived) {
                    return;
                }
                // dumpEvent(session, fields, eventFields);
                const pojo = fieldsToJson(fields, eventFields) as any;
                // console.log(pojo.eventType.value.toString(), RefreshEndEventType, RefreshStartEventType);

                // make sure we only start recording event after the RefreshStartEvent has been received
                if (!refreshStartEventHasBeenReceived) {
                    if (pojo.eventType.value.toString() === RefreshStartEventType) {
                        refreshStartEventHasBeenReceived = true;
                    }
                    return;
                }
                if (pojo.eventType.value.toString() === RefreshEndEventType) {
                    RefreshEndEventHasBeenReceived = true;
                    resolve();
                    return;
                }
                if (!pojo.conditionId.value) {
                    // not a Acknowledgeable condition
                    return;
                }

                if (pojo.ackedState.id.dataType === DataType.Boolean) {
                    acknowledgeableConditions.push(pojo as EventStuff);
                }
            } catch (err) {
                errorLog("Error !!", err);
            }
        });
        // async call without waiting !
        try {
            callConditionRefresh(subscription);
        } catch (err) {
            // it is possible that server do not implement conditionRefresh ...
            debugLog("Server may not implement conditionRefresh", err);
        }
    });

    await promise;

    // now shut down susbscription
    await subscription.terminate();

    return acknowledgeableConditions;
}

export async function acknwoledgeAllConditions(session: ClientSession, message: string): Promise<void> {
    try {
        let conditions = await findActiveConditions(session);
        if (conditions.length === 0) {
            debugLog("Warning: cannot find conditions ");
        }

        // filter acknowledgable conditions (no acked yet)
        conditions = conditions.filter((pojo) => pojo.ackedState.id.value === false);

        const promises: Array<Promise<any>> = [];
        for (const eventStuff of conditions) {
            promises.push(acknowledgeCondition(session, eventStuff, message));
        }
        const result = await Promise.all(promises);
        if (doDebug) {
            debugLog("Acked all results: ", result.map((e) => e.toString()).join(" "));
        }
    } catch (err) {
        errorLog("Error", err);
    }
}
export async function confirmAllConditions(session: ClientSession, message: string): Promise<void> {
    try {
        let conditions = await findActiveConditions(session);
        if (conditions.length === 0) {
            debugLog("Warning: cannot find conditions ");
        }

        // filter acknowledgable conditions (no acked yet)
        conditions = conditions.filter((pojo) => pojo.confirmedState.id.value === false);

        const promises: Array<Promise<any>> = [];
        for (const eventStuff of conditions) {
            promises.push(confirmCondition(session, eventStuff, message));
        }
        const result = await Promise.all(promises);
        if (doDebug) {
            debugLog("Confirm all results: ", result.map((e) => e.toString()).join(" "));
        }
    } catch (err) {
        errorLog("Error", err);
    }
}
