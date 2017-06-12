"use strict";
/**
 * @module opcua.client
 */
require("requirish")._(module);
var util = require("util");
var _ = require("underscore");

var EventEmitter = require("events").EventEmitter;
var subscription_service = require("lib/services/subscription_service");
var read_service = require("lib/services/read_service");

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var assert = require("better-assert");
var TimestampsToReturn = read_service.TimestampsToReturn;

var AttributeIds = read_service.AttributeIds;

var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var ObjectTypeIds = require("lib/opcua_node_ids").ObjectTypeIds;
var ModifyMonitoredItemsRequest = subscription_service.ModifyMonitoredItemsRequest;
var MonitoredItemModifyRequest = subscription_service.MonitoredItemModifyRequest;


function ClientMonitoredItemBase(subscription, itemToMonitor, monitoringParameters) {
    assert(subscription.constructor.name === "ClientSubscription");
    var self = this;
    self.itemToMonitor = new read_service.ReadValueId(itemToMonitor);
    self.monitoringParameters = new subscription_service.MonitoringParameters(monitoringParameters);
    self.subscription = subscription;
    self.monitoringMode = subscription_service.MonitoringMode.Reporting;
    assert(self.monitoringParameters.clientHandle === 4294967295, "should not have a client handle yet");
}
util.inherits(ClientMonitoredItemBase, EventEmitter);


ClientMonitoredItemBase.prototype._notify_value_change = function (value) {
    var self = this;
    /**
     * Notify the observers that the MonitoredItem value has changed on the server side.
     * @event changed
     * @param value
     */
     try {
       self.emit("changed", value);
     }
     catch(err) {
       console.log("Exception raised inside the event handler called by ClientMonitoredItem.on('change')",err);
       console.log("Please verify the application using this node-opcua client");
     }
};

ClientMonitoredItemBase.prototype._prepare_for_monitoring = function () {

    var self = this;
    assert(self.subscription.subscriptionId !== "pending");
    assert(self.monitoringParameters.clientHandle === 4294967295, "should not have a client handle yet");
    self.monitoringParameters.clientHandle = self.subscription.nextClientHandle();
    assert(self.monitoringParameters.clientHandle > 0 && self.monitoringParameters.clientHandle !== 4294967295);

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
            return {
                error: "Mismatch between attributeId and filter in monitoring parameters : " +
                "Got a " + filter._schema.name + " but a EventFilter object is required when itemToMonitor.attributeId== AttributeIds.EventNotifier"
            };
        }

    } else if (self.itemToMonitor.attributeId === AttributeIds.Value) {
        // the DataChangeFilter and the AggregateFilter are used when monitoring Variable Values

        // The Value Attribute is used when monitoring Variables. Variable values are monitored for a change
        // in value or a change in their status. The filters defined in this standard (see 7.16.2) and in Part 8 are
        // used to determine if the value change is large enough to cause a Notification to be generated for the
        // to do : check 'DataChangeFilter'  && 'AggregateFilter'
    } else {
        if (self.monitoringParameters.filter) {
            return {
                error: "Mismatch between attributeId and filter in monitoring parameters : " +
                "no filter expected when attributeId is not Value  or  EventNotifier"
            };
        }
    }
    return {
        error: null,
        itemToMonitor: self.itemToMonitor,
        monitoringMode: self.monitoringMode,
        requestedParameters: self.monitoringParameters
    };

};
ClientMonitoredItemBase.prototype._after_create = function (monitoredItemResult) {


    var self = this;
    self.statusCode = monitoredItemResult.statusCode;
    /* istanbul ignore else */
    if (monitoredItemResult.statusCode === StatusCodes.Good) {


        self.result = monitoredItemResult;
        self.monitoredItemId = monitoredItemResult.monitoredItemId;
        self.monitoringParameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
        self.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
        self.filterResult = monitoredItemResult.filterResult;


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
        var err = new Error(monitoredItemResult.statusCode.toString());
        self.emit("err", err.message);
        self.emit("terminated");
    }
};

ClientMonitoredItemBase._toolbox_monitor = function (subscription, timestampsToReturn, monitoredItems, done) {
    assert(_.isFunction(done));
    var itemsToCreate = [];
    for (var i = 0; i < monitoredItems.length; i++) {

        var monitoredItem = monitoredItems[i];
        var itemToCreate = monitoredItem._prepare_for_monitoring(done);
        if (_.isString(itemToCreate.error)) {
            return done(new Error(itemToCreate.error));
        }
        itemsToCreate.push(itemToCreate);
    }

    var createMonitorItemsRequest = new subscription_service.CreateMonitoredItemsRequest({
        subscriptionId: subscription.subscriptionId,
        timestampsToReturn: timestampsToReturn,
        itemsToCreate: itemsToCreate
    });

    assert(subscription.session);
    subscription.session.createMonitoredItems(createMonitorItemsRequest, function (err, response) {

        /* istanbul ignore next */
        if (err) {
            console.log("ClientMonitoredItemBase#_toolbox_monitor:  ERROR in createMonitoredItems ".red, err.message);
            console.log("ClientMonitoredItemBase#_toolbox_monitor:  ERROR in createMonitoredItems ".red, err);
            console.log(createMonitorItemsRequest.toString());
        } else {
            assert(response instanceof subscription_service.CreateMonitoredItemsResponse);

            for (var i = 0; i < response.results.length; i++) {
                var monitoredItemResult = response.results[i];
                var monitoredItem = monitoredItems[i];
                monitoredItem._after_create(monitoredItemResult);
            }
        }
        done(err);
    });

};
ClientMonitoredItemBase._toolbox_modify = function (subscription, monitoredItems, parameters, timestampsToReturn, callback) {

    assert(callback === undefined || _.isFunction(callback));

    var itemsToModify = monitoredItems.map(function (monitoredItem) {
        var clientHandle = monitoredItem.monitoringParameters.clientHandle;
        return new MonitoredItemModifyRequest({
            monitoredItemId: monitoredItem.monitoredItemId,
            requestedParameters: _.extend(_.clone(parameters), {clientHandle: clientHandle})
        });
    });
    var modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
        subscriptionId: subscription.subscriptionId,
        timestampsToReturn: timestampsToReturn,
        itemsToModify: itemsToModify
    });

    subscription.session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, response) {

        /* istanbul ignore next */
        if (err) {
            return callback(err);
        }
        assert(response.results.length === monitoredItems.length);

        var res = response.results[0];

        /* istanbul ignore next */
        if (response.results.length === 1 && res.statusCode !== StatusCodes.Good) {
            return callback(new Error("Error" + res.statusCode.toString()));
        }
        callback(null, response.results);
    });
};
ClientMonitoredItemBase._toolbox_setMonitoringMode = function (subscription, monitoredItems, monitoringMode, callback) {

    var monitoredItemIds = monitoredItems.map(function (monitoredItem) {
        return monitoredItem.monitoredItemId;
    });

    var setMonitoringModeRequest = {
        subscriptionId: subscription.subscriptionId,
        monitoringMode: monitoringMode,
        monitoredItemIds: monitoredItemIds
    };
    subscription.session.setMonitoringMode(setMonitoringModeRequest, function (err, results) {
        if (!err) {
            monitoredItems.forEach(function (monitoredItem) {
                monitoredItem.monitoringMode = monitoringMode;
            });
        }
        if (callback) {
            callback(err, results ? results[0] : null);
        }
    });

};

exports.ClientMonitoredItemBase = ClientMonitoredItemBase;
