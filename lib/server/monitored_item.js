/**
 * @module opcua.server
 *
 */

import assert from "better-assert";
import _ from "underscore";
import { EventEmitter } from "events";
import util from "util";
import subscription_service from "lib/services/subscription_service";
import { 
  TimestampsToReturn,
  AttributeIds as ReadServiceAttributeIds 
} from "lib/services/read_service";
import { DataValue } from "lib/datamodel/datavalue";
import { Variant } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { NumericRange } from "lib/datamodel/numeric_range";
import { AttributeIds } from "lib/datamodel/attributeIds";
import { BaseNode } from "lib/address_space/base_node";
import { sameDataValue } from "lib/datamodel/datavalue";
import { apply_timestamps } from "lib/datamodel/datavalue";
import { make_debugLog, checkDebugFlag } from "lib/misc/utils";
import { checkSelectClauses } from "lib/tools/tools_event_filter";
import { extractEventFields } from "lib/tools/tools_event_filter";
import { extractRange } from "lib/datamodel/datavalue";
import { check_deadband } from "lib/datamodel/deadband_checker";
import { ObjectRegistry } from "lib/misc/objectRegistry";
import { validateFilter } from "./validate_filter";

const MonitoringMode = subscription_service.MonitoringMode;
const MonitoringParameters = subscription_service.MonitoringParameters;
const MonitoredItemModifyResult = subscription_service.MonitoredItemModifyResult;


const defaultItemToMonitor = { indexRange: null, attributeId: ReadServiceAttributeIds.Value };


const minimumSamplingInterval = 50;              // 50 ms as a minimum sampling interval
const defaultSamplingInterval = 1500;            // 1500 ms as a default sampling interval
let maximumSamplingInterval = 1000 * 60 * 60;  // 1 hour !

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function _adjust_sampling_interval(samplingInterval) {
  if (samplingInterval === 0) {
    return samplingInterval;
  }
  assert(samplingInterval >= 0, " this case should have been prevented outsides");
  samplingInterval = samplingInterval || defaultSamplingInterval;
  maximumSamplingInterval = maximumSamplingInterval || defaultSamplingInterval;
  samplingInterval = Math.max(samplingInterval, minimumSamplingInterval);
  samplingInterval = Math.min(samplingInterval, maximumSamplingInterval);
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
class MonitoredItem extends EventEmitter {
  constructor(options) {
    super(...arguments);
    assert(options.hasOwnProperty("monitoredItemId"));
    assert(!options.monitoringMode, "use setMonitoring mode explicitly to activate the monitored item");

    EventEmitter.apply(this, arguments);
    options.itemToMonitor = options.itemToMonitor || defaultItemToMonitor;

    const self = this;
    self._samplingId = null;

    self._set_parameters(options);

    self.monitoredItemId = options.monitoredItemId; // ( known as serverHandle)

    self.queue = [];
    self.overflow = false;


    self.oldDataValue = new DataValue({ statusCode: StatusCodes.BadDataUnavailable }); // unset initially

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
  }

  setNode(node) {
    const self = this;
    assert(!self.node || self.node === node, "node already set");
    self._node = node;
    self._semantic_version = node.semantic_version;
  }

  _stop_sampling() {
    const self = this;

    MonitoredItem.registry.unregister(self);

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
  }

  _on_value_changed(dataValue) {
    const self = this;
    assert(dataValue instanceof DataValue);
    self.recordValue(dataValue, true);
  }

  _on_semantic_changed() {
    const self = this;
    const dataValue = self.node.readValue();
    self._on_value_changed(dataValue);
  }

  _on_opcua_event(eventData) {
    const self = this;

    assert(!self.filter || self.filter instanceof subscription_service.EventFilter);

    const selectClauses = self.filter ? self.filter.selectClauses : [];
    const eventFields = extractEventFields(selectClauses, eventData);

    // istanbul ignore next
    if (doDebug) {
      console.log(" RECEIVED INTERNAL EVENT THAT WE ARE MONITORING");
      console.log(self.filter ? self.filter.toString() : "no filter");
      eventFields.forEach((e) => { console.log(e.toString()); });
    }

    self._enqueue_event(eventFields);
  }

  _start_sampling(recordInitialValue) {
    const self = this;

    // make sure oldDataValue is scrapped so first data recording can happen
    self.oldDataValue = new DataValue({ statusCode: StatusCodes.BadDataUnavailable }); // unset initially

    self._stop_sampling();

    MonitoredItem.registry.register(self);


    if (self.itemToMonitor.attributeId === AttributeIds.EventNotifier) {
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
        const dataValue = self.node.readAttribute(self.itemToMonitor.attributeId);
        self.recordValue(dataValue, true);
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
        // xx            setImmediate(function() {
        self.node.readValueAsync((err, dataValue) => {
          self.recordValue(dataValue, true);
        });
        // xx            });
      }
    } else {
      self._set_timer();
      if (recordInitialValue) {
        setImmediate(() => {
          // xx console.log("Record Initial Value ",self.node.nodeId.toString());
          // initiate first read (this requires self._samplingId to be set)
          self._on_sampling_timer();
        });
      }
    }
  }

  setMonitoringMode(monitoringMode) {
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
  }

  _set_parameters(options) {
    const self = this;
    _validate_parameters(options);
    self.clientHandle = options.clientHandle;

    // The Server may support data that is collected based on a sampling model or generated based on an
    // exception-based model. The fastest supported sampling interval may be equal to 0, which indicates
    // that the data item is exception-based rather than being sampled at some period. An exception-based
    // model means that the underlying system does not require sampling and reports data changes.
    self.samplingInterval = _adjust_sampling_interval(options.samplingInterval);
    self.discardOldest = options.discardOldest;
    self.queueSize = _adjust_queue_size(options.queueSize);
  }

  /**
   * Terminate the  MonitoredItem.
   * @method terminate
   *
   * This will stop the internal sampling timer.
   */
  terminate() {
    const self = this;
    self._stop_sampling();
  }

  /**
   * @method _on_sampling_timer
   * @private
   * request
   *
   */
  _on_sampling_timer() {
    const self = this;


    // istanbul ignore next
    if (doDebug) {
      debugLog("MonitoredItem#_on_sampling_timer", self.node ? self.node.nodeId.toString() : "null", self._is_sampling);
    }

    if (self._samplingId) {
      assert(self.monitoringMode === MonitoringMode.Sampling || self.monitoringMode == MonitoringMode.Reporting);

      if (self._is_sampling) {
        // previous sampling call is not yet completed..
        // there is nothing we can do about it except waiting until next tick.
        // note : see also issue #156 on github
        return;
      }
      // xx console.log("xxxx ON SAMPLING");
      assert(!self._is_sampling, "sampling func shall not be re-entrant !! fix it");

      assert(_.isFunction(self.samplingFunc));

      self._is_sampling = true;

      self.samplingFunc.call(self, self.oldDataValue, (err, newDataValue) => {
        if (err) {
          console.log(" SAMPLING ERROR =>", err);
        } else {
          self._on_value_changed(newDataValue);
        }
        self._is_sampling = false;
      });
    } else {
      /* istanbul ignore next */
      debugLog("_on_sampling_timer call but MonitoredItem has been terminated !!! ");
    }
  }

  /**
   * @method recordValue
   * @param dataValue {DataValue}     the whole dataValue
   *
   * Note: recordValue can only be called within timer event
   */
  recordValue(dataValue, force) {
    const self = this;

    // istanbul ignore next
    if (doDebug) {
      debugLog("MonitoredItem#recordValue", self.node.nodeId.toString(), self.node.browseName.toString());
    }

    assert(dataValue instanceof DataValue);
    assert(dataValue !== self.oldDataValue);

    // extract the range that we are interested with
    dataValue = extractRange(dataValue, self.itemToMonitor.indexRange);

    const hasChanged = !sameDataValue(dataValue, self.oldDataValue);

    if (!hasChanged) {
      // may be semantic has changed !
      const hasSemanticChanged = self.node && (self.node.semantic_version !== self._semantic_version);
      if (hasSemanticChanged) {
        self._enqueue_value(dataValue);
      }
      return;
    }

    if (!apply_filter(self, dataValue)) {
      return;
    }

    // store last value
    self._enqueue_value(dataValue);
  }

  _setOverflowBit(notification) {
    if (notification.hasOwnProperty("value")) {
      assert(notification.value.statusCode === StatusCodes.Good);
      notification.value.statusCode = StatusCodes.makeStatusCode(notification.value.statusCode, "Overflow | InfoTypeDataValue");
      assert(_.isEqual(notification.value.statusCode, StatusCodes.GoodWithOverflowBit));
      assert(notification.value.statusCode.hasOverflowBit);
    }
  }

  _enqueue_notification(notification) {
    const self = this;

    if (self.queueSize === 1) {
      // ensure queuesize
      if (!self.queue || self.queue.length !== 1) {
        self.queue = [null];
      }
      self.queue[0] = notification;
      assert(self.queue.length === 1);
    } else if (self.discardOldest) {
      // push new value to queue
      self.queue.push(notification);

      if (self.queue.length > self.queueSize) {
        self.overflow = true;

        self.queue.shift(); // remove front element

        // set overflow bit
        self._setOverflowBit(self.queue[0]);
      }
    } else if (self.queue.length < self.queueSize) {
      self.queue.push(notification);
    } else {
      self.overflow = true;

      self._setOverflowBit(notification);

      self.queue[self.queue.length - 1] = notification;
    }
    assert(self.queue.length >= 1);
  }

  _makeDataChangeNotification(dataValue) {
    const self = this;
    const attributeId = self.itemToMonitor.attributeId;
    dataValue = apply_timestamps(dataValue, self.timestampsToReturn, attributeId);
    return new subscription_service.MonitoredItemNotification({ clientHandle: self.clientHandle, value: dataValue });
  }

  _enqueue_value(dataValue) {
    const self = this;

    // istanbul ignore next
    if (doDebug) {
      debugLog("MonitoredItem#_enqueue_value", self.node.nodeId.toString());
    }
    self.oldDataValue = dataValue;
    const notification = self._makeDataChangeNotification(dataValue);
    self._enqueue_notification(notification);
  }

  _makeEventFieldList(eventFields) {
    const self = this;
    assert(_.isArray(eventFields));
    return new subscription_service.EventFieldList({ clientHandle: self.clientHandle, eventFields });
  }

  _enqueue_event(eventFields) {
    const self = this;
    debugLog(" MonitoredItem#_enqueue_event");
    const notification = self._makeEventFieldList(eventFields);
    self._enqueue_notification(notification);
  }

  _empty_queue() {
    const self = this;
    // empty queue
    self.queue = [];
    self.overflow = false;
  }

  /**
   * @method  extractMonitoredItemNotifications
   * @return {Array.<*>}
   */
  extractMonitoredItemNotifications() {
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
  }

  _clear_timer() {
    const self = this;
    if (self._samplingId) {
      if (useCommonTimer) {
        removeFromTimer(self);
      } else {
        clearInterval(self._samplingId);
      }
      self._samplingId = 0;
    }
  }

  _set_timer() {
    const self = this;
    assert(self.samplingInterval >= minimumSamplingInterval);
    assert(!self._samplingId);


    if (useCommonTimer) {
      self._samplingId = appendToTimer(self);
    } else {
      // settle periodic sampling
      self._samplingId = setInterval(() => {
        self._on_sampling_timer();
      }, self.samplingInterval);
    }
  }

  _adjust_queue_to_match_new_queue_size(old_queueSize) {
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
  }

  _adjust_sampling(old_samplingInterval) {
    const self = this;
    if (old_samplingInterval !== self.samplingInterval) {
      self._start_sampling();
      // xx self._clear_timer(true);
      // xx self._set_timer();
    }
  }

  modify(timestampsToReturn, options) {
    assert(options instanceof MonitoringParameters);

    const self = this;

    const old_queueSize = self.queueSize;
    const old_samplingInterval = self.samplingInterval;

    self.timestampsToReturn = timestampsToReturn || self.timestampsToReturn;

    if (old_samplingInterval !== 0 && options.samplingInterval === 0) {
      options.samplingInterval = minimumSamplingInterval; // fastest possible
    }

    self._set_parameters(options);

    self._adjust_queue_to_match_new_queue_size(old_queueSize);

    self._adjust_sampling(old_samplingInterval);


    if (options.filter) {
      const statusCodeFilter = validateFilter(options.filter, self.itemToMonitor, self.node);
      if (statusCodeFilter !== StatusCodes.Good) {
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
      filterResult
    });
  }
  get node() {
    return this._node;
  }

  set node(value) {
    throw new Error("Unexpected way to set node");
  }

  /**
   * @property isSampling
   * @type boolean
   */
  get isSampling() {
    const self = this;
    return !!self._samplingId || _.isFunction(self._value_changed_callback) ||
      _.isFunction(self._attribute_changed_callback);
  }

  get hasMonitoredItemNotifications() {
    const self = this;
    return self.queue.length > 0;
  }


}


MonitoredItem.registry = new ObjectRegistry();

MonitoredItem.minimumSamplingInterval = minimumSamplingInterval;
MonitoredItem.defaultSamplingInterval = defaultSamplingInterval;
MonitoredItem.maximumSamplingInterval = maximumSamplingInterval;

function _validate_parameters(options) {
  // xx assert(options instanceof MonitoringParameters);
  assert(options.hasOwnProperty("clientHandle"));
  assert(options.hasOwnProperty("samplingInterval"));
  assert(_.isFinite(options.clientHandle));
  assert(_.isFinite(options.samplingInterval));
  assert(_.isBoolean(options.discardOldest));
  assert(_.isFinite(options.queueSize));
  assert(options.queueSize >= 0);
}


const DataChangeFilter = subscription_service.DataChangeFilter;
const DataChangeTrigger = subscription_service.DataChangeTrigger;
const DeadbandType = subscription_service.DeadbandType;

function statusCodeHasChanged(newDataValue, oldDataValue) {
  assert(newDataValue instanceof DataValue);
  assert(oldDataValue instanceof DataValue);
  return newDataValue.statusCode !== oldDataValue.statusCode;
}


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
    return true;
  }
  if (self.filter instanceof DataChangeFilter) {
    return apply_datachange_filter(self, newDataValue, self.oldDataValue);
  } 
    // if filter not set, by default report changes to Status or Value only
  return !sameDataValue(newDataValue, self.oldDataValue, TimestampsToReturn.Neither);
  
  return true; // keep
}


function setSemanticChangeBit(notification) {
  if (notification && notification.hasOwnProperty("value")) {
    notification.value.statusCode = StatusCodes.makeStatusCode(notification.value.statusCode, "SemanticChanged");
  }
}

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

    _t._samplingId = setInterval(() => {
      _.forEach(_t.monitoredItems, (m) => {
        setImmediate(() => {
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

export { MonitoredItem };
