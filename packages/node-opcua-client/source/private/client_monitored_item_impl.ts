/**
 * @module node-opcua-client
 */
// tslint:disable:unified-signatures
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import {
    MonitoredItemModifyResult,
    MonitoringMode,
    MonitoringParametersOptions
 } from "node-opcua-service-subscription";
import { StatusCode } from "node-opcua-status-code";

import { ClientMonitoredItem } from "../client_monitored_item";
import { ClientMonitoredItemBase } from "../client_monitored_item_base";
import { ClientMonitoredItemToolbox } from "../client_monitored_item_toolbox";
import { ClientSubscription } from "../client_subscription";
import { Callback, ErrorCallback } from "../common";
import { ClientMonitoredItemBaseImpl } from "./client_monitored_item_base_impl";
import { ClientSubscriptionImpl } from "./client_subscription_impl";

/**
 * ClientMonitoredItem
 * @class ClientMonitoredItem
 * @extends ClientMonitoredItemBase
 *
 * event:
 *    "initialized"
 *    "err"
 *    "changed"
 *
 *  note: this.monitoringMode = subscription_service.MonitoringMode.Reporting;
 */
export class ClientMonitoredItemImpl extends ClientMonitoredItemBaseImpl implements ClientMonitoredItem {

    public timestampsToReturn: TimestampsToReturn;

    constructor(
        subscription: ClientSubscription,
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ) {

        assert(subscription.session, "expecting session");
        super(subscription, itemToMonitor, monitoringParameters);
        timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;
        assert(subscription.constructor.name === "ClientSubscriptionImpl");
        this.timestampsToReturn = timestampsToReturn;

    }

    public toString(): string {
        let ret = "";
        ret += "itemToMonitor:        " + this.itemToMonitor.toString() + "\n";
        ret += "monitoringParameters: " + this.monitoringParameters.toString() + "\n";
        ret += "timestampsToReturn:   " + this.timestampsToReturn.toString() + "\n";
        ret += "itemToMonitor         " + this.itemToMonitor.nodeId + "\n";
        return ret;
    }

    /**
     * remove the MonitoredItem from its subscription
     * @async
     */
    public async terminate(): Promise<void>;
    public terminate(done: ErrorCallback): void;
    public terminate(...args: any[]): any {

        const done = args[0];
        assert(_.isFunction(done));
        /**
         * Notify the observer that this monitored item has been terminated.
         * @event terminated
         */
        this.emit("terminated");

        const subscription = this.subscription as ClientSubscriptionImpl;
        subscription._delete_monitored_items([this], (err?: Error) => {
            if (done) {
                done(err);
            }
        });
    }

    public async modify(
        parameters: MonitoringParametersOptions
    ): Promise<StatusCode>;
    public async modify(
        parameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): Promise<StatusCode>;
    public modify(
        parameters: MonitoringParametersOptions,
        callback: (err: Error|null, statusCode?: StatusCode) => void): void;
    public modify(
        parameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn | null,
        callback: (err: Error | null, statusCode?: StatusCode) => void): void;
    public modify(...args: any[]): any {
        if (args.length === 2) {
            return this.modify(args[0], null, args[1]);
        }
        const parameters = args[0] as MonitoringParametersOptions;
        const timestampsToReturn = args[1] as TimestampsToReturn;
        const callback = args[2];
        this.timestampsToReturn = timestampsToReturn || this.timestampsToReturn;
        ClientMonitoredItemToolbox._toolbox_modify(
            this.subscription,
            [this],
            parameters,
            this.timestampsToReturn,
            (err: Error | null, results?: MonitoredItemModifyResult[]) => {
                if (err) {
                    return callback(err);
                }
                if (!results) {
                    return callback(new Error("internal error"));
                }
                assert(results!.length === 1);
                callback(null, results![0]);
            });
    }

    public async setMonitoringMode(monitoringMode: MonitoringMode): Promise<StatusCode>;
    public setMonitoringMode(monitoringMode: MonitoringMode, callback: Callback<StatusCode>): void;
    public setMonitoringMode(...args: any[]): any {

        const monitoringMode = args[0] as MonitoringMode;
        const callback = args[1] as Callback<StatusCode>;

        ClientMonitoredItemToolbox._toolbox_setMonitoringMode(
            this.subscription,
            [this],
            monitoringMode, (err ?: Error | null, statusCodes?: StatusCode[]) => {
                callback(err ? err : null, statusCodes![0]);
            });
    }

    /**
     * Creates the monitor item (monitoring mode = Reporting)
     * @private
     * @internal
     */
    public _monitor(done?: ErrorCallback) {
        assert(done === undefined || _.isFunction(done));
        ClientMonitoredItemToolbox._toolbox_monitor(
            this.subscription,
            this.timestampsToReturn,
            [this], (err?: Error) => {
                if (err) {
                    this.emit("err", err.message);
                    this.emit("terminated");
                }
                if (done) {
                    done(err);
                }
            });
    }

}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = {multiArgs: false};

ClientMonitoredItemImpl.prototype.terminate = thenify.withCallback(ClientMonitoredItemImpl.prototype.terminate);
ClientMonitoredItemImpl.prototype.setMonitoringMode = thenify.withCallback(ClientMonitoredItemImpl.prototype.setMonitoringMode);
ClientMonitoredItemImpl.prototype.modify = thenify.withCallback(ClientMonitoredItemImpl.prototype.modify);

ClientMonitoredItem.create = (
    subscription: ClientSubscription,
    itemToMonitor: ReadValueIdOptions,
    monitoringParameters: MonitoringParametersOptions,
    timestampsToReturn: TimestampsToReturn
) => {
    const monitoredItem = new ClientMonitoredItemImpl(
        subscription,
        itemToMonitor,
        monitoringParameters,
        timestampsToReturn
    );

    setImmediate(() => {
        (subscription as ClientSubscriptionImpl)._wait_for_subscription_to_be_ready((err?: Error) => {
            if (err) {
                return;
            }
            monitoredItem._monitor((err1?: Error) => {
            });
        });

    });
    return monitoredItem;

};
