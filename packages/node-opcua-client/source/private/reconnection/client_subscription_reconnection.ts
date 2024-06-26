import { promisify } from "util";
import assert from "node-opcua-assert";
import { TimestampsToReturn } from "node-opcua-data-value";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { warningLog } from "node-opcua-pki";
import { MonitoredItemCreateRequestOptions, CreateMonitoredItemsRequest, CreateMonitoredItemsResponse } from "node-opcua-types";

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

async function createMonitoredItemsAndRespectOperationalLimits(
    session: IBasicSessionReadAsync & IBasicSessionWithSubscription,
    createMonitorItemsRequest: CreateMonitoredItemsRequest
): Promise<CreateMonitoredItemsResponse> {
    const operationalLimits = await readOperationLimits(session);
    const createMonitoredItemResponse = await createMonitoredItemsLimit(
        operationalLimits.maxMonitoredItemsPerCall || 0,
        session,
        createMonitorItemsRequest
    );
    return createMonitoredItemResponse;
}

async function adjustMonitoredItemNodeIds(subscription: ClientSubscription, oldMonitoredItems: any) {
    // to Do 
}
/**
 *  utility function to recreate new subscription
 *  @method recreateSubscriptionAndMonitoredItem
 */
export async function recreateSubscriptionAndMonitoredItem(_subscription: ClientSubscription): Promise<void> {
    debugLog("recreateSubscriptionAndMonitoredItem", _subscription.subscriptionId.toString());

    const subscription = _subscription as ClientSubscriptionImpl;
    if (subscription.subscriptionId === TERMINATED_SUBSCRIPTION_ID) {
        debugLog("Subscription is not in a valid state");
        return;
    }

    const oldMonitoredItems = subscription.monitoredItems;
    const oldSubscriptionId = subscription.subscriptionId;

    subscription.publishEngine.unregisterSubscription(oldSubscriptionId);

    await promisify(__create_subscription)(subscription);

    const _err = _shouldNotContinue(subscription.session);
    if (_err) { throw _err; }

    const test = subscription.publishEngine.getSubscription(subscription.subscriptionId);

    debugLog("recreating ", Object.keys(oldMonitoredItems).length, " monitored Items");
    // re-create monitored items
    const itemsToCreate: MonitoredItemCreateRequestOptions[] = [];

    await adjustMonitoredItemNodeIds(subscription, oldMonitoredItems);

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
        throw new Error("no session");
    }

    debugLog("Recreating ", itemsToCreate.length, " monitored items");

    const response = await createMonitoredItemsAndRespectOperationalLimits(
        session,
        createMonitorItemsRequest);
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
}
