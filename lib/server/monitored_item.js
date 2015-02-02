/**
 * @module opcua.server
 *
 *
 *
 *
 */
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");

var EventEmitter = require("events").EventEmitter;
var util = require("util");

var subscription_service = require("lib/services/subscription_service");
var MonitoredItemNotification = subscription_service.MonitoredItemNotification;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var MonitoringMode = subscription_service.MonitoringMode;

var minimumSamplingInterval = 50;          // 50 ms as a minimum sampling interval
var defaultSamplingInterval = 500;         // 500 ms as a default sampling interval
var maximumSamplingInterval = 1000*60*60;  // 1 hour !
/**
 * a server side monitored item
 *
 * - Once created, the MonitoredItem will raised an "samplingEvent" event every "samplingInterval" millisecond
 *   until {{#crossLink "MonitoredItem/terminate:method"}}{{/crossLink}} is called.
 *
 * - It is up to the  event receiver to call {{#crossLink "MonitoredItem/recordValue:method"}}{{/crossLink}}.
 *
 * @class MonitoredItem
 * @param options  the options
 * @param options.clientHandle     {Number}  - the client handle
 * @param options.samplingInterval {Number}  - the sampling Interval
 * @param options.discardOldest    {boolean} - if discardOldest === true, older items are removed from the queue
 *                                             when
 * @param options.queueSize        {Number} - the size of the queue.
 * @param options.monitoredItemId  {Number} the monitoredItem Id assigned by the server to this monitoredItem.
 * @constructor
 */
function MonitoredItem(options) {

    EventEmitter.apply(this, arguments);

    assert(options.hasOwnProperty("clientHandle"));
    assert(options.hasOwnProperty("samplingInterval"));
    assert(options.hasOwnProperty("monitoredItemId"));
    assert(_.isFinite(options.clientHandle));
    assert(_.isFinite(options.samplingInterval) && options.samplingInterval>= minimumSamplingInterval);
    assert(_.isBoolean(options.discardOldest));
    assert(_.isFinite(options.queueSize));
    assert(options.queueSize >= 0);

    var self = this;

    self.monitoredItemId = options.monitoredItemId; //( known as serverHandle)
    self.clientHandle = options.clientHandle;

    self.samplingInterval = Math.max(options.samplingInterval,minimumSamplingInterval);

    self.discardOldest = options.discardOldest;
    self.queueSize = options.queueSize;
    self.queue = [];
    self.overflow = false;

    self._samplingId = null;
    self._samplingId = setInterval(function () {
        self._on_sampling_timer();
    }, self.samplingInterval);

    self.oldValue = null; // unset initially

    self.monitoringMode = MonitoringMode.Disable;

}
util.inherits(MonitoredItem, EventEmitter);

MonitoredItem.minimumSamplingInterval = minimumSamplingInterval;
MonitoredItem.defaultSamplingInterval = defaultSamplingInterval;
MonitoredItem.maximumSamplingInterval = maximumSamplingInterval;

/**
 * Terminate the  MonitoredItem.
 * @method terminate
 *
 * This will stop the internal sampling timer.
 */
MonitoredItem.prototype.terminate = function () {
    var self = this;
    if (self._samplingId != null) {
        clearInterval(self._samplingId);
        self._samplingId = null;
    }
};

/**
 * @method _on_sampling_timer
 * @private
 * request
 *
 * @example
 *
 *    ```javascript
 *    var monitoredItem = new   MonitoredItem({
 *          ...
 *    });
 *    monitoredItem.on("samplingEvent",function (oldValue) {
 *
 *          var value = readValue();
 *
 *          if ( isDifferent(value, oldValue)) {
 *              monitoredItem.recordValue(value);
 *          }
 *    });
 *    ```
 */
MonitoredItem.prototype._on_sampling_timer = function () {

    var self = this;

    if (self._samplingId) {
        // @event samplingEvent
        // @param oldValue {DataValue} - the last known recorded data value.
        self.emit("samplingEvent", self.oldValue);
    } else {
        console.log("_on_sampling_timer call but MonitoredItem has been terminated !!! ")
    }
};

/**
 * @method recordValue
 * @param variant            {Variant }
 * @param sourceTimestamp    {Date|null}
 * @param sourcePicoseconds  {Number|null}
 *
 */
MonitoredItem.prototype.recordValue = function (variant, sourceTimestamp, sourcePicoseconds) {
    var self = this;
    // store last value
    self.oldValue = variant;

    sourceTimestamp = sourceTimestamp || new Date();
    sourcePicoseconds = sourcePicoseconds || 0;

    // create a MonitoredItemNotification

    var dataValue = new DataValue({
        statusCode: StatusCodes.Good,
        value: variant,
        serverTimestamp: new Date(),
        serverPicoseconds: 0,
        sourceTimestamp: sourceTimestamp,
        sourcePicoseconds: sourcePicoseconds
    });

    // push new value to queue
    self.queue.push(dataValue);

    // discard oldest if necessary
    if (self.queue.length > self.queueSize) {

        self.overflow = true;

        if (self.discardOldest) {
            // remove oldest
            self.queue.shift(); // remove front element
        } else {
            // remove newest
            self.queue.pop();
        }
    }

};

/**
 * @method  extractMonitoredItemNotifications
 * @return {Array.<*>}
 */
MonitoredItem.prototype.extractMonitoredItemNotifications = function () {
    // MonitoredItemNotification
    var self = this;
    var notifications = self.queue.map(function (dataValue) {
        return { clientHandle: self.clientHandle, value: dataValue};
    });
    // empty queue
    self.queue = [];

    return notifications;
};

MonitoredItem.prototype.setMonitoringMode = function(monitoringMode) {
    // todo : implement this
};


exports.MonitoredItem = MonitoredItem;
