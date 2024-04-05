import async from "async";
import assert from "node-opcua-assert";
import { TimestampsToReturn } from "node-opcua-data-value";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { warningLog } from "node-opcua-pki";
import { MonitoredItemCreateRequestOptions, CreateMonitoredItemsRequest, CreateMonitoredItemsResponse } from "node-opcua-types";
import { ErrorCallback } from "node-opcua-status-code";

import {
    IBasicSessionReadAsync,
    IBasicSessionWithSubscription,
    createMonitoredItemsLimit,
    readOperationLimits
} from "node-opcua-pseudo-session";
import { ClientSubscription } from "../../client_subscription";
import { ClientMonitoredItemImpl } from "../client_monitored_item_impl";
import { ClientSubscriptionImpl, TERMINATED_SUBSCRIPTION_ID, __create_subscription } from "../client_subscription_impl";
import { _shouldNotContinue } from "./reconnection";

const debugLog = make_debugLog("RECONNECTION");
const doDebug = checkDebugFlag("RECONNECTION");

function createMonitoredItemsAndRespectOperationalLimits(
    session: IBasicSessionReadAsync & IBasicSessionWithSubscription,
    createMonitorItemsRequest: CreateMonitoredItemsRequest,
    callback: (err: Error | null, response?: CreateMonitoredItemsResponse) => void
) {
    readOperationLimits(session)
        .then((operationalLimits) => {
            createMonitoredItemsLimit(operationalLimits.maxMonitoredItemsPerCall || 0, session, createMonitorItemsRequest)
                .then((createMonitoredItemResponse) => callback(null, createMonitoredItemResponse))
                .catch(callback);
        })
        .catch(callback);
}

/**
 *  utility function to recreate new subscription
 *  @method recreateSubscriptionAndMonitoredItem
 */
export function recreateSubscriptionAndMonitoredItem(_subscription: ClientSubscription, callback: ErrorCallback): void {
    debugLog("recreateSubscriptionAndMonitoredItem", _subscription.subscriptionId.toString());

    const subscription = _subscription as ClientSubscriptionImpl;
    if (subscription.subscriptionId === TERMINATED_SUBSCRIPTION_ID) {
        debugLog("Subscription is not in a valid state");
        return callback();
    }

    const oldMonitoredItems = subscription.monitoredItems;
    const oldSubscriptionId = subscription.subscriptionId;


    
    subscription.publishEngine.unregisterSubscription(oldSubscriptionId);

    async.series(
        [
            (innerCallback: ErrorCallback) => {
                __create_subscription(subscription, innerCallback);
            },
            (innerCallback: ErrorCallback) => {
                // prettier-ignore
                { const _err = _shouldNotContinue(subscription.session); if (_err) { return innerCallback(_err); } }

                const test = subscription.publishEngine.getSubscription(subscription.subscriptionId);

                debugLog("recreating ", Object.keys(oldMonitoredItems).length, " monitored Items");
                // re-create monitored items
                const itemsToCreate: MonitoredItemCreateRequestOptions[] = [];

                for (const monitoredItem of Object.values(oldMonitoredItems)) {
                    assert(monitoredItem.monitoringParameters.clientHandle > 0);
                    itemsToCreate.push({
                        itemToMonitor: monitoredItem.itemToMonitor,
                        monitoringMode: monitoredItem.monitoringMode,
                        requestedParameters: monitoredItem.monitoringParameters
                    });
                }

                const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
                    itemsToCreate,
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Both // this.timestampsToReturn,
                });

                const session = subscription.session;
                // istanbul ignore next
                if (!session) {
                    return innerCallback(new Error("no session"));
                }

                debugLog("Recreating ", itemsToCreate.length, " monitored items");

                createMonitoredItemsAndRespectOperationalLimits(
                    session,
                    createMonitorItemsRequest,
                    (err: Error | null, response?: CreateMonitoredItemsResponse) => {
                        if (err) {
                            debugLog("Recreating monitored item has failed with ", err.message);
                            return innerCallback(err);
                        }
                        /* istanbul ignore next */
                        if (!response) {
                            return innerCallback(new Error("Internal Error"));
                        }
                        const monitoredItemResults = response.results || [];

                        let _errCount = 0;
                        monitoredItemResults.forEach((monitoredItemResult, index) => {
                            const itemToCreate = itemsToCreate[index];
                            /* istanbul ignore next */
                            if (!itemToCreate || !itemToCreate.requestedParameters) {
                                _errCount++;
                                return;
                            }
                            const clientHandle = itemToCreate.requestedParameters.clientHandle;
                            /* istanbul ignore next */
                            if (!clientHandle) {
                                _errCount++;
                                return;
                            }
                            const monitoredItem = subscription.monitoredItems[clientHandle] as ClientMonitoredItemImpl;
                            if (monitoredItem) {
                                monitoredItem._applyResult(monitoredItemResult);
                            } else {
                                _errCount++;
                                warningLog("cannot find monitored item for clientHandle !:", clientHandle);
                                warningLog("itemsToCreate = ", itemsToCreate[index].toString());
                            }
                        });
                        if (_errCount > 0) {
                            warningLog("Warning: some monitored items have not been recreated properly");
                        }
                        innerCallback();
                    }
                );
            }
        ],
        (err) => {
            if (err) {
                warningLog("!!recreateSubscriptionAndMonitoredItem has failed", err.message);
            }
            callback(err!);
        }
    );
}
