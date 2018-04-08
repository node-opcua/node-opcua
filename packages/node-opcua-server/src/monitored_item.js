"use strict";
/**
 * @module opcua.server
 *
 */


const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const EventEmitter = require("events").EventEmitter;
const util = require("util");

const subscription_service = require("node-opcua-service-subscription");
const read_service = require("node-opcua-service-read");

const DataValue = require("node-opcua-data-value").DataValue;
const Variant = require("node-opcua-variant").Variant;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const AttributeIds = require("node-opcua-data-model").AttributeIds;
const BaseNode = require("node-opcua-address-space").BaseNode;

const sameDataValue = require("node-opcua-data-value").sameDataValue;
const sameVariant = require("node-opcua-variant/src/variant_tools").sameVariant;
const isValidVariant = require("node-opcua-variant").isValidVariant;

const MonitoringMode = subscription_service.MonitoringMode;
const MonitoringParameters = subscription_service.MonitoringParameters;
const MonitoredItemModifyResult = subscription_service.MonitoredItemModifyResult;
const TimestampsToReturn = read_service.TimestampsToReturn;
const EventFilter = require("node-opcua-service-filter").EventFilter;
const apply_timestamps = require("node-opcua-data-value").apply_timestamps;

const defaultItemToMonitor = {indexRange: null, attributeId: read_service.AttributeIds.Value};

const SessionContext = require("node-opcua-address-space").SessionContext;
const NumericRange = require("node-opcua-numeric-range").NumericRange;



const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

function _adjust_sampling_interval(samplingInterval,node_minimumSamplingInterval) {

    assert(_.isNumber(node_minimumSamplingInterval,"expecting a number"));

    if (samplingInterval === 0) {
        return (node_minimumSamplingInterval === 0) ? samplingInterval : Math.max(MonitoredItem.minimumSamplingInterval,node_minimumSamplingInterval);
    }
    assert(samplingInterval >= 0, " this case should have been prevented outside");
    samplingInterval = samplingInterval || MonitoredItem.defaultSamplingInterval;
    samplingInterval = Math.max(samplingInterval, MonitoredItem.minimumSamplingInterval);
    samplingInterval = Math.min(samplingInterval, MonitoredItem.maximumSamplingInterval);
    samplingInterval = node_minimumSamplingInterval === 0 ? samplingInterval : Math.max(samplingInterval, node_minimumSamplingInterval);

    return samplingInterval;
}


const maxQueueSize = 5000;

function _adjust_queue_size(queueSize) {
    queueSize = Math.min(queueSize, maxQueueSize);
    queueSize = Math.max(1, queueSize);
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

    assert(options.hasOwnProperty("monitoredItemId"));
    assert(!options.monitoringMode, "use setMonitoring mode explicitly to activate the monitored item");

    EventEmitter.apply(this, arguments);
    options.itemToMonitor = options.itemToMonitor || defaultItemToMonitor;

    const self = this;
    self._samplingId = null;

    self._set_parameters(options);

    self.monitoredItemId = options.monitoredItemId; //( known as serverHandle)

    self.queue = [];
    self.overflow = false;

    self.oldDataValue = new DataValue({statusCode: StatusCodes.BadDataUnavailable}); // unset initially

    // user has to call setMonitoringMode
    self.monitoringMode = MonitoringMode.Invalid;

    self.timestampsToReturn = options.timestampsToReturn || TimestampsToReturn.Neither;

    self.itemToMonitor = options.itemToMonitor;

    self.filter = options.filter || null;

    /**
     * @property node the associated node object in the address space
     * @type {BaseNode|null}
     */
    self._node = null;
    self._semantic_version = 0;

    if (doDebug) {
        debugLog("Monitoring ", options.itemToMonitor.toString());
    }

    self._on_node_disposed = null;

    MonitoredItem.registry.register(self);
}

util.inherits(MonitoredItem, EventEmitter);

const ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
MonitoredItem.registry = new ObjectRegistry();

MonitoredItem.minimumSamplingInterval = 50;              // 50 ms as a minimum sampling interval
MonitoredItem.defaultSamplingInterval = 1500;            // 1500 ms as a default sampling interval
MonitoredItem.maximumSamplingInterval = 1000 * 60 * 60;  // 1 hour !

function _validate_parameters(monitoringParameters) {
    //xx assert(options instanceof MonitoringParameters);
    assert(monitoringParameters.hasOwnProperty("clientHandle"));
    assert(monitoringParameters.hasOwnProperty("samplingInterval"));
    assert(_.isFinite(monitoringParameters.clientHandle));
    assert(_.isFinite(monitoringParameters.samplingInterval));
    assert(_.isBoolean(monitoringParameters.discardOldest));
    assert(_.isFinite(monitoringParameters.queueSize));
    assert(monitoringParameters.queueSize >= 0);
}

MonitoredItem.prototype.__defineGetter__("node", function () {
    return this._node;
});

MonitoredItem.prototype.__defineSetter__("node", function () {
    throw new Error("Unexpected way to set node");
});



function _on_node_disposed(monitoredItem) {
    const node = this;
    monitoredItem._on_value_changed(new DataValue({sourceTimestamp: new Date(),statusCode: StatusCodes.BadNodeIdInvalid}));
    monitoredItem._stop_sampling();

}

MonitoredItem.prototype.setNode = function (node) {
    const self = this;
    assert(!self.node || self.node === node, "node already set");
    self._node = node;
    self._semantic_version = node.semantic_version;


    assert( self._on_node_disposed ===null,"setNode has been called already ???");
    self._on_node_disposed = _on_node_disposed.bind(null,self);
    self._node.on("dispose",self._on_node_disposed);

};

MonitoredItem.prototype._stop_sampling = function () {

    const self = this;
    debugLog("MonitoredItem#_stop_sampling");

    if (self._on_opcua_event_received_callback) {
        assert(_.isFunction(self._on_opcua_event_received_callback));
        self.node.removeListener("event", self._on_opcua_event_received_callback);
        self._on_opcua_event_received_callback = null;
    }

    if (self._attribute_changed_callback) {
        assert(_.isFunction(self._attribute_changed_callback));

        const event_name = BaseNode.makeAttributeEventName(self.itemToMonitor.attributeId);
        self.node.removeListener(event_name, self._attribute_changed_callback);
        self._attribute_changed_callback = null;
    }

    if (self._value_changed_callback) {
        // samplingInterval was 0 for a exception-based data Item
        // we setup a event listener that we need to unwind here
        assert(_.isFunction(self._value_changed_callback));
        assert(!self._samplingId);

        self.node.removeListener("value_changed", self._value_changed_callback);
        self._value_changed_callback = null;
    }

    if (self._semantic_changed_callback) {
        assert(_.isFunction(self._semantic_changed_callback));
        assert(!self._samplingId);
        self.node.removeListener("semantic_changed", self._semantic_changed_callback);
        self._semantic_changed_callback = null;

    }
    if (self._samplingId) {
        self._clear_timer();
    }

    assert(!self._samplingId);
    assert(!self._value_changed_callback);
    assert(!self._semantic_changed_callback);
    assert(!self._attribute_changed_callback);
    assert(!self._on_opcua_event_received_callback);

};

MonitoredItem.prototype._on_value_changed = function (dataValue,indexRange) {
    const self = this;
    assert(dataValue instanceof DataValue);
    self.recordValue(dataValue, false, indexRange);
};

MonitoredItem.prototype._on_semantic_changed = function () {
    const self = this;
    const dataValue = self.node.readValue();
    self._on_value_changed(dataValue);
};

const extractEventFields = require("node-opcua-service-filter").extractEventFields;

MonitoredItem.prototype._on_opcua_event = function (eventData) {

    const self = this;

    assert(!self.filter || self.filter instanceof EventFilter);

    const selectClauses = self.filter ? self.filter.selectClauses : [];
    const eventFields = extractEventFields(selectClauses, eventData);

    // istanbul ignore next
    if (doDebug) {
        console.log(" RECEIVED INTERNAL EVENT THAT WE ARE MONITORING");
        console.log(self.filter ? self.filter.toString() : "no filter");
        eventFields.forEach(function (e) {
            console.log(e.toString());
        });
    }

    self._enqueue_event(eventFields);
};

MonitoredItem.prototype._getSession = function () {
    const self = this;
    if (!self.$subscription) {
        return null;
    }
    if (!self.$subscription.$session) {
        return null;
    }
    return self.$subscription.$session;
};

MonitoredItem.prototype._start_sampling = function (recordInitialValue) {

    const self = this;

    // make sure oldDataValue is scrapped so first data recording can happen
    self.oldDataValue = new DataValue({statusCode: StatusCodes.BadDataUnavailable}); // unset initially

    self._stop_sampling();


    const context = new SessionContext({session: self._getSession(),server: self.server});

    if (self.itemToMonitor.attributeId === AttributeIds.EventNotifier) {

        // istanbul ignore next
        if (doDebug) {
            debugLog("xxxxxx monitoring EventNotifier on", self.node.nodeId.toString(), self.node.browseName.toString());
        }
        // we are monitoring OPCUA Event
        self._on_opcua_event_received_callback = self._on_opcua_event.bind(self);
        self.node.on("event", self._on_opcua_event_received_callback);

        return;
    }
    if (self.itemToMonitor.attributeId !== AttributeIds.Value) {

        // sampling interval only applies to Value Attributes.
        self.samplingInterval = 0; // turned to exception-based regardless of requested sampling interval

        // non value attribute only react on value change
        self._attribute_changed_callback = self._on_value_changed.bind(this);
        const event_name = BaseNode.makeAttributeEventName(self.itemToMonitor.attributeId);

        self.node.on(event_name, self._attribute_changed_callback);

        if (recordInitialValue) {
            // read initial value
            const dataValue = self.node.readAttribute(context, self.itemToMonitor.attributeId);
            self.recordValue(dataValue, true, null);

        }
        return;
    }

    if (self.samplingInterval === 0) {

        // we have a exception-based dataItem : event based model, so we do not need a timer
        // rather , we setup the "value_changed_event";
        self._value_changed_callback = self._on_value_changed.bind(this);
        self._semantic_changed_callback = self._on_semantic_changed.bind(this);

        self.node.on("value_changed", self._value_changed_callback);
        self.node.on("semantic_changed", self._semantic_changed_callback);

        // initiate first read
        if (recordInitialValue) {
//xx            setImmediate(function() {
            self.node.readValueAsync(context, function (err, dataValue) {
                self.recordValue(dataValue, true);
            });
//xx            });
        }
    } else {

        self._set_timer();
        if (recordInitialValue) {
            setImmediate(function () {
                //xx console.log("Record Initial Value ",self.node.nodeId.toString());
                // initiate first read (this requires self._samplingId to be set)
                self._on_sampling_timer();
            });
        }
    }

};

MonitoredItem.prototype.setMonitoringMode = function (monitoringMode) {

    const self = this;

    assert(monitoringMode !== MonitoringMode.Invalid);

    if (monitoringMode === self.monitoringMode) {
        // nothing to do
        return;
    }

    const old_monitoringMode = self.monitoringMode;


    self.monitoringMode = monitoringMode;

    if (self.monitoringMode === MonitoringMode.Disabled) {

        self._stop_sampling();

        // OPCUA 1.03 part 4 : $5.12.4
        // setting the mode to DISABLED causes all queued Notifications to be deleted
        self.queue = [];
        self.overflow = false;
    } else {
        assert(self.monitoringMode === MonitoringMode.Sampling || self.monitoringMode === MonitoringMode.Reporting);

        // OPCUA 1.03 part 4 : $5.12.1.3
        // When a MonitoredItem is enabled (i.e. when the MonitoringMode is changed from DISABLED to
        // SAMPLING or REPORTING) or it is created in the enabled state, the Server shall report the first
        // sample as soon as possible and the time of this sample becomes the starting point for the next
        // sampling interval.
        const recordInitialValue = (old_monitoringMode === MonitoringMode.Invalid || old_monitoringMode === MonitoringMode.Disabled);

        self._start_sampling(recordInitialValue);

    }
};

MonitoredItem.prototype._set_parameters = function (monitoredParameters) {
    const self = this;
    _validate_parameters(monitoredParameters);
    self.clientHandle = monitoredParameters.clientHandle;

    // The Server may support data that is collected based on a sampling model or generated based on an
    // exception-based model. The fastest supported sampling interval may be equal to 0, which indicates
    // that the data item is exception-based rather than being sampled at some period. An exception-based
    // model means that the underlying system does not require sampling and reports data changes.
    self.samplingInterval = _adjust_sampling_interval(monitoredParameters.samplingInterval,self.node ?  self.node.minimumSamplingInterval : 0 );
    self.discardOldest = monitoredParameters.discardOldest;
    self.queueSize = _adjust_queue_size(monitoredParameters.queueSize);
};

/**
 * Terminate the  MonitoredItem.
 * @method terminate
 *
 * This will stop the internal sampling timer.
 */
MonitoredItem.prototype.terminate = function () {
    const self = this;
    self._stop_sampling();
};

MonitoredItem.prototype.dispose = function() {
    const self = this;

    if (doDebug) {
        debugLog("DISPOSING MONITORED ITEM" , self._node.nodeId.toString());
    }

    self._stop_sampling();

    MonitoredItem.registry.unregister(self);

    if (self._on_node_disposed) {
        self._node.removeListener("dispose",self._on_node_disposed);
        self._on_node_disposed = null;
    }

    //x assert(self._samplingId === null,"Sampling Id must be null");
    self.oldDataValue = null;
    self.queue = null;
    self.itemToMonitor = null;
    self.filter = null;
    self.monitoredItemId = null;
    self._node = null;
    self._semantic_version = 0;

    self.$subscription = null;

    self.removeAllListeners();

    assert(!self._samplingId);
    assert(!self._value_changed_callback);
    assert(!self._semantic_changed_callback);
    assert(!self._attribute_changed_callback);
    assert(!self._on_opcua_event_received_callback);
    self._on_opcua_event_received_callback = null;
    self._attribute_changed_callback = null;
    self._semantic_changed_callback = null;
    self._on_opcua_event_received_callback = null;

};

/**
 * @method _on_sampling_timer
 * @private
 * request
 *
 */
MonitoredItem.prototype._on_sampling_timer = function () {

    const self = this;

    // istanbul ignore next
    if (doDebug) {
        debugLog("MonitoredItem#_on_sampling_timer", self.node ? self.node.nodeId.toString() : "null", " isSampling?=", self._is_sampling);
    }

    if (self._samplingId) {

        assert(self.monitoringMode === MonitoringMode.Sampling || self.monitoringMode === MonitoringMode.Reporting);

        if (self._is_sampling) {
            // previous sampling call is not yet completed..
            // there is nothing we can do about it except waiting until next tick.
            // note : see also issue #156 on github
            return;
        }
        //xx console.log("xxxx ON SAMPLING");
        assert(!self._is_sampling, "sampling func shall not be re-entrant !! fix it");

        assert(_.isFunction(self.samplingFunc));

        self._is_sampling = true;

        self.samplingFunc.call(self, self.oldDataValue, function (err, newDataValue) {

            if(!self._samplingId) {
                // item has been dispose .... the monitored item has been disposed while the async sampling func
                // was taking place ... just ignore this
                return;
            }
            if (err) {
                console.log(" SAMPLING ERROR =>", err);
            } else {
                // only record value if source timestamp is newer
                //xx if (newDataValue.sourceTimestamp > self.oldDataValue.sourceTimestamp) {
                self._on_value_changed(newDataValue);
                //xx }
            }
            self._is_sampling = false;
        });

    } else {
        /* istanbul ignore next */
        debugLog("_on_sampling_timer call but MonitoredItem has been terminated !!! ");
    }
};

const extractRange = require("node-opcua-data-value").extractRange;

const DataChangeFilter = subscription_service.DataChangeFilter;
const DataChangeTrigger = subscription_service.DataChangeTrigger;
const DeadbandType = subscription_service.DeadbandType;

function statusCodeHasChanged(newDataValue, oldDataValue) {
    assert(newDataValue instanceof DataValue);
    assert(oldDataValue instanceof DataValue);
    return newDataValue.statusCode !== oldDataValue.statusCode;
}

const check_deadband = require("node-opcua-service-subscription").check_deadband;


function valueHasChanged(self, newDataValue, oldDataValue, deadbandType, deadbandValue) {

    assert(newDataValue instanceof DataValue);
    assert(oldDataValue instanceof DataValue);
    switch (deadbandType) {
        case DeadbandType.None:
            assert(newDataValue.value instanceof Variant);
            assert(newDataValue.value instanceof Variant);
            // No Deadband calculation should be applied.
            return check_deadband(oldDataValue.value, newDataValue.value, DeadbandType.None);
        case DeadbandType.Absolute:
            // AbsoluteDeadband
            return check_deadband(oldDataValue.value, newDataValue.value, DeadbandType.Absolute, deadbandValue);
        default:
            // Percent_2    PercentDeadband (This type is specified in Part 8).
            assert(deadbandType === DeadbandType.Percent);

            // The range of the deadbandValue is from 0.0 to 100.0 Percent.
            assert(deadbandValue >= 0 && deadbandValue <= 100);

            // DeadbandType = PercentDeadband
            // For this type of deadband the deadbandValue is defined as the percentage of the EURange. That is,
            // it applies only to AnalogItems with an EURange Property that defines the typical value range for the
            // item. This range shall be multiplied with the deadbandValue and then compared to the actual value change
            // to determine the need for a data change notification. The following pseudo code shows how the deadband
            // is calculated:
            //      DataChange if (absolute value of (last cached value - current value) >
            //                                          (deadbandValue/100.0) * ((high-low) of EURange)))
            //
            // Specifying a deadbandValue outside of this range will be rejected and reported with the
            // StatusCode Bad_DeadbandFilterInvalid (see Table 27).
            // If the Value of the MonitoredItem is an array, then the deadband calculation logic shall be applied to
            // each element of the array. If an element that requires a DataChange is found, then no further
            // deadband checking is necessary and the entire array shall be returned.
            assert(self.node !== null, "expecting a valid address_space object here to get access the the EURange");

            if (self.node.euRange) {
                // double,double
                const rangeVariant = self.node.euRange.readValue().value;
                const range = rangeVariant.value.high - rangeVariant.value.high;
                assert(_.isFinite(range));
                return check_deadband(oldDataValue.value, newDataValue.value, DeadbandType.Percent, deadbandValue, range);

            }
            return true;
    }
}

function timestampHasChanged(t1, t2) {
    if ((t1 || !t2) || (t2 || !t1)) {
        return true;
    }
    if (!t1 || !t2) {
        return false;
    }
    return t1.getTime() !== t2.getTime();
}

function apply_datachange_filter(self, newDataValue, oldDataValue) {

    assert(self.filter);
    assert(self.filter instanceof DataChangeFilter);
    assert(newDataValue instanceof DataValue);
    assert(oldDataValue instanceof DataValue);

    const trigger = self.filter.trigger;

    switch (trigger.value) {
        case DataChangeTrigger.Status.value: // Status
            //              Report a notification ONLY if the StatusCode associated with
            //              the value changes. See Table 166 for StatusCodes defined in
            //              this standard. Part 8 specifies additional StatusCodes that are
            //              valid in particular for device data.
            return statusCodeHasChanged(newDataValue, oldDataValue);

        case DataChangeTrigger.StatusValue.value: // StatusValue
            //              Report a notification if either the StatusCode or the value
            //              change. The Deadband filter can be used in addition for
            //              filtering value changes.
            //              This is the default setting if no filter is set.
            return statusCodeHasChanged(newDataValue, oldDataValue) ||
                valueHasChanged(self, newDataValue, oldDataValue, self.filter.deadbandType, self.filter.deadbandValue);

        default: // StatusValueTimestamp
            //              Report a notification if either StatusCode, value or the
            //              SourceTimestamp change.
            //
            //              If a Deadband filter is specified,this trigger has the same behaviour as STATUS_VALUE_1.
            //
            //              If the DataChangeFilter is not applied to the monitored item, STATUS_VALUE_1
            //              is the default reporting behaviour
            assert(trigger === DataChangeTrigger.StatusValueTimestamp);
            return timestampHasChanged(newDataValue.sourceTimestamp, oldDataValue.sourceTimestamp) ||
                statusCodeHasChanged(newDataValue, oldDataValue) ||
                valueHasChanged(self, newDataValue, oldDataValue, self.filter.deadbandType, self.filter.deadbandValue);
    }
    return false;
}

function apply_filter(self, newDataValue) {

    if (!self.oldDataValue) {
        return true; // keep
    }
    if (self.filter instanceof DataChangeFilter) {
        return apply_datachange_filter(self, newDataValue, self.oldDataValue);
    }
    return true; // keep
    // else {
    //      // if filter not set, by default report changes to Status or Value only
    //      return !sameDataValue(newDataValue, self.oldDataValue, TimestampsToReturn.Neither);
    // }
    // return true; // keep
}


/**
 * @property isSampling
 * @type boolean
 */
MonitoredItem.prototype.__defineGetter__("isSampling", function () {
    const self = this;
    return !!self._samplingId || _.isFunction(self._value_changed_callback) ||
        _.isFunction(self._attribute_changed_callback);
});

/**
 * @method recordValue
 * @param dataValue {DataValue}     the whole dataValue
 * @param skipChangeTest {Boolean}  indicates whether recordValue should  not check that dataValue is really different
 *                                  from previous one, ( by checking timestamps but also variant value)
 * @private
 *
 * Notes:
 *  - recordValue can only be called within timer event
 *  - for performance reason, dataValue may be a shared value with the underlying node,
 *    therefore recordValue must clone the dataValue to make sure it retains a snapshot
 *    of the contain at the time recordValue was called.
 *
 */
MonitoredItem.prototype.recordValue = function (dataValue, skipChangeTest , indexRange) {

    const self = this;

    assert(dataValue instanceof DataValue);
    assert(dataValue !== self.oldDataValue,               "recordValue expects different dataValue to be provided");
    assert(!dataValue.value || dataValue.value !== self.oldDataValue.value,   "recordValue expects different dataValue.value to be provided");
    assert(!dataValue.value  || dataValue.value.isValid(),"expecting a valid variant value");

    const hasSemanticChanged = self.node && (self.node.semantic_version !== self._semantic_version);

    //xx   console.log("`\n----------------------------",skipChangeTest,self.clientHandle,
    //             self.node.listenerCount("value_changed"),self.node.nodeId.toString());
    //xx   console.log("events ---- ",self.node.eventNames().join("-"));
    //xx    console.log((new Error()).stack);
    //xx    console.log("indexRange = ",indexRange ? indexRange.toString() :"");
    //xx    console.log("self.itemToMonitor.indexRange = ",self.itemToMonitor.indexRange.toString());

    if (!hasSemanticChanged && indexRange && self.itemToMonitor.indexRange) {
        // we just ignore changes that do not fall within our range
        // ( unless semantic bit has changed )
        if (!NumericRange.overlap(indexRange,self.itemToMonitor.indexRange)) {
            return; // no overlap !
        }
    }

    assert( self.itemToMonitor,"must have a valid itemToMonitor(have this monitoredItem been disposed already ?");
    // extract the range that we are interested with
    dataValue = extractRange(dataValue, self.itemToMonitor.indexRange);

    // istanbul ignore next
    if (doDebug) {
        debugLog("MonitoredItem#recordValue", self.node.nodeId.toString(), self.node.browseName.toString(), " has Changed = ", !sameDataValue(dataValue, self.oldDataValue));
    }

    // if semantic has changed, value need to be enqueued regardless of other assumptions
    if (hasSemanticChanged) {
        return self._enqueue_value(dataValue);
    }

    const useIndexRange = self.itemToMonitor.indexRange && !self.itemToMonitor.indexRange.isEmpty();

    if (!skipChangeTest) {
        const hasChanged = !sameDataValue(dataValue, self.oldDataValue);
        if (!hasChanged) {
            return;
        }
    }

    if (!apply_filter(self, dataValue)) {
        return;
    }

    if (useIndexRange) {
        // when an indexRange is provided , make sure that no record happens unless
        // extracted variant in the selected range  has really changed.

        // istanbul ignore next
        if (doDebug) {
            debugLog("Current : ",self.oldDataValue.toString());
            debugLog("New : ",dataValue.toString());
            debugLog("indexRange=",indexRange);
        }

        if (sameVariant(dataValue.value, self.oldDataValue.value)) {
            return;
        }
    }
    // store last value
    self._enqueue_value(dataValue);

};

MonitoredItem.prototype._setOverflowBit = function (notification) {

    if (notification.hasOwnProperty("value")) {
        assert(notification.value.statusCode.equals(StatusCodes.Good));
        notification.value.statusCode = StatusCodes.makeStatusCode(notification.value.statusCode, "Overflow | InfoTypeDataValue");
        assert(_.isEqual(notification.value.statusCode, StatusCodes.GoodWithOverflowBit));
        assert(notification.value.statusCode.hasOverflowBit);
    }
};

function setSemanticChangeBit(notification) {
    if (notification && notification.hasOwnProperty("value")) {
        notification.value.statusCode = StatusCodes.makeStatusCode(notification.value.statusCode, "SemanticChanged");
    }
}

MonitoredItem.prototype._enqueue_notification = function (notification) {

    const self = this;

    if (self.queueSize === 1) {
        // ensure queuesize
        if (!self.queue || self.queue.length !== 1) {
            self.queue = [null];
        }
        self.queue[0] = notification;
        assert(self.queue.length === 1);

    } else {
        if (self.discardOldest) {

            // push new value to queue
            self.queue.push(notification);

            if (self.queue.length > self.queueSize) {

                self.overflow = true;

                self.queue.shift(); // remove front element

                // set overflow bit
                self._setOverflowBit(self.queue[0]);
            }

        } else {
            if (self.queue.length < self.queueSize) {

                self.queue.push(notification);
            } else {

                self.overflow = true;

                self._setOverflowBit(notification);

                self.queue[self.queue.length - 1] = notification;
            }
        }
    }
    assert(self.queue.length >= 1);
};


MonitoredItem.prototype._makeDataChangeNotification = function (dataValue) {
    const self = this;
    const attributeId = self.itemToMonitor.attributeId;
    dataValue = apply_timestamps(dataValue, self.timestampsToReturn, attributeId);
    return new subscription_service.MonitoredItemNotification({clientHandle: self.clientHandle, value: dataValue});
};

function isGoodish(statusCode) {
    return statusCode.value < 0x10000000;
}


/**
 * @method _enqueue_value
 * @param dataValue {DataValue} the dataValue to enquue
 * @private
 */
MonitoredItem.prototype._enqueue_value = function (dataValue) {

    const self = this;

    // preconditions:

    assert(dataValue instanceof DataValue);
    // lets verify that, if status code is good then we have a valid Variant in the dataValue
    assert(!isGoodish(dataValue.statusCode) || dataValue.value instanceof Variant);
    //xx assert(isGoodish(dataValue.statusCode) || util.isNullOrUndefined(dataValue.value) );
    // let's check that data Value is really a different object
    // we may end up with corrupted queue if dataValue are recycled and stored as is in notifications
    assert(dataValue !== self.oldDataValue, "dataValue cannot be the same object twice!");


    //Xx // todo ERN !!!! PLEASE CHECK THIS !!!
    //Xx // let make a clone, so we have a snapshot
    //Xx dataValue = dataValue.clone();


    // let's check that data Value is really a different object
    // we may end up with corrupted queue if dataValue are recycled and stored as is in notifications
    assert(!self.oldDataValue || !dataValue.value || (dataValue.value !== self.oldDataValue.value), "dataValue cannot be the same object twice!");
    if (!(!self.oldDataValue || !self.oldDataValue.value
            || !dataValue.value || !(dataValue.value.value instanceof Object)
            || (dataValue.value.value !== self.oldDataValue.value.value)) && !(dataValue.value.value instanceof Date)) {
        throw new Error("dataValue.value.value cannot be the same object twice! " + self.node.browseName.toString() + " " + dataValue.toString()  + "  " + self.oldDataValue.toString().cyan);
    }

    // istanbul ignore next
    if (doDebug) {
        debugLog("MonitoredItem#_enqueue_value", self.node.nodeId.toString());
    }

    self.oldDataValue = dataValue;
    const notification = self._makeDataChangeNotification(dataValue);
    self._enqueue_notification(notification);
};

MonitoredItem.prototype._makeEventFieldList = function (eventFields) {
    const self = this;
    assert(_.isArray(eventFields));
    return new subscription_service.EventFieldList({clientHandle: self.clientHandle, eventFields: eventFields});
};

MonitoredItem.prototype._enqueue_event = function (eventFields) {
    const self = this;
    debugLog(" MonitoredItem#_enqueue_event");
    const notification = self._makeEventFieldList(eventFields);
    self._enqueue_notification(notification);
};


MonitoredItem.prototype._empty_queue = function () {
    const self = this;
    // empty queue
    self.queue = [];
    self.overflow = false;

};



MonitoredItem.prototype.__defineGetter__("hasMonitoredItemNotifications", function () {
    const self = this;
    return self.queue.length > 0;
});

/**
 * @method  extractMonitoredItemNotifications
 * @return {Array.<*>}
 */
MonitoredItem.prototype.extractMonitoredItemNotifications = function () {

    const self = this;

    if (self.monitoringMode !== MonitoringMode.Reporting) {
        return [];
    }
    const notifications = self.queue;
    self._empty_queue();

    // apply semantic changed bit if necessary
    if (notifications.length > 0 && self.node && self._semantic_version < self.node.semantic_version) {

        const dataValue = notifications[notifications.length - 1];
        setSemanticChangeBit(dataValue);
        self._semantic_version = self.node.semantic_version;
    }

    return notifications;
};


const timers = {};

function appendToTimer(monitoredItem) {

    const samplingInterval = monitoredItem.samplingInterval;
    const key = samplingInterval.toString();
    assert(samplingInterval > 0);
    let _t = timers[key];
    if (!_t) {

        _t = {
            monitoredItems: {},
            monitoredItemsCount: 0,
            _samplingId: false
        };

        _t._samplingId = setInterval(function () {

            _.forEach(_t.monitoredItems, function (m) {
                setImmediate(function () {
                    m._on_sampling_timer();
                });
            });

        }, samplingInterval);
        timers[key] = _t;
    }
    assert(!_t.monitoredItems[monitoredItem.monitoredItemId]);
    _t.monitoredItems[monitoredItem.monitoredItemId] = monitoredItem;
    _t.monitoredItemsCount++;
    return key;
}

function removeFromTimer(monitoredItem) {

    const samplingInterval = monitoredItem.samplingInterval;
    assert(samplingInterval > 0);
    const key = monitoredItem._samplingId;
    const _t = timers[key];
    if (!_t) {
        console.log("cannot find common timer for samplingInterval", key);
        return;
    }
    assert(_t);
    assert(_t.monitoredItems[monitoredItem.monitoredItemId]);
    delete _t.monitoredItems[monitoredItem.monitoredItemId];
    _t.monitoredItemsCount--;
    assert(_t.monitoredItemsCount >= 0);
    if (_t.monitoredItemsCount === 0) {
        clearInterval(_t._samplingId);
        delete timers[key];
    }
}

const useCommonTimer = true;
MonitoredItem.prototype._clear_timer = function () {

    const self = this;

    //xx console.log("MonitoredItem#_clear_timer",self._samplingId);
    if (self._samplingId) {
        if (useCommonTimer) {
            removeFromTimer(self);
        } else {
            clearInterval(self._samplingId);
        }
        self._samplingId = null;
    }
};

MonitoredItem.prototype._set_timer = function () {

    const self = this;
    assert(self.samplingInterval >= MonitoredItem.minimumSamplingInterval);
    assert(!self._samplingId);

    if (useCommonTimer) {
        self._samplingId = appendToTimer(self);
    } else {
        // settle periodic sampling
        self._samplingId = setInterval(function () {
            self._on_sampling_timer();
        }, self.samplingInterval);
    }
    //xx console.log("MonitoredItem#_set_timer",self._samplingId);

};


MonitoredItem.prototype._adjust_queue_to_match_new_queue_size = function () {

    const self = this;

    // adjust queue size if necessary
    if (self.queueSize < self.queue.length) {

        if (self.discardOldest) {

            self.queue.splice(0, self.queue.length - self.queueSize);

        } else {

            const lastElement = self.queue[self.queue.length - 1];
            // only keep queueSize first element, discard others
            self.queue.splice(self.queueSize);
            self.queue[self.queue.length - 1] = lastElement;
        }
    }
    if (self.queueSize <= 1) {
        self.overflow = false;
        // unset OverFlowBit
        if (self.queue.length === 1) {
            if (self.queue[0].value) {
                if (self.queue[0].value.statusCode.hasOverflowBit) {
                    self.queue[0].value.statusCode.unset("Overflow | InfoTypeDataValue");
                }
            }
        }
    }
    assert(self.queue.length <= self.queueSize);
};

MonitoredItem.prototype._adjust_sampling = function (old_samplingInterval) {

    const self = this;
    if (old_samplingInterval !== self.samplingInterval) {
        self._start_sampling();
        //xx self._clear_timer(true);
        //xx self._set_timer();
    }
};

const validateFilter = require("./validate_filter").validateFilter;

MonitoredItem.prototype.modify = function (timestampsToReturn, monitoredParameters) {

    assert(monitoredParameters instanceof MonitoringParameters);

    const self = this;

    const old_samplingInterval = self.samplingInterval;

    self.timestampsToReturn = timestampsToReturn || self.timestampsToReturn;

    if (old_samplingInterval !== 0 && monitoredParameters.samplingInterval === 0) {
        monitoredParameters.samplingInterval = MonitoredItem.minimumSamplingInterval; // fastest possible
    }

    self._set_parameters(monitoredParameters);

    self._adjust_queue_to_match_new_queue_size();

    self._adjust_sampling(old_samplingInterval);


    if (monitoredParameters.filter) {
        const statusCodeFilter = validateFilter(monitoredParameters.filter, self.itemToMonitor, self.node);
        if (statusCodeFilter.isNot(StatusCodes.Good)) {
            return new MonitoredItemModifyResult({
                statusCode: statusCodeFilter
            });
        }
    }

    // validate filter
    // note : The DataChangeFilter does not have an associated result structure.
    const filterResult = null; // new subscription_service.DataChangeFilter

    return new MonitoredItemModifyResult({
        statusCode: StatusCodes.Good,
        revisedSamplingInterval: self.samplingInterval,
        revisedQueueSize: self.queueSize,
        filterResult: filterResult
    });
};

exports.MonitoredItem = MonitoredItem;
