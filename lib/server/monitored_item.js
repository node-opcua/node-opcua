"use strict";
/**
 * @module opcua.server
 *
 */
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");

var EventEmitter = require("events").EventEmitter;
var util = require("util");

var subscription_service = require("lib/services/subscription_service");
var read_service = require("lib/services/read_service");

var DataValue = require("lib/datamodel/datavalue").DataValue;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var MonitoringMode = subscription_service.MonitoringMode;
var MonitoringParameters = subscription_service.MonitoringParameters;
var MonitoredItemModifyResult = subscription_service.MonitoredItemModifyResult;
var TimestampsToReturn = read_service.TimestampsToReturn;

var minimumSamplingInterval = 50;          // 50 ms as a minimum sampling interval
var defaultSamplingInterval = 500;         // 500 ms as a default sampling interval
var maximumSamplingInterval = 1000*60*60;  // 1 hour !


function _adjust_sampling_interval(samplingInterval) {
    maximumSamplingInterval = maximumSamplingInterval ||defaultSamplingInterval;
    samplingInterval =  Math.max(samplingInterval, minimumSamplingInterval);
    samplingInterval =  Math.min(samplingInterval, maximumSamplingInterval);
    return samplingInterval;
}
var maxQueueSize = 1000;

function _adjust_queue_size(queueSize) {
    queueSize = Math.min(queueSize,maxQueueSize);
    queueSize = Math.max(1,queueSize);
    return queueSize;
}

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

    var self = this;
    self._samplingId = null;

    self._set_parameters(options);

    assert(options.hasOwnProperty("monitoredItemId"));
    self.monitoredItemId = options.monitoredItemId; //( known as serverHandle)

    self.queue = [];
    self.overflow = false;

    self._samplingId = 0;

    self.oldDataValue = null; // unset initially

    // user has to call setMonitoringMode
    self.monitoringMode = MonitoringMode.Invalid;

    self.timestampsToReturn = options.timestampsToReturn || TimestampsToReturn.Neither;


}
util.inherits(MonitoredItem, EventEmitter);

MonitoredItem.minimumSamplingInterval = minimumSamplingInterval;
MonitoredItem.defaultSamplingInterval = defaultSamplingInterval;
MonitoredItem.maximumSamplingInterval = maximumSamplingInterval;

function _validate_parameters(options) {
    assert(options.hasOwnProperty("clientHandle"));
    assert(options.hasOwnProperty("samplingInterval"));
    assert(_.isFinite(options.clientHandle));
    assert(_.isFinite(options.samplingInterval));
    assert(_.isBoolean(options.discardOldest));
    assert(_.isFinite(options.queueSize));
    assert(options.queueSize >= 0);
}

MonitoredItem.prototype._stop_timer = function() {
    var self = this;
    if (self._samplingId) {
        clearInterval(self._samplingId);
        self._samplingId = 0;
    }
};

MonitoredItem.prototype._start_timer = function() {
    var self = this;
    assert(self.samplingInterval >= minimumSamplingInterval);
    self._stop_timer();
    self._samplingId = setInterval(function () {
        self._on_sampling_timer();
    }, self.samplingInterval);
};

MonitoredItem.prototype._set_parameters = function(options) {
    var self = this;
    _validate_parameters(options);
    self.clientHandle = options.clientHandle;
    self.samplingInterval = _adjust_sampling_interval(options.samplingInterval);
    self.discardOldest = options.discardOldest;
    self.queueSize = _adjust_queue_size(options.queueSize);
};

/**
 * Terminate the  MonitoredItem.
 * @method terminate
 *
 * This will stop the internal sampling timer.
 */
MonitoredItem.prototype.terminate = function () {
    var self = this;
    self._stop_timer();
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
 *    monitoredItem.on("samplingEvent",function (oldDataValue) {
 *
 *          var value = readValue();
 *
 *          if ( isDifferent(value, oldDataValue)) {
 *              monitoredItem.recordValue(value);
 *          }
 *    });
 *    ```
 */
MonitoredItem.prototype._on_sampling_timer = function () {

    var self = this;

    if (self.monitoringMode !== MonitoringMode.Reporting) {
        return;
    }
    if (self._samplingId) {
        // @event samplingEvent
        // @param oldDataValue {DataValue} - the last known recorded data value.
        self.emit("samplingEvent", self.oldDataValue);
    } else {
        /* istanbul ignore next */
        console.log("_on_sampling_timer call but MonitoredItem has been terminated !!! ");
    }
};

function _adjust_timestamps(dataValue,timestampsToReturn) {


    assert(dataValue instanceof DataValue);

    assert(dataValue.hasOwnProperty("serverTimestamp"));
    assert(dataValue.hasOwnProperty("sourceTimestamp"));
    // apply timestamps
    switch (timestampsToReturn) {
        case TimestampsToReturn.Neither:
            dataValue.serverTimestamp = null;
            dataValue.sourceTimestamp = null;
            break;
        case TimestampsToReturn.Server:
            dataValue.serverTimestamp = dataValue.serverTimestamp || new Date();
            dataValue.sourceTimestamp = null;
            break;
        case TimestampsToReturn.Source:
            dataValue.serverTimestamp = null;
            dataValue.sourceTimestamp = dataValue.sourceTimestamp || new Date();
            break;
        case TimestampsToReturn.Both:
            dataValue.serverTimestamp = dataValue.serverTimestamp || new Date();
            dataValue.sourceTimestamp = dataValue.sourceTimestamp || dataValue.serverTimestamp;
            break;
    }
    return dataValue;
}
/**
 * @method recordValue
 * @param dataValue {DataValue}
 *
 */
MonitoredItem.prototype.recordValue = function (dataValue) {

    var self = this;

    dataValue =  dataValue instanceof DataValue ? dataValue : new DataValue(dataValue);
    // store last value
    self.oldDataValue = dataValue;

    _adjust_timestamps(dataValue,self.timestampsToReturn);

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

    var self = this;
    if (self.monitoringMode!=MonitoringMode.Reporting) {
        return [];
    }

    // MonitoredItemNotification
    var notifications = self.queue.map(function (dataValue) {
        return { clientHandle: self.clientHandle, value: dataValue};
    });
    // empty queue
    self.queue = [];
    return notifications;
};

MonitoredItem.prototype.setMonitoringMode = function(monitoringMode) {

    var self = this;
    //xx console.log("XXXXXX Setting monitoring mode = ",monitoringMode.toString());
    self.monitoringMode = monitoringMode;
    if (self.monitoringMode !== MonitoringMode.Reporting) {
        self._stop_timer();
        self.queue = [];
    } else {
        if(!self._samplingId) {
            self._start_timer();
        }
    }
};

MonitoredItem.prototype.modify = function(timestampsToReturn,options)  {

    var self = this;

    assert(options instanceof MonitoringParameters);

    self.timestampsToReturn = timestampsToReturn || self.timestampsToReturn;

    self._set_parameters(options);

    self.queue = [];

    self.setMonitoringMode(self.monitoringMode);

    return new MonitoredItemModifyResult({
        statusCode:                StatusCodes.Good,
        revisedSamplingInterval:   self.samplingInterval,
        revisedQueueSize:          self.queueSize,
        filterResult:              null
    });
};

exports.MonitoredItem = MonitoredItem;
