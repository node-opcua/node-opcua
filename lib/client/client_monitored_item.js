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

var _ = require("underscore");

/**
 * ClientMonitoredItem
 * @class ClientMonitoredItem
 * @extends EventEmitter
 *
 * @param subscription  {ClientSubscription}
 * @param itemToMonitor {ItemToMonitor}
 * @param monitoringParameters
 * @param timestampsToReturn
 * @constructor
 *
 * event:
 *    "initialized"
 *    "err"
 *    "changed"
 */
function ClientMonitoredItem(subscription, itemToMonitor, monitoringParameters, timestampsToReturn) {

    timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;

    //xx var ClientSubscription = require("./client_subscription").ClientSubscription;
    assert(subscription.constructor.name === "ClientSubscription");

    this.itemToMonitor = itemToMonitor;
    this.monitoringParameters = new subscription_service.MonitoringParameters(monitoringParameters);
    this.subscription = subscription;
    this.timestampsToReturn = timestampsToReturn;
}

util.inherits(ClientMonitoredItem, EventEmitter);

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
        if (done) { done(err); }
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

ClientMonitoredItem.prototype._monitor = function (done) {

    assert(done === undefined || _.isFunction(done));

    var self = this;

    assert(self.subscription.subscriptionId !== "pending");

    self.monitoringParameters.clientHandle = self.subscription.nextClientHandle();
    assert(self.monitoringParameters.clientHandle > 0);

    // If attributeId is EventNotifier then monitoring parameters need a filter.
    // The filter must then either be DataChangeFilter, EventFilter or AggregateFilter.
    // todo can be done in another way?
    // todo implement AggregateFilter
    if (!((self.itemToMonitor.attributeId === AttributeIds.EventNotifier
            && self.monitoringParameters.filter
            && (self.monitoringParameters.filter instanceof subscription_service.EventFilter
                || self.monitoringParameters.filter instanceof subscription_service.DataChangeFilter))
        || self.itemToMonitor.attributeId !== AttributeIds.EventNotifier
            && !self.monitoringParameters.filter)) {
        throw new Error({ message: 'Mismatch between attributeId and filter in monitoring parameters'});
    }

    var createMonitorItemsRequest = new subscription_service.CreateMonitoredItemsRequest({
        subscriptionId: self.subscription.subscriptionId,
        // timestampsToReturn:
        timestampsToReturn: self.timestampsToReturn,
        itemsToCreate: [
            {
                itemToMonitor: self.itemToMonitor,
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: self.monitoringParameters
            }
        ]
    });

    self.subscription.session.createMonitoredItems(createMonitorItemsRequest, function (err, response) {

        /* istanbul ignore next */
        if (err) {
            console.log("  ERROR in createMonitoredItems ".red, err.message);
            self.emit("err", err.message);
            self.emit("terminated");
        } else {
            assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
            assert(response.results.length === 1);
            var monitoredItemResult = response.results[0];

            /* istanbul ignore else */
            if (monitoredItemResult.statusCode === StatusCodes.Good) {

                self.result = monitoredItemResult;
                self.monitoredItemId = monitoredItemResult.monitoredItemId;
                self.monitoringParameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
                self.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
                self.filterResult = monitoredItemResult.filterResult;

                /**
                 * Notify the observers that the monitored item is now fully initialized.
                 * @event initialized
                 */
                self.subscription._add_monitored_item(self.monitoringParameters.clientHandle, self);

                self.emit("initialized");

            } else {

                //xx console.log(" monitoredItemResult statusCode = ".red, monitoredItemResult.statusCode.toString());
                //xx require("lib/misc/utils").dump(response);
                //xx require("lib/misc/utils").dump(createMonitorItemsRequest);

                /**
                 * Notify the observers that the monitored item is now fully initialized.
                 * @event err
                 * @param statusCode {StatusCode}
                 */
                self.emit("err", monitoredItemResult.statusCode);
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
 *
 * @param parameters
 * @param [timestampsToReturn=null]
 *  MonitoredItemModifyRequest
 * @param callback
 */
ClientMonitoredItem.prototype.modify = function(parameters,timestampsToReturn,callback) {

    var self = this;

    if (_.isFunction(timestampsToReturn)) {
        callback = timestampsToReturn;
        timestampsToReturn = null;
    }

    parameters.clientHandle =   parameters.clientHandle ||  self.monitoringParameters.clientHandle;

    assert(callback === undefined || _.isFunction(callback));

    //xx console.log(" parameters = ",parameters);

    var modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
        subscriptionId:     self.subscription.subscriptionId,
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
        if(err) {
            return callback(err);
        }
        assert(response.results.length === 1);

        var res = response.results[0];

        /* istanbul ignore next */
        if ( res.statusCode !== StatusCodes.Good) {
            return callback(new Error("Error" +  res.statusCode.toString() ));
        }
        callback(null,response.results[0]);
    });

};

exports.ClientMonitoredItem = ClientMonitoredItem;
