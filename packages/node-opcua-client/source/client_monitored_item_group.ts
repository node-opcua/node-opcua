/**
 * @module bode-opcua-client
 */
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { ErrorCallback } from "node-opcua-secure-channel";
import * as _ from "underscore";

import { DataValue, TimestampsToReturn } from "node-opcua-data-value";

import { MonitoringMode } from "node-opcua-service-subscription";
import { ClientMonitoredItem } from "./client_monitored_item";
import { ClientMonitoredItemBase } from "./client_monitored_item_base";
import { ClientSubscription } from "./client_subscription";


/**
 * ClientMonitoredItemGroup
 * @class ClientMonitoredItemGroup
 * @extends EventEmitter
 *
 * @param subscription              {ClientSubscription}
 * @param itemsToMonitor             {Array<ReadValueId>}
 * @param itemsToMonitor.nodeId      {NodeId}
 * @param itemsToMonitor.attributeId {AttributeId}
 *
 * @param monitoringParameters      {MonitoringParameters}
 * @param timestampsToReturn        {TimestampsToReturn}
 * @constructor
 *
 * event:
 *    "initialized"
 *    "err"
 *    "changed"
 *
 *  note: this.monitoringMode = subscription_service.MonitoringMode.Reporting;
 */
export class ClientMonitoredItemGroup extends EventEmitter {

    private subscription: ClientSubscription;
    private monitoredItems: ClientMonitoredItemBase[];
    private timestampsToReturn: TimestampsToReturn;
    private monitoringMode: MonitoringMode;

    constructor(
        subscription: ClientSubscription,
        itemsToMonitor: any[],
        monitoringParameters: any,
        timestampsToReturn: TimestampsToReturn
    ) {

        super();
        assert(_.isArray(itemsToMonitor));

        timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;

        assert(subscription.constructor.name === "ClientSubscription");

        this.subscription = subscription;

        this.monitoredItems = itemsToMonitor.map((itemToMonitor) => {
            return new ClientMonitoredItemBase(subscription, itemToMonitor, monitoringParameters);
        });

        this.timestampsToReturn = timestampsToReturn;
        this.monitoringMode = MonitoringMode.Reporting;
    }

    toString(): string {

        let ret = "";
        ret += "itemsToMonitor:        " + this.monitoredItems.map((a: ClientMonitoredItemBase) => a.monitoredItemId.toString()).join("\n");
        ret += "timestampsToReturn:   " + this.timestampsToReturn.toString() + "\n";
        ret += "monitoringMode        " + this.monitoringMode;
        return ret;
    }

    /**
     * @method terminate
     * remove the MonitoredItem from its subscription
     * @async
     */
    terminate(done: ErrorCallback) {

        assert(!done || _.isFunction(done));
        /**
         * Notify the observer that this monitored item has been terminated.
         * @event terminated
         */
        this.emit("terminated");
        this.subscription._delete_monitored_items(this.monitoredItems, (err) => {
            if (done) {
                done(err);
            }
        });
    }


    /**
     * @method _monitor
     * Creates the monitor item (monitoring mode = Reporting)
     * @private
     */
    _monitor(done: ErrorCallback) {
        assert(done === undefined || _.isFunction(done));

        this.monitoredItems.forEach((monitoredItem, index) => {
            monitoredItem.on("changed", (dataValue: DataValue) => {
                /**
                 * Notify the observers that a group MonitoredItem value has changed on the server side.
                 * @event changed
                 * @param monitoredItem
                 * @param value
                 * @param index
                 */
                try {
                    this.emit("changed", monitoredItem, dataValue, index);
                }
                catch (err) {
                    console.log(err);
                }
            });
        });


        ClientMonitoredItemBase._toolbox_monitor(this.subscription, this.timestampsToReturn, this.monitoredItems, (err?: Error) => {
            if (err) {
                this.emit("terminated");
            } else {
                this.emit("initialized");
                // set the event handler
            }

            if (done) {
                done(err);
            }
        });
    }

    /**
     * @method modify
     */
    modify(
        parameters: any,
        timestampsToReturn: TimestampsToReturn,
        callback: (err?: Error) => void
    ) {
        this.timestampsToReturn = timestampsToReturn || this.timestampsToReturn;
        ClientMonitoredItemBase._toolbox_modify(this.subscription, this.monitoredItems, parameters, this.timestampsToReturn, (err: Error | null, a?: any) => {
            callback(err ? err : undefined);
        });
    }

    setMonitoringMode(monitoringMode: MonitoringMode, callback: (err?: Error) => void) {
        ClientMonitoredItemBase._toolbox_setMonitoringMode(this.subscription, this.monitoredItems, monitoringMode, (err: Error | null, a?: any) => {
            callback(err ? err : undefined);
        });
    }
}
