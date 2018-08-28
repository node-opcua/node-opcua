/**
 * @module bode-opcua-client
 */
import * as async from "async";
import { EventEmitter } from "events";
import * as  fs from "fs";
import { assert } from "node-opcua-assert";
import { ObjectTypeIds } from "node-opcua-constants";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { ReadValueId, ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import {
    CreateMonitoredItemsRequest, CreateMonitoredItemsResponse,
    ModifyMonitoredItemsRequest, ModifyMonitoredItemsResponse,
    MonitoredItemCreateResult, MonitoredItemModifyRequest,
    MonitoredItemModifyResult,
    MonitoringMode, MonitoringParameters, MonitoringParametersOptions, SetMonitoringModeResponse
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import * as  path from "path";
import * as _ from "underscore";
import * as util from "util";

import { ExtensionObject } from "node-opcua-extension-object";
import { Variant } from "node-opcua-variant";
import { SetMonitoringModeRequestLike } from "./client_session";
import { ClientSubscription } from "./client_subscription";

export class ClientMonitoredItemBase extends EventEmitter {

    public itemToMonitor: ReadValueId;
    public monitoringParameters: MonitoringParameters;
    public subscription: any;
    public monitoringMode: MonitoringMode;
    public statusCode: StatusCode;
    public monitoredItemId?: any;
    public result?: MonitoredItemCreateResult;
    public filterResult?: ExtensionObject;


    constructor(subscription: ClientSubscription, itemToMonitor: ReadValueIdOptions, monitoringParameters: MonitoringParametersOptions) {

        super();

        this.statusCode = StatusCodes.BadDataUnavailable;

        assert(subscription.constructor.name === "ClientSubscription");
        this.itemToMonitor = new ReadValueId(itemToMonitor);
        this.monitoringParameters = new MonitoringParameters(monitoringParameters);
        this.subscription = subscription;
        this.monitoringMode = MonitoringMode.Reporting;
        assert(this.monitoringParameters.clientHandle === 0xFFFFFFFF, "should not have a client handle yet");
    }


    public _notify_value_change(value: DataValue) {
        /**
         * Notify the observers that the MonitoredItem value has changed on the server side.
         * @event changed
         * @param value
         */
        try {
            this.emit("changed", value);
        }
        catch (err) {
            console.log("Exception raised inside the event handler called by ClientMonitoredItem.on('change')", err);
            console.log("Please verify the application using this node-opcua client");
        }
    }
    public _notify_event(eventFields: Variant[]) {
        /**
         * Notify the observers that the MonitoredItem value has changed on the server side.
         * @event changed
         * @param value
         */
        try {
            this.emit("changed", eventFields);
        }
        catch (err) {
            console.log("Exception raised inside the event handler called by ClientMonitoredItem.on('change')", err);
            console.log("Please verify the application using this node-opcua client");
        }
    }

    private _prepare_for_monitoring() {
        assert(this.subscription.subscriptionId !== "pending");
        assert(this.monitoringParameters.clientHandle === 4294967295, "should not have a client handle yet");
        this.monitoringParameters.clientHandle = this.subscription.nextClientHandle();
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
            // @ts-ignore
            this.monitoringParameters.filter = this.monitoringParameters.filter || new EventFilter({});

            const filter = this.monitoringParameters.filter;
            if (!filter) {
                return {error: "Internal Error"};
            }

            if (filter.schema.name !== "EventFilter") {
                return {
                    error: "Mismatch between attributeId and filter in monitoring parameters : " +
                        "Got a " + filter.schema.name + " but a EventFilter object is required when itemToMonitor.attributeId== AttributeIds.EventNotifier"
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

    private _after_create(monitoredItemResult: MonitoredItemCreateResult) {

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

    static _toolbox_monitor(
        subscription: ClientSubscription,
        timestampsToReturn: TimestampsToReturn,
        monitoredItems: ClientMonitoredItemBase[],
        done: (err?: Error) => void
    ) {
        assert(_.isFunction(done));
        const itemsToCreate = [];
        for (let i = 0; i < monitoredItems.length; i++) {

            const monitoredItem = monitoredItems[i];
            const itemToCreate = monitoredItem._prepare_for_monitoring();

            if (_.isString(itemToCreate.error)) {
                return done(new Error(itemToCreate.error));
            }
            itemsToCreate.push(itemToCreate);
        }

        const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
            subscriptionId: subscription.subscriptionId,
            timestampsToReturn,
            itemsToCreate
        });

        assert(subscription.session);
        subscription.session.createMonitoredItems(createMonitorItemsRequest, (err?: Error | null, response?: CreateMonitoredItemsResponse) => {

            /* istanbul ignore next */
            if (err) {
                // console.log("ClientMonitoredItemBase#_toolbox_monitor:  ERROR in createMonitoredItems ".red, err.message);
                //  console.log("ClientMonitoredItemBase#_toolbox_monitor:  ERROR in createMonitoredItems ".red, err);
                //  console.log(createMonitorItemsRequest.toString());
            } else {
                if (!response) {
                    return done(new Error("Internal Error"));
                }

                response.results = response.results || [];

                for (let i = 0; i < response.results.length; i++) {
                    const monitoredItemResult = response.results[i];
                    const monitoredItem = monitoredItems[i];
                    monitoredItem._after_create(monitoredItemResult);
                }
            }
            done(err ? err : undefined);
        });

    }

    static _toolbox_modify(
        subscription: ClientSubscription,
        monitoredItems: ClientMonitoredItemBase[],
        parameters: any,
        timestampsToReturn: TimestampsToReturn,
        callback: (err: Error | null, results?: MonitoredItemModifyResult[]) => void
    ) {

        assert(callback === undefined || _.isFunction(callback));

        const itemsToModify = monitoredItems.map((monitoredItem: ClientMonitoredItemBase) => {
            const clientHandle = monitoredItem.monitoringParameters.clientHandle;
            return new MonitoredItemModifyRequest({
                monitoredItemId: monitoredItem.monitoredItemId,
                requestedParameters: _.extend(_.clone(parameters), {clientHandle})
            });
        });
        const modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
            subscriptionId: subscription.subscriptionId,
            timestampsToReturn,
            itemsToModify
        });

        subscription.session.modifyMonitoredItems(modifyMonitoredItemsRequest, (err: Error | null, response?: ModifyMonitoredItemsResponse) => {

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

    static _toolbox_setMonitoringMode(
        subscription: ClientSubscription,
        monitoredItems: ClientMonitoredItemBase[],
        monitoringMode: MonitoringMode,
        callback: (err: Error | null, statusCodes?: StatusCode[]) => void
    ) {

        const monitoredItemIds = monitoredItems.map((monitoredItem) => monitoredItem.monitoredItemId);

        const setMonitoringModeRequest: SetMonitoringModeRequestLike = {
            subscriptionId: subscription.subscriptionId,
            monitoringMode,
            monitoredItemIds
        };

        subscription.session.setMonitoringMode(setMonitoringModeRequest, (err: Error | null, response?: SetMonitoringModeResponse) => {

            if (err) {
                return callback(err);
            }
            if (!response) {
                return callback(new Error("Internal Error"));
            }
            monitoredItems.forEach((monitoredItem) => {
                monitoredItem.monitoringMode = monitoringMode;
            });
            response.results = response.results || [];
            callback(null, response.results);
        });
    }
}
