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
var Variant = require("lib/datamodel/variant").Variant;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var MonitoringMode = subscription_service.MonitoringMode;
var MonitoringParameters = subscription_service.MonitoringParameters;
var MonitoredItemModifyResult = subscription_service.MonitoredItemModifyResult;
var TimestampsToReturn = read_service.TimestampsToReturn;

var apply_timestamps = require("lib/datamodel/datavalue").apply_timestamps;


var defaultItemToMonitor = {indexRange: null, attributeId: read_service.AttributeIds.Value};


var minimumSamplingInterval = 50;          // 50 ms as a minimum sampling interval
var defaultSamplingInterval = 1500;        // 1500 ms as a default sampling interval
var maximumSamplingInterval = 1000*60*60;  // 1 hour !


function _adjust_sampling_interval(samplingInterval) {

    if (samplingInterval === 0) {
        return 0;
    }
    samplingInterval = samplingInterval || defaultSamplingInterval;
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
 * @param options.filter           {ExtensionObject}
 * @param options.discardOldest    {boolean} - if discardOldest === true, older items are removed from the queue
 *                                             when
 * @param options.queueSize        {Number} - the size of the queue.
 * @param options.monitoredItemId  {Number} the monitoredItem Id assigned by the server to this monitoredItem.
 * @param options.itemToMonitor
 * @param options.monitoringMode
 * @param options.timestampsToReturn
 * @constructor
 */
function MonitoredItem(options) {

    EventEmitter.apply(this, arguments);
    options.itemToMonitor = options.itemToMonitor || defaultItemToMonitor;

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
    assert(!options.monitoringMode," use setMonitoring mode explicitly to activate the monitored item");
    self.monitoringMode = MonitoringMode.Invalid;

    self.timestampsToReturn = options.timestampsToReturn || TimestampsToReturn.Neither;

    self.itemToMonitor = options.itemToMonitor;

    self.filter = options.filter || null;
}
util.inherits(MonitoredItem, EventEmitter);


var ObjectRegisty = require("lib/misc/objectRegistry").ObjectRegisty;
var g_running_MonitoredItem= new ObjectRegisty();
MonitoredItem.getRunningMonitoredItemCount = g_running_MonitoredItem.count.bind(g_running_MonitoredItem);


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
        g_running_MonitoredItem.unregister(self);
    }
};

MonitoredItem.prototype._start_timer = function() {
    var self = this;

    if (self.samplingInterval === 0) {
        assert(!self._samplingId);
        // we have a event based model, so we do not need a timer
        return;
    }

    assert(self.samplingInterval >= minimumSamplingInterval);
    self._stop_timer();

    g_running_MonitoredItem.register(self);

    self._samplingId = setInterval(function () {
        self._on_sampling_timer();
    }, self.samplingInterval);
};



MonitoredItem.prototype.setMonitoringMode = function(monitoringMode) {
    var self = this;
    //xx console.log("XXXXXX Setting monitoring mode = ",monitoringMode.toString());
    self.monitoringMode = monitoringMode;
    self._adjust_timer();
};

MonitoredItem.prototype._adjust_timer = function() {
    var self = this;
    if (self.monitoringMode !== MonitoringMode.Reporting) {
        self._stop_timer();
        self.queue = [];
    } else {
        if(!self._samplingId) {
            self._start_timer();
        }
    }
};


MonitoredItem.prototype._set_parameters = function(options) {
    var self = this;
    _validate_parameters(options);
    self.clientHandle = options.clientHandle;

    // The Server may support data that is collected based on a sampling model or generated based on an
    // exception-based model. The fastest supported sampling interval may be equal to 0, which indicates
    // that the data item is exception-based rather than being sampled at some period. An exception-based
    // model means that the underlying system does not require sampling and reports data changes.
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
        //xx console.log("xxxx ON SAMPLING");
        // @event samplingEvent
        // @param oldDataValue {DataValue} - the last known recorded data value.
        self.emit("samplingEvent", self.oldDataValue);
    } else {
        /* istanbul ignore next */
        console.log("_on_sampling_timer call but MonitoredItem has been terminated !!! ");
    }
};


var extractRange = require("lib/datamodel/datavalue").extractRange;

var DataChangeFilter = subscription_service.DataChangeFilter;
var DataChangeTrigger = subscription_service.DataChangeTrigger;
var DeadbandType = subscription_service.DeadbandType;

function statusCodeHasChanged(newDataValue,oldDataValue) {
    assert(newDataValue instanceof DataValue);
    assert(oldDataValue instanceof DataValue);
    return newDataValue.statusCode !== oldDataValue.statusCode;
}
function valueHasChanged(newDataValue,oldDataValue,deadbandType,deadbandValue) {

    assert(newDataValue instanceof DataValue);
    assert(oldDataValue instanceof DataValue);
    switch(deadbandType) {
        case DeadbandType.None:
            assert(newDataValue.value instanceof Variant);
            assert(newDataValue.value instanceof Variant);
            // No Deadband calculation should be applied.
            return oldDataValue.value.value !== newDataValue.value.value;
        case DeadbandType.Absolute:
            // AbsoluteDeadband
            var delta = Math.abs(oldDataValue.value.value - newDataValue.value.value);
            return delta >= deadbandValue;
        default:
            // Percent_2    PercentDeadband (This type is specified in Part 8).
            assert(deadbandType === DeadbandType.Percent);
            assert(deadbandValue>=0 && deadbandValue<=100);
            assert(false,"Not implemented yet");
            return true;
    }
}
function apply_datachange_filter(self,newDataValue,oldDataValue) {

    assert(self.filter);
    assert(self.filter instanceof DataChangeFilter);
    assert(newDataValue instanceof DataValue);
    assert(oldDataValue instanceof DataValue);

    var trigger = self.filter.trigger;

    switch(trigger.value) {
        case DataChangeTrigger.Status.value:
            //              Report a notification ONLY if the StatusCode associated with
            //              the value changes. See Table 166 for StatusCodes defined in
            //              this standard. Part 8 specifies additional StatusCodes that are
            //              valid in particular for device data.
            return statusCodeHasChanged(newDataValue,oldDataValue);

        case DataChangeTrigger.StatusValue.value:
            //              Report a notification if either the StatusCode or the value
            //              change. The Deadband filter can be used in addition for
            //              filtering value changes.
            //              This is the default setting if no filter is set.
            return statusCodeHasChanged(newDataValue,oldDataValue) ||
                   valueHasChanged(newDataValue,oldDataValue,self.filter.deadbandType,self.filter.deadbandValue);
            break;
        default:
            //              Report a notification if either StatusCode, value or the
            //              SourceTimestamp change. If a Deadband filter is specified,
            //              this trigger has the same behaviour as STATUS_VALUE_1.
            //              If the DataChangeFilter is not applied to the monitored item, STATUS_VALUE_1
            //              is the default reporting behaviour
            assert(trigger === DataChangeTrigger.StatusValueTimestamp);
    }


    return false;
}
function apply_filter(self,newDataValue) {

    if (!self.oldDataValue) {
        return true;
    }
    var oldDataValue = self.oldDataValue;

    if (!self.filter) {

         return statusCodeHasChanged(newDataValue,oldDataValue) ||
            valueHasChanged(newDataValue,oldDataValue,DeadbandType.None);
    }
    assert(self.filter);
    if (!self.queue || self.queue.length ===0) {
        return true; // keep
    }
    if (self.filter instanceof DataChangeFilter) {
        return apply_datachange_filter(self,newDataValue,oldDataValue);
    }
    return true; // keep
}

/**
 * @method recordValue
 * @param dataValue {DataValue}     the whole datavalue
 * @param indexRange {NumericRange} the region that has changed in the dataValue
 */
MonitoredItem.prototype.recordValue = function (dataValue, indexRange) {

    var self = this;

    //xx console.log("MonitoredItem.prototype.recordValue = function (dataValue,indexRange) { ");
    //xx console.log(new DataValue(dataValue).toString(),"\n indexRange = ".cyan,indexRange);

    if (!NumericRange.overlap(indexRange, self.itemToMonitor.indexRange)) {
        //xx console.log(" NO OVERLAP".red);
        return; // nothing to record
    }

    dataValue = extractRange(dataValue, self.itemToMonitor.indexRange);

    //xx console.log("Modified ",new DataValue(dataValue).toString(),"\n indexRange = ",self.itemToMonitor.indexRange);
    //xxx console.log("xxx recordValue!",self.monitoredItemId.toString(),dataValue.value.toString());

    dataValue =  dataValue instanceof DataValue ? dataValue : new DataValue(dataValue);
    // store last value

    if (self.filter) {
        if(!apply_filter(self,dataValue)) {
            //xx console.log(" Apply filter",self.filter.toString());
            return
        }
    }

    self.oldDataValue = dataValue;

    if (self.queueSize === 1) {
        // ensure queuesize
        if (!self.queue || self.queue.length !== 1) {
            self.queue = [null];
        }
        self.queue[0] = dataValue;
        assert(self.queue.length === 1);

    } else {
        if (self.discardOldest) {

            // push new value to queue
            self.queue.push(dataValue);

            if (self.queue.length > self.queueSize) {
                self.overflow = true;
                dataValue.statusCode = StatusCodes.GoodWithOverflowBit;
                //xx console.log("xxxxx ",dataValue.statusCode.toString());
                self.queue.shift(); // remove front element
            }

        } else {
            if (self.queue.length < self.queueSize) {
                self.queue.push(dataValue);
            } else {
                self.overflow = true;
                dataValue.statusCode = StatusCodes.GoodWithOverflowBit;
                //xx console.log("xxxxx ",dataValue.statusCode.toString());
                self.queue[self.queue.length - 1] = dataValue;
            }
        }
    }
};

/**
 * @method  extractMonitoredItemNotifications
 * @return {Array.<*>}
 */
MonitoredItem.prototype.extractMonitoredItemNotifications = function () {

    var self = this;

    //xx console.log("xxxxx extractMonitoredItemNotifications".red,self.monitoringMode.toString());

    if (self.monitoringMode!=MonitoringMode.Reporting) {
        return [];
    }

    var attributeId = self.itemToMonitor.attributeId;

    // MonitoredItemNotification
    var notifications = self.queue.map(function (dataValue) {

        dataValue = apply_timestamps(dataValue, self.timestampsToReturn, attributeId);

        return { clientHandle: self.clientHandle, value: dataValue};
    });
    // empty queue
    self.queue = [];
    return notifications;
};



MonitoredItem.prototype.modify = function(timestampsToReturn,options)  {

    var self = this;

    var old_queueSize = self.queueSize;

    assert(options instanceof MonitoringParameters);

    self.timestampsToReturn = timestampsToReturn || self.timestampsToReturn;

    var old_sampling_interval = self.samplingInterval;

    self._set_parameters(options);

    var new_sampling_interval = self.samplingInterval;

    // adjust queue size if necessary
    if (self.queueSize < self.queue) {
        if (self.discardOldest) {
            self.queue.splice(0,self.queue.length - self.queueSize);
        } else {
            // only keep queueSize first element , discard others
            self.queue.splice(self.queueSize);
        }
    }
    if (old_queueSize >1 && self.queueSize === 1) {

    }
    if (old_sampling_interval !=new_sampling_interval )  {
        self._adjust_timer();
    }

    //xx self.emit("samplingEvent");

    return new MonitoredItemModifyResult({
        statusCode:                StatusCodes.Good,
        revisedSamplingInterval:   self.samplingInterval,
        revisedQueueSize:          self.queueSize,
        filterResult:              null
    });
};

exports.MonitoredItem = MonitoredItem;
