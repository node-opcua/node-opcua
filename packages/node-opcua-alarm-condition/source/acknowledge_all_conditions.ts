import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync, IBasicSessionEx } from "node-opcua-pseudo-session";
import { constructEventFilter } from "node-opcua-service-filter";
import { AttributeIds, type ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import type { CreateSubscriptionRequestOptions, MonitoringParametersOptions } from "node-opcua-service-subscription";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, type Variant } from "node-opcua-variant";
import { callConditionRefresh } from "./call_condition_refresh";
import { acknowledgeCondition, confirmCondition } from "./call_method_condition";
import { type EventStuff, fieldsToJson } from "./event_stuff";
import { extractConditionFields } from "./extract_condition_fields";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

/**
 *
 * @param session
 * @param eventStuff
 * @param comment
 */

async function acknowledgeConditionEV(session: IBasicSessionAsync, eventStuff: EventStuff, comment: string): Promise<StatusCode> {
    const conditionId = eventStuff.conditionId?.value;
    const eventId = eventStuff.eventId?.value;
    try {
        return await acknowledgeCondition(session, conditionId, eventId, comment);
    } catch (err) {
        errorLog(`conditionId: ${conditionId?.toString()}`);
        errorLog("Acknowledging Condition has failed !", err);
        return StatusCodes.BadInternalError;
    }
}

async function confirmConditionEV(session: IBasicSessionAsync, eventStuff: EventStuff, comment: string): Promise<StatusCode> {
    const conditionId = eventStuff.conditionId?.value;
    const eventId = eventStuff.eventId?.value;
    try {
        return await confirmCondition(session, conditionId, eventId, comment);
    } catch (err) {
        errorLog(`conditionId: ${conditionId?.toString()}`);
        errorLog("Confirming Condition has failed !", err);
        return StatusCodes.BadInternalError;
    }
}

export type FindActiveConditions = () => Promise<EventStuff[]>;

/**
 * Enumerate all events
 * @param session
 */
export async function findActiveConditions(session: IBasicSessionEx): Promise<EventStuff[]> {
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
        nodeId: resolveNodeId("Server") // i=2253session
    };

    const fields = await extractConditionFields(session, "AcknowledgeableConditionType");

    // note: we may want to have this select clause
    //  Or(OfType("AcknowledgeableConditionType"), OfType("RefreshStartEventType"), OfType("RefreshEndEventType"))
    const eventFilter = constructEventFilter(fields);

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

    await new Promise<void>((resolve, _reject) => {
        // now create a event monitored Item
        event_monitoringItem.on("changed", (eventFields: Variant[]) => {
            try {
                if (RefreshEndEventHasBeenReceived) {
                    return;
                }

                // dumpEvent(session, fields, eventFields);
                const pojo = fieldsToJson(fields, eventFields);

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
                    acknowledgeableConditions.push(pojo);
                }
            } catch (err) {
                errorLog("Error !!", err);
            }
        });
        // async call without waiting !
        try {
            callConditionRefresh(session, subscription.subscriptionId);
        } catch (err) {
            // it is possible that server do not implement conditionRefresh ...
            errorLog("Server may not implement conditionRefresh", (err as Error).message);
        }
    });

    // now shut down subscription
    await subscription.terminate();

    return acknowledgeableConditions;
}

// let conditions = await findActiveConditions(session);
// if (conditions.length === 0) {
//     debugLog("Warning: cannot find conditions ");
// }

export async function acknowledgeAllConditions(session: IBasicSessionEx, message: string): Promise<void> {
    try {
        let conditions: EventStuff[] = await findActiveConditions(session);
        // filter acknowledgeable conditions (no acked yet)
        conditions = conditions.filter((pojo) => pojo.ackedState.id.value === false);

        const promises: Array<Promise<StatusCode>> = [];
        for (const eventStuff of conditions) {
            promises.push(acknowledgeConditionEV(session, eventStuff, message));
        }
        const result = await Promise.all(promises);
        // c8 ignore next
        if (doDebug) {
            debugLog("Acked all results: ", result.map((e) => e.toString()).join(" "));
        }
    } catch (err) {
        errorLog("Error", err);
    }
}

export async function confirmAllConditions(session: IBasicSessionEx, message: string): Promise<void> {
    try {
        let conditions: EventStuff[] = await findActiveConditions(session);
        // filter acknowledgeable conditions (no acked yet)
        conditions = conditions.filter((pojo) => pojo.confirmedState.id.value === false);

        const promises: Array<Promise<StatusCode>> = [];
        for (const eventStuff of conditions) {
            promises.push(confirmConditionEV(session, eventStuff, message));
        }
        const result = await Promise.all(promises);
        // c8 ignore next
        if (doDebug) {
            debugLog("Confirm all results: ", result.map((e) => e.toString()).join(" "));
        }
    } catch (err) {
        errorLog("Error", err);
    }
}
