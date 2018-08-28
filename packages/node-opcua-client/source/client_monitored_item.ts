/**
 * @module bode-opcua-client
 */
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { ErrorCallback } from "node-opcua-secure-channel";
import { ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode, MonitoringParametersOptions } from "node-opcua-service-subscription";
import * as _ from "underscore";
import { ClientMonitoredItemBase } from "./client_monitored_item_base";
import { ClientSubscription } from "./client_subscription";

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
export class ClientMonitoredItem extends ClientMonitoredItemBase {

    public timestampsToReturn: TimestampsToReturn;

    constructor(
        subscription: ClientSubscription,
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ) {

        super(subscription, itemToMonitor, monitoringParameters);

        timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;

        assert(subscription.constructor.name === "ClientSubscription");
        this.timestampsToReturn = timestampsToReturn;
    }

    toString() {
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
    terminate(done: ErrorCallback) {

        assert(_.isFunction(done));
        /**
         * Notify the observer that this monitored item has been terminated.
         * @event terminated
         */
        this.emit("terminated");

        this.subscription._delete_monitored_items([this], (err?: Error) => {
            if (done) {
                done(err);
            }
        });
    }

    /**
     * Creates the monitor item (monitoring mode = Reporting)
     * @private
     */
    _monitor(done?: ErrorCallback) {
        assert(done === undefined || _.isFunction(done));
        ClientMonitoredItemBase._toolbox_monitor(this.subscription, this.timestampsToReturn, [this], (err?: Error) => {
            if (err) {
                this.emit("err", err.message);
                this.emit("terminated");
            }
            if (done) {
                done(err);
            }
        });
    }

    modify(parameters: any, callback: (err?: Error) => void): void;
    modify(parameters: any, timestampsToReturn: TimestampsToReturn | null, callback: (err?: Error) => void): void;
    modify(...args: any[]): void {
        if (args.length == 2) {
            return this.modify(args[0], null, args[1]);
        }
        const parameters = args[0];
        const timestampsToReturn = args[1];
        const callback = args[2];

        this.timestampsToReturn = timestampsToReturn || this.timestampsToReturn;
        ClientMonitoredItemBase._toolbox_modify(this.subscription, [this], parameters, this.timestampsToReturn,  (err: Error| null, results) => {
            if (err) {
                return callback(err);
            }
            if (!results) {
                return callback(new Error("internal error"));
            }
            assert(results.length === 1);
            callback(null, results[0]);
        });
    }

    setMonitoringMode(monitoringMode: MonitoringMode, callback: (err?: Error) => void) {
        ClientMonitoredItemBase._toolbox_setMonitoringMode(this.subscription, [this], monitoringMode, (err ?: Error | null, results?: any[]) => {
            callback(err ? err : undefined);
        });
    }

}