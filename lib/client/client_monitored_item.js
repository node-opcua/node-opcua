/**
 * @module opcua.client
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var subscription_service = require("../services/subscription_service");
var read_service = require("../services/read_service");

var OPCUAClient = require("./opcua_client").OPCUAClient;
var OPCUASession = require("./opcua_client").OPCUASession;
var StatusCodes = require('../datamodel/opcua_status_code').StatusCodes;
var assert = require('better-assert');
var TimestampsToReturn =   read_service.TimestampsToReturn;

var ClientSubscription = require("./client_subscription").ClientSubscription;
var _ = require("underscore");

/**
 * ClientMonitoredItem
 * @class ClientMonitoredItem
 * @extends EventEmitter
 *
 * @param subscription  {ClientSubscription}
 * @param itemToMonitor {ItemToMonitor}
 * @param parameters
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
 * @param {Function} the done callback
 */
ClientMonitoredItem.prototype.terminate = function (done) {

    assert(_.isFunction(done));
    var self = this;
    self.subscription._delete_monitored_item(self.monitoredItemId, function (err) {
        /**
         * Notify the observer that this monitored item has been terminated.
         * @event terminated
         */
        self.emit("terminated");
        done(err);
    });
};

ClientMonitoredItem.prototype._notify_value_change = function(value) {
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

        if (err) {
            console.log("  ERROR in createMonitoredItems ".red , err.message);
            self.emit("err", err.message);
            self.emit("terminated");
        } else {
            assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
            assert(response.results.length === 1);
            var monitoredItemResult = response.results[0];

            if (monitoredItemResult.statusCode == StatusCodes.Good) {

                self.result = monitoredItemResult;
                self.monitoredItemId = monitoredItemResult.monitoredItemId;
                self.monitoringParameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
                self.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
                self.filterResult = monitoredItemResult.filterResult;
                /**
                 * Notify the observers that the monitored item is now fully initialized.
                 * @event initialized
                 */

                self.subscription._add_monitored_item(self.monitoringParameters.clientHandle,self);

                self.emit("initialized");

            } else {
                console.log(" monitoredItemResult statusCode = ", monitoredItemResult.statusCode.toString());
                require("../misc/utils").dump(response);
                require("../misc/utils").dump(createMonitorItemsRequest);
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

exports.ClientMonitoredItem = ClientMonitoredItem;
