require("requirish")._(module);
var util = require("util");
var _ = require("underscore");
var assert = require("better-assert");

var EventEmitter = require("events").EventEmitter;
var subscription_service = require("lib/services/subscription_service");
var read_service = require("lib/services/read_service");


var ClientMonitoredItemBase = require("./client_monitored_item_base").ClientMonitoredItemBase;
var TimestampsToReturn = read_service.TimestampsToReturn;

/**
 * ClientMonitoredItem
 * @class ClientMonitoredItem
 * @extends ClientMonitoredItemBase
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

    ClientMonitoredItemBase.call(this, subscription, itemToMonitor, monitoringParameters);

    this.timestampsToReturn = timestampsToReturn;


}
util.inherits(ClientMonitoredItem, ClientMonitoredItemBase);

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

    self.subscription._delete_monitored_items([self], function (err) {
        if (done) {
            done(err);
        }
    });
};

/**
 * @method _monitor
 * Creates the monitor item (monitoring mode = Reporting)
 * @param done {Function} callback
 * @private
 */
ClientMonitoredItem.prototype._monitor = function (done) {
    assert(done === undefined || _.isFunction(done));
    var self = this;
    ClientMonitoredItemBase._toolbox_monitor(self.subscription, self.timestampsToReturn, [self], function (err) {
        if (err) {
            self.emit("err", err.message);
            self.emit("terminated");
        } else {
            //xx  self.emit("initialized");
        }
        if (done) {
            done(err);
        }
    });
};

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
    self.timestampsToReturn = timestampsToReturn || self.timestampsToReturn;
    ClientMonitoredItemBase._toolbox_modify(self.subscription, [self], parameters, self.timestampsToReturn, function (err, results) {
        if (err) {
            return callback(err);
        }
        assert(results.length === 1);
        callback(null, results[0]);
    });
};

ClientMonitoredItem.prototype.setMonitoringMode = function (monitoringMode, callback) {
    var self = this;
    ClientMonitoredItemBase._toolbox_setMonitoringMode(self.subscription, [self], monitoringMode, callback);
};

exports.ClientMonitoredItem = ClientMonitoredItem;
