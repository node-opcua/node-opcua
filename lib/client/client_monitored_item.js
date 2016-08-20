"use strict";
/**
 * @module opcua.client
 */
require("requirish")._(module);
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var subscription_service = require("lib/services/subscription_service");
var read_service = require("lib/services/read_service");

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var assert = require("better-assert");
var TimestampsToReturn = read_service.TimestampsToReturn;

var AttributeIds = read_service.AttributeIds;

var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var ObjectTypeIds = require("lib/opcua_node_ids").ObjectTypeIds;

var _ = require("underscore");

/**
 * ClientMonitoredItem
 * @class ClientMonitoredItem
 * @extends EventEmitter
 *
 * @param subscription              {ClientSubscription}
 * @param itemToMonitor             {ReadValueId}
 * @param itemToMonitor.nodeId      {NodeId}
 * @param itemToMonitor.attributeId {AttributeId}
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
function ClientMonitoredItem(subscription, itemToMonitor, monitoringParameters, timestampsToReturn) {

    timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;

    //xx var ClientSubscription = require("./client_subscription").ClientSubscription;
    assert(subscription.constructor.name === "ClientSubscription");

    this.itemToMonitor = new read_service.ReadValueId(itemToMonitor);
    this.monitoringParameters = new subscription_service.MonitoringParameters(monitoringParameters);
    this.subscription = subscription;
    this.timestampsToReturn = timestampsToReturn;

    this.monitoringMode = subscription_service.MonitoringMode.Reporting;

}
util.inherits(ClientMonitoredItem, EventEmitter);

ClientMonitoredItem.prototype.toString = function() {

    var self = this;
    var ret = "";
    ret+="itemToMonitor:        " + self.itemToMonitor.toString() + "\n";
    ret+="monitoringParameters: " + self.monitoringParameters.toString() + "\n";
    ret+="timestampsToReturn:   " + self.timestampsToReturn.toString() + "\n";
    ret+="monitoredItemId       " + self.monitoredItemId + "\n";
    ret+="statusCode:           " + self.statusCode ? self.statusCode.toString() : "";
    return ret;
};

/**
 * remove the MonitoredItem from its subscription
 * @method terminate
 * @param  done {Function} the done callback
 * @async
 */
ClientMonitoredItem.prototype.terminate = function (done) {

    assert(!done || _.isFunction(done));
    var self = this;
    /**
     * Notify the observer that this monitored item has been terminated.
     * @event terminated
     */
    self.emit("terminated");

    self.subscription._delete_monitored_item(self, function (err) {
        if (done) {
            done(err);
        }
    });
};

ClientMonitoredItem.prototype._notify_value_change = function (value) {
    var self = this;
    /**
     * Notify the observers that the MonitoredItem value has changed on the server side.
     * @event changed
     * @param value
     */
    self.emit("changed", value);
};


/**
 * @method _monitor
 * Creates the monitor item (monitoring mode = Reporting)
 * @param done {Function} callback
 * @private
 */
ClientMonitoredItem.prototype._monitor = function (done) {

    assert(done === undefined || _.isFunction(done));

    function handle_error(err_message) {
        console.log(" ERROR " + err_message.cyan);
        if (done) {
            return done(new Error(err_message));
        }
        throw new Error(err_message);
    }

    var self = this;

    assert(self.subscription.subscriptionId !== "pending");

    self.monitoringParameters.clientHandle = self.subscription.nextClientHandle();
    assert(self.monitoringParameters.clientHandle > 0);

    // If attributeId is EventNotifier then monitoring parameters need a filter.
    // The filter must then either be DataChangeFilter, EventFilter or AggregateFilter.
    // todo can be done in another way?
    // todo implement AggregateFilter
    // todo support DataChangeFilter
    // todo support whereClause
    if (self.itemToMonitor.attributeId === AttributeIds.EventNotifier) {

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
        self.monitoringParameters.filter = self.monitoringParameters.filter || new subscription_service.EventFilter({});

        var filter = self.monitoringParameters.filter;
        if (filter._schema.name !== "EventFilter") {
            return handle_error(
                "Mismatch between attributeId and filter in monitoring parameters : " +
                "Got a " + filter._schema.name + " but a EventFilter object is required when itemToMonitor.attributeId== AttributeIds.EventNotifier");
        }

    } else if (self.itemToMonitor.attributeId === AttributeIds.Value) {
        // the DataChangeFilter and the AggregateFilter are used when monitoring Variable Values

        // The Value Attribute is used when monitoring Variables. Variable values are monitored for a change
        // in value or a change in their status. The filters defined in this standard (see 7.16.2) and in Part 8 are
        // used to determine if the value change is large enough to cause a Notification to be generated for the
        // to do : check 'DataChangeFilter'  && 'AggregateFilter'
    } else {
        if (self.monitoringParameters.filter) {
            return handle_error(
                "Mismatch between attributeId and filter in monitoring parameters : " +
                "no filter expected when attributeId is not Value  or  EventNotifier"
            );
        }
    }


    var createMonitorItemsRequest = new subscription_service.CreateMonitoredItemsRequest({

        subscriptionId:     self.subscription.subscriptionId,
        timestampsToReturn: self.timestampsToReturn,
        itemsToCreate: [
            {
                itemToMonitor: self.itemToMonitor,
                monitoringMode: self.monitoringMode,
                requestedParameters: self.monitoringParameters
            }
        ]
    });

    assert(self.subscription.session);
    self.subscription.session.createMonitoredItems(createMonitorItemsRequest, function (err, response) {

        /* istanbul ignore next */
        if (err) {
            console.log("ClientMonitoredItem#_monitor:  ERROR in createMonitoredItems ".red, err.message);
            console.log(createMonitorItemsRequest.toString());
            self.emit("err", err.message);
            self.emit("terminated");
        } else {
            assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
            assert(response.results.length === 1);
            var monitoredItemResult = response.results[0];

            self.statusCode = monitoredItemResult.statusCode;
            /* istanbul ignore else */
            if (monitoredItemResult.statusCode === StatusCodes.Good) {

                self.result = monitoredItemResult;
                self.monitoredItemId                       = monitoredItemResult.monitoredItemId;
                self.monitoringParameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
                self.monitoringParameters.queueSize        = monitoredItemResult.revisedQueueSize;
                self.filterResult                          = monitoredItemResult.filterResult;

                self.subscription._add_monitored_item(self.monitoringParameters.clientHandle, self);
                /**
                 * Notify the observers that the monitored item is now fully initialized.
                 * @event initialized
                 */
                self.emit("initialized");

            } else {

                //xx console.log(" monitoredItemResult statusCode = ".red, monitoredItemResult.statusCode.toString());
                //xx require("lib/misc/utils").dump(response);
                //xx require("lib/misc/utils").dump(createMonitorItemsRequest);

                /**
                 * Notify the observers that the monitored item has failed to initialized.
                 * @event err
                 * @param statusCode {StatusCode}
                 */
                err = new Error(monitoredItemResult.statusCode.toString());
                self.emit("err", err.message);
                self.emit("terminated");

            }
        }
        if (done) {
            done(err);
        }
    });
};

var ModifyMonitoredItemsRequest = subscription_service.ModifyMonitoredItemsRequest;
var MonitoredItemModifyRequest = subscription_service.MonitoredItemModifyRequest;

/**
 * @method modify
 * @param parameters {Object}
 * @param [timestampsToReturn=null] {TimestampsToReturn}
 * @param callback {Function}
 */
ClientMonitoredItem.prototype.modify = function (parameters, timestampsToReturn, callback) {

    var self = this;

    if (_.isFunction(timestampsToReturn)) {
        callback = timestampsToReturn;
        timestampsToReturn = null;
    }

    parameters.clientHandle = parameters.clientHandle || self.monitoringParameters.clientHandle;

    assert(callback === undefined || _.isFunction(callback));

    //xx console.log(" parameters = ",parameters);

    var modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
        subscriptionId: self.subscription.subscriptionId,
        timestampsToReturn: timestampsToReturn || self.timestampsToReturn,
        itemsToModify: [
            new MonitoredItemModifyRequest({
                monitoredItemId: self.monitoredItemId,

                requestedParameters: parameters
            })
        ]
    });

    self.subscription.session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, response) {

        /* istanbul ignore next */
        if (err) {
            return callback(err);
        }
        assert(response.results.length === 1);

        var res = response.results[0];

        /* istanbul ignore next */
        if (res.statusCode !== StatusCodes.Good) {
            return callback(new Error("Error" + res.statusCode.toString()));
        }
        callback(null, response.results[0]);
    });

};

ClientMonitoredItem.prototype.setMonitoringMode = function (monitoringMode, callback) {

    var self = this;

    self.monitoringMode = monitoringMode;

    var setMonitoringModeRequest = {
        subscriptionId: self.subscription.subscriptionId,
        monitoringMode: self.monitoringMode,
        monitoredItemIds: [self.monitoredItemId]
    };
    self.subscription.session.setMonitoringMode(setMonitoringModeRequest, function(err,results) {
       if (callback) {
           callback(err,results ? results[0] : null);
       }
    });

};

exports.ClientMonitoredItem = ClientMonitoredItem;
