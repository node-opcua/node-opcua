/**
 * @module node-opcua-client-private
 */
// tslint:disable:unified-signatures
// tslint:disable:no-empty
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";

import { AttributeIds } from "node-opcua-data-model";
import { DataValue, coerceTimestampsToReturn } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { EventFilter } from "node-opcua-service-filter";
import { ReadValueId, ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import {
    MonitoredItemCreateResult,
    MonitoredItemModifyResult,
    MonitoringMode,
    MonitoringParameters,
    MonitoringParametersOptions
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { Callback, ErrorCallback } from "node-opcua-status-code";

import { ClientMonitoredItem } from "../client_monitored_item";
import { ClientMonitoredItemToolbox } from "../client_monitored_item_toolbox";
import { ClientSubscription } from "../client_subscription";
import { ClientMonitoredItem_create, ClientSubscriptionImpl } from "./client_subscription_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export type PrepareForMonitoringResult =
    | { error: string }
    | {
          error?: null;
          itemToMonitor: ReadValueIdOptions;
          monitoringMode: MonitoringMode;
          requestedParameters: MonitoringParameters;
      };

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
export class ClientMonitoredItemImpl extends EventEmitter implements ClientMonitoredItem {
    public itemToMonitor: ReadValueId;
    public monitoringParameters: MonitoringParameters;
    public subscription: ClientSubscriptionImpl;
    public monitoringMode: MonitoringMode;
    public statusCode: StatusCode;
    public monitoredItemId?: any;
    public result?: MonitoredItemCreateResult;
    public filterResult?: ExtensionObject;
    public timestampsToReturn: TimestampsToReturn;

    private _pendingDataValue?: DataValue[];
    private _pendingEvents?: Variant[][];

    constructor(
        subscription: ClientSubscription,
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        monitoringMode: MonitoringMode = MonitoringMode.Reporting
    ) {
        super();

        this.statusCode = StatusCodes.BadDataUnavailable;

        assert(subscription.constructor.name === "ClientSubscriptionImpl");
        this.subscription = subscription as ClientSubscriptionImpl;

        this.itemToMonitor = new ReadValueId(itemToMonitor);
        this.monitoringParameters = new MonitoringParameters(monitoringParameters);
        this.monitoringMode = monitoringMode;
        assert(this.monitoringParameters.clientHandle === 0xffffffff, "should not have a client handle yet");

        assert(subscription.session, "expecting session");
        timestampsToReturn = coerceTimestampsToReturn(timestampsToReturn);
        assert(subscription.constructor.name === "ClientSubscriptionImpl");
        this.timestampsToReturn = timestampsToReturn;
    }

    public toString(): string {
        let ret = "";
        ret += "itemToMonitor:        " + this.itemToMonitor.toString() + "\n";
        ret += "monitoringParameters: " + this.monitoringParameters.toString() + "\n";
        ret += "timestampsToReturn:   " + this.timestampsToReturn.toString() + "\n";
        ret += "itemToMonitor         " + this.itemToMonitor.nodeId + "\n";
        ret += "statusCode            " + this.statusCode?.toString() + "\n";
        ret += "result =" + this.result?.toString() + "\n";
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
        assert(typeof done === "function");

        const subscription = this.subscription as ClientSubscriptionImpl;
        subscription._delete_monitored_items([this], (err?: Error) => {
            if (done) {
                done(err);
            }
        });
    }

    public async modify(parameters: MonitoringParametersOptions): Promise<StatusCode>;
    public async modify(parameters: MonitoringParametersOptions, timestampsToReturn: TimestampsToReturn): Promise<StatusCode>;
    public modify(parameters: MonitoringParametersOptions, callback: (err: Error | null, statusCode?: StatusCode) => void): void;
    public modify(
        parameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn | null,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void;
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
            }
        );
    }

    public async setMonitoringMode(monitoringMode: MonitoringMode): Promise<StatusCode>;
    public setMonitoringMode(monitoringMode: MonitoringMode, callback: Callback<StatusCode>): void;
    public setMonitoringMode(...args: any[]): any {
        const monitoringMode = args[0] as MonitoringMode;
        const callback = args[1] as Callback<StatusCode>;

        ClientMonitoredItemToolbox._toolbox_setMonitoringMode(
            this.subscription,
            [this],
            monitoringMode,
            (err?: Error | null, statusCodes?: StatusCode[]) => {
                callback(err ? err : null, statusCodes![0]);
            }
        );
    }

    /**
     * @internal
     * @param value
     * @private
     */
    public _notify_value_change(value: DataValue): void {
        // it is possible that the first notification arrives before the CreateMonitoredItemsRequest is fully proceed
        // in this case we need to put the dataValue aside so we can send the notification changed after
        // the node-opcua client had time to fully install the on("changed") event handler
        if (this.statusCode?.value === StatusCodes.BadDataUnavailable.value) {
            this._pendingDataValue = this._pendingDataValue || [];
            this._pendingDataValue.push(value);
            return;
        }
        /**
         * Notify the observers that the MonitoredItem value has changed on the server side.
         * @event changed
         * @param value
         */
        try {
            this.emit("changed", value);
        } catch (err) {
            debugLog("Exception raised inside the event handler called by ClientMonitoredItem.on('change')", err);
            debugLog("Please verify the application using this node-opcua client");
        }
    }

    /**
     * @internal
     * @param eventFields
     * @private
     */
    public _notify_event(eventFields: Variant[]): void {
        if (this.statusCode?.value === StatusCodes.BadDataUnavailable.value) {
            this._pendingEvents = this._pendingEvents || [];
            this._pendingEvents.push(eventFields);
            return;
        }
        /**
         * Notify the observers that the MonitoredItem value has changed on the server side.
         * @event changed
         * @param value
         */
        try {
            this.emit("changed", eventFields);
        } catch (err) {
            debugLog("Exception raised inside the event handler called by ClientMonitoredItem.on('change')", err);
            debugLog("Please verify the application using this node-opcua client");
        }
    }

    /**
     * @internal
     * @private
     */
    public _prepare_for_monitoring(): PrepareForMonitoringResult {
        assert(this.monitoringParameters.clientHandle === 4294967295, "should not have a client handle yet");

        const subscription = this.subscription as ClientSubscriptionImpl;

        this.monitoringParameters.clientHandle = subscription.nextClientHandle();

        assert(this.monitoringParameters.clientHandle > 0 && this.monitoringParameters.clientHandle !== 4294967295);

        // If attributeId is EventNotifier then monitoring parameters need a filter.
        // The filter must then either be DataChangeFilter, EventFilter or AggregateFilter.
        // todo can be done in another way?
        // todo implement AggregateFilter
        // todo support DataChangeFilter
        // todo support whereClause
        if (this.itemToMonitor.attributeId === AttributeIds.EventNotifier) {
            //
            // see OPCUA Spec 1.02 part 4 page 65 : 5.12.1.4 Filter
            // see                 part 4 page 130: 7.16.3 EventFilter
            //                     part 3 page 11 : 4.6 Event Model
            // To monitor for Events, the attributeId element of the ReadValueId structure is the
            // the id of the EventNotifierAttribute

            // OPC Unified Architecture 1.02, Part 4 5.12.1.2 Sampling interval page 64:
            // "A Client shall define a sampling interval of 0 if it subscribes for Events."
            // toDO

            // note : the EventFilter is used when monitoring Events.
            this.monitoringParameters.filter = this.monitoringParameters.filter! || new EventFilter({});

            const filter = this.monitoringParameters.filter;

            // istanbul ignore next
            if (!filter) {
                return { error: "Internal Error" };
            }

            if (filter.schema.name !== "EventFilter") {
                return {
                    error:
                        "Mismatch between attributeId and filter in monitoring parameters : " +
                        "Got a " +
                        filter.schema.name +
                        " but a EventFilter object is required " +
                        "when itemToMonitor.attributeId== AttributeIds.EventNotifier"
                };
            }
        } else if (this.itemToMonitor.attributeId === AttributeIds.Value) {
            // the DataChangeFilter and the AggregateFilter are used when monitoring Variable Values
            // The Value Attribute is used when monitoring Variables. Variable values are monitored for a change
            // in value or a change in their status. The filters defined in this standard (see 7.16.2) and in Part 8 are
            // used to determine if the value change is large enough to cause a Notification to be generated for the
            // to do : check 'DataChangeFilter'  && 'AggregateFilter'
        } else {
            if (this.monitoringParameters.filter) {
                return {
                    error:
                        "Mismatch between attributeId and filter in monitoring parameters : " +
                        "no filter expected when attributeId is not Value  or  EventNotifier"
                };
            }
        }
        return {
            itemToMonitor: this.itemToMonitor,
            monitoringMode: this.monitoringMode,
            requestedParameters: this.monitoringParameters
        };
    }

    /**
     * @internal
     * @param monitoredItemResult
     * @private
     */
    public _applyResult(monitoredItemResult: MonitoredItemCreateResult): void {
        this.statusCode = monitoredItemResult.statusCode;

        /* istanbul ignore else */
        if (monitoredItemResult.statusCode === StatusCodes.Good) {
            this.result = monitoredItemResult;
            this.monitoredItemId = monitoredItemResult.monitoredItemId;
            this.monitoringParameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
            this.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
            this.filterResult = monitoredItemResult.filterResult || undefined;
        }

        // some PublishRequest with DataNotificationChange might have been sent by the server, before the monitored
        // item has been fully initialized it is time to process now any pending notification that were put on hold.
        if (this._pendingDataValue) {
            const dataValues = this._pendingDataValue;
            this._pendingDataValue = undefined;
            setImmediate(() => {
                dataValues.map((dataValue) => this._notify_value_change(dataValue));
            });
        }

        if (this._pendingEvents) {
            const events = this._pendingEvents;
            this._pendingEvents = undefined;
            setImmediate(() => {
                events.map((event) => this._notify_event(event));
            });
        }
    }
    public _before_create(): void {
        const subscription = this.subscription as ClientSubscriptionImpl;
        subscription._add_monitored_item(this.monitoringParameters.clientHandle, this);
    }
    /**
     * @internal
     * @param monitoredItemResult
     * @private
     */
    public _after_create(monitoredItemResult: MonitoredItemCreateResult): void {
        this._applyResult(monitoredItemResult);

        if (this.statusCode === StatusCodes.Good) {
            /**
             * Notify the observers that the monitored item is now fully initialized.
             * @event initialized
             */
            this.emit("initialized");
        } else {
            /**
             * Notify the observers that the monitored item has failed to initialize.
             * @event err
             * @param statusCode {StatusCode}
             */
            const err = new Error(monitoredItemResult.statusCode.toString());
            this._terminate_and_emit(err);
        }
    }

    public _terminate_and_emit(err?: Error): void {
        if (this.statusCode.value === StatusCodes.Bad.value) {
            return; // already terminated
        }
        if (err) {
            this.emit("err", err.message);
        }
        assert(!(this as any)._terminated);
        (this as any)._terminated = true;
        /**
         * Notify the observer that this monitored item has been terminated.
         * @event terminated
         */
        this.emit("terminated", err);
        this.removeAllListeners();
        this.statusCode = StatusCodes.Bad;

        // also remove from subscription
        const clientHandle = this.monitoringParameters.clientHandle;
        delete this.subscription.monitoredItems[clientHandle];
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };

ClientMonitoredItemImpl.prototype.terminate = thenify.withCallback(ClientMonitoredItemImpl.prototype.terminate);
ClientMonitoredItemImpl.prototype.setMonitoringMode = thenify.withCallback(ClientMonitoredItemImpl.prototype.setMonitoringMode);
ClientMonitoredItemImpl.prototype.modify = thenify.withCallback(ClientMonitoredItemImpl.prototype.modify);

ClientMonitoredItem.create = (
    subscription: ClientSubscription,
    itemToMonitor: ReadValueIdOptions,
    monitoringParameters: MonitoringParametersOptions,
    timestampsToReturn: TimestampsToReturn,
    monitoringMode: MonitoringMode = MonitoringMode.Reporting
): ClientMonitoredItem => {
    return ClientMonitoredItem_create(subscription, itemToMonitor, monitoringParameters, timestampsToReturn, monitoringMode);
};
