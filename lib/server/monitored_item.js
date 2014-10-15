/**
 * @module opcua.server
 *
 *
 *
 *
 */
var assert = require("better-assert");
var _ = require("underscore");

var EventEmitter = require("events").EventEmitter;
var util = require("util");

var subscription_service = require("../services/subscription_service");
var MonitoredItemNotification = subscription_service.MonitoredItemNotification;
var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;


var minimumSamplingInterval = 50;   // 50 ms as a minimum sampling interval
var defaultSamplingInterval = 500; // 500 ms as a default sampling interval
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
 * @constructor
 */
function MonitoredItem(options) {

    EventEmitter.apply(this, arguments);

    assert(options.hasOwnProperty("clientHandle"));
    assert(options.hasOwnProperty("samplingInterval"));
    assert(_.isFinite(options.clientHandle));
    assert(_.isFinite(options.samplingInterval));
    assert(_.isBoolean(options.discardOldest));
    assert(_.isFinite(options.queueSize));
    assert(options.queueSize > 0);

    var self = this;

    self.clientHandle = options.clientHandle;

    self.samplingInterval = Math.max(self.samplingInterval,minimumSamplingInterval);
    self.samplingInterval = options.samplingInterval || defaultSamplingInterval;

    self.discardOldest = options.discardOldest;
    self.queueSize = options.queueSize;
    self.queue = [];
    self.overflow = false;

    self._samplingId = null;
    self._samplingId = setInterval(function () {
        self._on_sampling_timer();
    }, self.samplingInterval);

    self.oldValue = new Variant({dataType: DataType.Null, value: null});

}
util.inherits(MonitoredItem, EventEmitter);

/**
 * Terminate the  MonitoredItem.
 * @method terminate
 *
 * This will stop the internal sampling timer.
 */
MonitoredItem.prototype.terminate = function () {
    var self = this;
    assert(self._samplingId != null);
    clearInterval(self._samplingId);
    self._samplingId = null;
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
    // @event samplingEvent
    // @param oldValue {DataValue} - the last known recorded data value.
    self.emit("samplingEvent", self.oldValue);
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


exports.MonitoredItem = MonitoredItem;
