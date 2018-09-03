/**
 * @module bode-opcua-client
 */
import chalk from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ReadValueId, ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import {
    CreateMonitoredItemsRequest, CreateMonitoredItemsResponse,
    ModifyMonitoredItemsRequest, ModifyMonitoredItemsResponse,
    MonitoredItemCreateResult, MonitoredItemModifyRequest,
    MonitoredItemModifyResult,
    MonitoringMode, MonitoringParameters, MonitoringParametersOptions, SetMonitoringModeResponse
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import { ExtensionObject } from "node-opcua-extension-object";
import { Variant } from "node-opcua-variant";

import { SetMonitoringModeRequestLike } from "./client_session";
import { ClientSubscription } from "./client_subscription";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export class ClientMonitoredItemBase extends EventEmitter {

    public itemToMonitor: ReadValueId;
    public monitoringParameters: MonitoringParameters;
    public subscription: any;
    public monitoringMode: MonitoringMode;
    public statusCode: StatusCode;
    public monitoredItemId?: any;
    public result?: MonitoredItemCreateResult;
    public filterResult?: ExtensionObject;

    constructor(
        subscription: ClientSubscription,
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions
    ) {

        super();

        this.statusCode = StatusCodes.BadDataUnavailable;

        assert(subscription.constructor.name === "ClientSubscription");
        this.itemToMonitor = new ReadValueId(itemToMonitor);
        this.monitoringParameters = new MonitoringParameters(monitoringParameters);
        this.subscription = subscription;
        this.monitoringMode = MonitoringMode.Reporting;
        assert(this.monitoringParameters.clientHandle === 0xFFFFFFFF, "should not have a client handle yet");
    }

    /**
     * @internal
     * @param value
     * @private
     */
    public _notify_value_change(value: DataValue) {
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
    public _notify_event(eventFields: Variant[]) {
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
    public _prepare_for_monitoring() {

        assert(this.subscription.subscriptionId !== "pending");
        assert(this.monitoringParameters.clientHandle === 4294967295,
            "should not have a client handle yet");

        this.monitoringParameters.clientHandle = this.subscription.nextClientHandle();

        assert(this.monitoringParameters.clientHandle > 0
            && this.monitoringParameters.clientHandle !== 4294967295);

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
            // @ts-ignore
            this.monitoringParameters.filter = this.monitoringParameters.filter || new EventFilter({});

            const filter = this.monitoringParameters.filter;
            if (!filter) {
                return {error: "Internal Error"};
            }

            if (filter.schema.name !== "EventFilter") {
                return {
                    error: "Mismatch between attributeId and filter in monitoring parameters : " +
                        "Got a " + filter.schema.name + " but a EventFilter object is required " +
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
                    error: "Mismatch between attributeId and filter in monitoring parameters : " +
                        "no filter expected when attributeId is not Value  or  EventNotifier"
                };
            }
        }
        return {
            error: null,
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
    public _after_create(monitoredItemResult: MonitoredItemCreateResult) {

        this.statusCode = monitoredItemResult.statusCode;
        /* istanbul ignore else */
        if (monitoredItemResult.statusCode === StatusCodes.Good) {
            this.result = monitoredItemResult;
            this.monitoredItemId = monitoredItemResult.monitoredItemId;
            this.monitoringParameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
            this.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
            this.filterResult = monitoredItemResult.filterResult || undefined;
            this.subscription._add_monitored_item(this.monitoringParameters.clientHandle, this);
            /**
             * Notify the observers that the monitored item is now fully initialized.
             * @event initialized
             */
            this.emit("initialized");

        } else {

            /**
             * Notify the observers that the monitored item has failed to initialized.
             * @event err
             * @param statusCode {StatusCode}
             */
            const err = new Error(monitoredItemResult.statusCode.toString());
            this.emit("err", err.message);
            this.emit("terminated");
        }
    }
}
