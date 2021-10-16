/**
 * @module node-opcua-client
 */
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { TimestampsToReturn } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import {
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsResponse,
    MonitoredItemModifyRequest,
    MonitoredItemModifyResult,
    MonitoringMode,
    SetMonitoringModeResponse
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Callback, ErrorCallback } from "node-opcua-status-code";

import { MonitoredItemCreateRequestOptions, MonitoringParametersOptions } from "node-opcua-types";
import { ClientMonitoredItemBase } from "./client_monitored_item_base";
import { SetMonitoringModeRequestLike } from "./client_session";
import { ClientSubscription } from "./client_subscription";
import { ClientMonitoredItemImpl } from "./private/client_monitored_item_impl";
import { ClientSessionImpl } from "./private/client_session_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

/**
 * @internal
 */
export class ClientMonitoredItemToolbox {
    public static _toolbox_monitor(
        subscription: ClientSubscription,
        timestampsToReturn: TimestampsToReturn,
        monitoredItems: ClientMonitoredItemBase[],
        done: ErrorCallback
    ): void {
        assert(typeof done === "function");
        const itemsToCreate: MonitoredItemCreateRequestOptions[] = [];
        for (const monitoredItem of monitoredItems) {
            const monitoredItemI = monitoredItem as ClientMonitoredItemImpl;
            const itemToCreate = monitoredItemI._prepare_for_monitoring();
            if (typeof itemToCreate.error === "string") {
                return done(new Error(itemToCreate.error));
            }
            itemsToCreate.push(itemToCreate as MonitoredItemCreateRequestOptions);
        }

        const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
            itemsToCreate,
            subscriptionId: subscription.subscriptionId,
            timestampsToReturn
        });

        for (let i = 0; i < monitoredItems.length; i++) {
            const monitoredItem = monitoredItems[i] as ClientMonitoredItemImpl;
            monitoredItem._before_create();
        }
        const session = subscription.session as ClientSessionImpl;
        assert(session, "expecting a valid session attached to the subscription ");
        session.createMonitoredItems(createMonitorItemsRequest, (err?: Error | null, response?: CreateMonitoredItemsResponse) => {
            /* istanbul ignore next */
            if (err) {
                debugLog(chalk.red("ClientMonitoredItemBase#_toolbox_monitor:  ERROR in createMonitoredItems ", err.message));
            } else {
                /* istanbul ignore next */
                if (!response) {
                    return done(new Error("Internal Error"));
                }

                response.results = response.results || [];

                for (let i = 0; i < response.results.length; i++) {
                    const monitoredItemResult = response.results[i];
                    const monitoredItem = monitoredItems[i] as ClientMonitoredItemImpl;
                    monitoredItem._after_create(monitoredItemResult);
                }
            }
            done(err ? err : undefined);
        });
    }

    public static _toolbox_modify(
        subscription: ClientSubscription,
        monitoredItems: ClientMonitoredItemBase[],
        parameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        callback: Callback<MonitoredItemModifyResult[]>
    ): void {
        assert(callback === undefined || typeof callback === "function");

        const itemsToModify = monitoredItems.map((monitoredItem: ClientMonitoredItemBase) => {
            const clientHandle = monitoredItem.monitoringParameters.clientHandle;
            assert(clientHandle !== 4294967295);
            return new MonitoredItemModifyRequest({
                monitoredItemId: monitoredItem.monitoredItemId,
                requestedParameters: {
                    ...parameters,
                    clientHandle
                }
            });
        });
        const modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
            itemsToModify,
            subscriptionId: subscription.subscriptionId,
            timestampsToReturn
        });

        const session = subscription.session as ClientSessionImpl;
        assert(session, "expecting a valid session attached to the subscription ");

        session.modifyMonitoredItems(modifyMonitoredItemsRequest, (err: Error | null, response?: ModifyMonitoredItemsResponse) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (!response || !(response instanceof ModifyMonitoredItemsResponse)) {
                return callback(new Error("internal error"));
            }

            response.results = response.results || [];

            assert(response.results.length === monitoredItems.length);

            const res = response.results[0];

            /* istanbul ignore next */
            if (response.results.length === 1 && res.statusCode !== StatusCodes.Good) {
                return callback(new Error("Error" + res.statusCode.toString()));
            }
            callback(null, response.results);
        });
    }

    public static _toolbox_setMonitoringMode(
        subscription: ClientSubscription,
        monitoredItems: ClientMonitoredItemBase[],
        monitoringMode: MonitoringMode,
        callback: Callback<StatusCode[]>
    ): void {
        const monitoredItemIds = monitoredItems.map((monitoredItem) => monitoredItem.monitoredItemId);

        const setMonitoringModeRequest: SetMonitoringModeRequestLike = {
            monitoredItemIds,
            monitoringMode,
            subscriptionId: subscription.subscriptionId
        };

        const session = subscription.session as ClientSessionImpl;
        assert(session, "expecting a valid session attached to the subscription ");

        session.setMonitoringMode(setMonitoringModeRequest, (err: Error | null, response?: SetMonitoringModeResponse) => {
            if (err) {
                return callback(err);
            }
            monitoredItems.forEach((monitoredItem) => {
                monitoredItem.monitoringMode = monitoringMode;
            });
            response = response!;
            response.results = response.results || [];
            callback(null, response.results);
        });
    }
}
