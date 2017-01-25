/**
 * @module opcua.address_space.AlarmsAndConditions
 */

import { EventEmitter } from "events";
import util from "util";
import assert from "better-assert";
import _ from "underscore";
import UAVariable from "lib/address_space/UAVariable";
import { Variant, DataType } from "lib/datamodel/variant";
import { StatusCodes, StatusCode } from "lib/datamodel/opcua_status_code";
import { UAObjectType } from "lib/address_space/ua_object_type";
import { UAObject } from "lib/address_space/ua_object";
import { BaseNode } from "lib/address_space/base_node";
import { AttributeIds } from "lib/datamodel/attributeIds";
import { NodeClass } from "lib/datamodel/nodeclass";
import { resolveNodeId, NodeId, makeNodeId } from "lib/datamodel/nodeid";
import { coerceLocalizedText, LocalizedText } from "lib/datamodel/localized_text";
import EventData from "lib/address_space/add-event-type/EventData";
import { BrowseDirection } from "lib/services/browse_service";
import { TimeZone } from "lib/datamodel/time_zone";
import AddressSpace from "lib/address_space/AddressSpace";
import {
  make_debugLog,
  checkDebugFlag,
  lowerFirstLetter
} from "lib/misc/utils";
import * as ec from "lib/misc/encode_decode";
import { makeAccessLevel } from "lib/datamodel/access_level";


require("set-prototype-of");

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

/* eslint-disable no-param-reassign */
function _visit(self, node, prefix) {
  const aggregates = node.getAggregates();

  aggregates.forEach((aggregate) => {
    if (aggregate instanceof UAVariable) {
      let name = aggregate.browseName.toString();
      name = lowerFirstLetter(name);

      const key = prefix + name;
      if (doDebug || true) {
        debugLog("addingkey =", key);
      }
      self._map[key] = aggregate.readValue().value;
      self._node_index[key] = aggregate;
      _visit(self, aggregate, `${prefix + name}.`);
    }
  });
}
function _record_condition_state(self, condition) {
  self._map = {};
  self._node_index = {};
  // this wuld create circular reference..
  // assert(condition instanceof UAConditionBase);
  _visit(self, condition, "");
}

/**
 * @class ConditionSnapshot
 * @extends EventEmitter
 * @param condition
 * @param branchId
 * @constructor
 */
class ConditionSnapshot extends EventEmitter {
  constructor(condition, branchId) {
    super();
    const self = this;
    if (condition && branchId) {
      assert(branchId instanceof NodeId);
      // xx self.branchId = branchId;
      self.condition = condition;
      self.eventData = new EventData(condition);
      // a nodeId/Variant map
      _record_condition_state(self, condition);

      self._set_var("branchId", DataType.NodeId,branchId);
    }
  }

  /**
   *
   * @return {ConditionSnapshot}
   */
  clone() {
    const self = this;
    const clone = new ConditionSnapshot();
    clone.branchId = self.branchId;
    clone.condition = self.condition;
    // xx clone.eventData = new EventData(clone.condition);
    clone._map = _.clone(self._map);
    return clone;
  }

  _constructEventData() {
    const self = this;
    const addressSpace = self.condition.addressSpace;

    const isDisabled = !self.condition.enabledState.getValue();
    const eventData = new EventData(self.condition);
    Object.keys(self._map).forEach((key) => {
      const node = self._node_index[key];
      if (isDisabled && !Object.prototype.hasOwnProperty.call(_varTable, key)) {
        eventData.setValue(key,node,disabledVar);
      } else {
        eventData.setValue(key,node,self._map[key]);
      }
    });
    return eventData;

      // self.condition.getAggregates().forEach(function(child){
      //     if (child instanceof UAVariable) {
      //         var name = utils.lowerFirstLetter(child.browseName.toString());
      //         self.eventData[name] =child.readValue().value;
      //     }
      // });
      // return self.eventData.clone();
  }

  /**
   * @method resolveSelectClause
   * @param selectClause
   */
  resolveSelectClause(selectClause) {
    const self = this;
    return self.eventData.resolveSelectClause(selectClause);
  }

  /**
   *
   * @param nodeId
   * @param selectClause
   * @return {*}
   */
  readValue(nodeId, selectClause) {
    const self = this;

    const isDisabled = !self.condition.enabledState.getValue();
    if (isDisabled) {
      return disabledVar;
    }

    const key = nodeId.toString();
    const variant = self._map[key];
    if (!variant) {
          // the value is not handled by us .. let's delegate
          // to the eventData helper object
      return self.eventData.readValue(nodeId, selectClause);
    }
    assert(variant instanceof Variant);
    return variant;
  }

  _get_var(varName, dataType) {
    const self = this;

    if (!self.condition.enabledState.getValue()
      && !Object.prototype.hasOwnProperty.call(_varTable, varName)
    ) {
      return disabledVar;
    }

    const key = normalizeName(varName);
    const variant = self._map[key];
    return variant.value;
  }

  _set_var(varName, dataType, value) {
    const self = this;

    const key = normalizeName(varName);
       // istanbul ignore next
    if (!Object.prototype.hasOwnProperty.call(self._map, key)) {
      if (true || doDebug) {
        debugLog(" cannot find node ".white.bold.bgRed + varName.cyan);
        debugLog("  map=", Object.keys(self._map).join(" "));
      }
    }
    self._map[key] = new Variant({ dataType, value });

    if (self._map[`${key}.sourceTimestamp`]) {
      self._map[`${key}.sourceTimestamp`] = new Variant({ dataType: DataType.DateTime, value: new Date() });
    }

    const variant = self._map[key];
    const node = self._node_index[key];
    assert(node instanceof UAVariable);
    self.emit("value_changed", node, variant);
  }

  /**
   * @method getBrandId
   * @return {NodeId}
   */
  getBranchId() {
    const self = this;
    return self._get_var("branchId", DataType.NodeId);
  }

  /**
   * @method getEventId
   * @return {ByteString}
   */
  getEventId() {
    const self = this;
    return self._get_var("eventId", DataType.ByteString);
  }

  /**
   * @return {Boolean}
   */
  getRetain() {
    const self = this;
    return self._get_var("retain", DataType.Boolean);
  }

  /**
   *
   * @param retainFlag {Boolean}
   */
  setRetain(retainFlag) {
    const self = this;
    retainFlag = !!retainFlag;
    return self._set_var("retain", DataType.Boolean, retainFlag);
  }

  /**
   *
   */
  renewEventId() {
    const self = this;
    const addressSpace = self.condition.addressSpace;
      // create a new event  Id for this new condition
    const eventId = addressSpace.generateEventId();
    return self._set_var("eventId", DataType.ByteString, eventId.value);
  }

  /**
   * @return {LocalizedText}
   */
  getComment() {
    const self = this;
    return self._get_var("comment", DataType.LocalizedText);
  }

  /**
   * Set condition comment
   *
   * Comment contains the last comment provided for a certain state (ConditionBranch). It may
   * have been provided by an AddComment Method, some other Method or in some other
   * manner. The initial value of this Variable is null, unless it is provided in some other
   * manner. If a Method provides as an option the ability to set a Comment, then the value
   * of this Variable is reset to null if an optional comment is not provided.
   *
   * @method setComment
   * @param txtMessage {LocalizedText}
   */
  setComment(txtMessage) {
    const self = this;
    assert(txtMessage);
    txtMessage = coerceLocalizedText(txtMessage);
    self._set_var("comment", DataType.LocalizedText, txtMessage);
      /*
       * OPCUA Spec 1.0.3 - Part 9:
       * Comment, severity and quality are important elements of Conditions and any change
       * to them will cause Event Notifications.
       *
       */
    self._need_event_raise = true;
  }

  /**
   *
   * @param txtMessage {LocalizedText}
   */
  setMessage(txtMessage) {
    const self = this;
    assert(txtMessage);
    txtMessage = coerceLocalizedText(txtMessage);
    return self._set_var("message", DataType.LocalizedText, txtMessage);
  }

  /**
   *
   * @param userIdentity {String}
   */
  setClientUserId(userIdentity) {
    const self = this;
    return self._set_var("clientUserId", DataType.String, userIdentity.toString());
  }

  /*
   *
   *
   * as per spec 1.0.3 - Part 9
   *
   * Quality reveals the status of process values or other resources that this Condition instance is
   * based upon. If, for example, a process value is “Uncertain”, the associated “LevelAlarm”
   * Condition is also questionable. Values for the Quality can be any of the OPC StatusCodes
   * defined in Part 8 as well as Good, Uncertain and Bad as defined in Part 4. These
   * StatusCodes are similar to but slightly more generic than the description of data quality in
   * the various field bus specifications. It is the responsibility of the Server to map internal
   * status information to these codes. A Server which supports no quality information shall return
   * Good.
   * This quality can also reflect the communication status associated with the system that this
   * value or resource is based on and from which this Alarm was received. For communication
   * errors to the underlying system, especially those that result in some unavailable Event fields,
   * the quality shall be Bad_NoCommunication error.
   *
   * Quality refers to the quality of the data value(s) upon which this Condition is based. Since a
   * Condition is usually based on one or more Variables, the Condition inherits the quality of
   * these Variables. E.g., if the process value is “Uncertain”, the “LevelAlarm” Condition is also
   * questionable. If more than one variable is represented by a given condition or if the condition
   * is from an underlining system and no direct mapping to a variable is available, it is up to the
   * application to determine what quality is displayed as part of the condition.
   */

  /**
   * set the condition quality
   * @method setQuality
   * @param quality {StatusCode}
   */
  setQuality(quality) {
    const self = this;
    assert(quality instanceof StatusCode);
    assert(Object.prototype.hasOwnProperty.call(quality, "value") || "quality must be a StatusCode");
    self._set_var("quality", DataType.StatusCode, quality);
      /*
       * OPCUA Spec 1.0.3 - Part 9:
       * Comment, severity and quality are important elements of Conditions and any change
       * to them will cause Event Notifications.
       *
       */
    self._need_event_raise = true;
  }

  /**
   * @method getQuality
   * @return {StatusCode}
   */
  getQuality() {
    const self = this;
    return self._get_var("quality", DataType.StatusCode);
  }

  /*
   * as per spec 1.0.3 - Part 9
   * The Severity of a Condition is inherited from the base Event model defined in Part 5. It
   * indicates the urgency of the Condition and is also commonly called ‘priority’, especially in
   * relation to Alarms in the ProcessConditionClass.
   *
   * as per spec 1.0.3 - PArt 5
   * Severity is an indication of the urgency of the Event. This is also commonly called “priority”.
   * Values will range from 1 to 1 000, with 1 being the lowest severity and 1 000 being the
   * highest. Typically, a severity of 1 would indicate an Event which is informational in nature,
   * while a value of 1 000 would indicate an Event of catastrophic nature, which could potentially
   * result in severe financial loss or loss of life.
   * It is expected that very few Server implementations will support 1 000 distinct severity
   * levels.
   * Therefore, Server developers are responsible for distributing their severity levels across the
   * 1 to 1 000 range in such a manner that clients can assume a linear distribution. For example, a
   * client wishing to present five severity levels to a user should be able to do the following
   * mapping:
   *            Client Severity OPC Severity
   *                HIGH        801 – 1 000
   *                MEDIUM HIGH 601 – 800
   *                MEDIUM      401 – 600
   *                MEDIUM LOW  201 – 400
   *                LOW           1 – 200
   * In many cases a strict linear mapping of underlying source severities to the OPC Severity range
   * is not appropriate. The Server developer will instead intelligently map the underlying source
   * severities to the 1 to 1 000 OPC Severity range in some other fashion. In particular, it is
   * recommended that Server developers map Events of high urgency into the OPC severity range
   * of 667 to 1 000, Events of medium urgency into the OPC severity range of 334 to 666 and
   * Events of low urgency into OPC severities of 1 to 333.
   */
  /**
   * @method setSeverity
   * @param severity {UInt16}
   */
  setSeverity(severity) {
    const self = this;
      // record automatically last severity
    const lastSeverity = self.getSeverity();
    self.setLastSeverity(lastSeverity);
    self._set_var("severity", DataType.UInt16, severity);
      /*
       * OPCUA Spec 1.0.3 - Part 9:
       * Comment, severity and quality are important elements of Conditions and any change
       * to them will cause Event Notifications.
       *
       */
    self._need_event_raise = true;
  }

  /**
   * @return {UInt16}
   */
  getSeverity() {
    const self = this;
    return self._get_var("severity", DataType.UInt16);
  }

  /*
   * as per spec 1.0.3 - part 9:
   *  LastSeverity provides the previous severity of the ConditionBranch. Initially this Variable
   *  contains a zero value; it will return a value only after a severity change.
   *  The new severity is supplied via the Severity Property which is inherited
   *  from the BaseEventType.
   *
   */
  /**
   * @method setLastSeverity
   * @param severity {UInt16}
   */
  setLastSeverity(severity) {
    const self = this;
    severity = +severity;
    return self._set_var("lastSeverity", DataType.UInt16, severity);
  }

  /**
   * @method getLastSeverity
   * @return {UInt16}
   */
  getLastSeverity() {
    const self = this;
    const value = self._get_var("lastSeverity", DataType.UInt16);
    return +value;
  }

  /**
   * setReceiveTime
   *
   * (as per OPCUA 1.0.3 part 5)
   *
   * ReceiveTime provides the time the OPC UA Server received the Event from the underlying
   * device of another Server.
   *
   * ReceiveTime is analogous to ServerTimestamp defined in Part 4, i.e.
   * in the case where the OPC UA Server gets an Event from another OPC UA Server, each Server
   * applies its own ReceiveTime. That implies that a Client may get the same Event, having the
   * same EventId, from different Servers having different values of the ReceiveTime.
   *
   * The ReceiveTime shall always be returned as value and the Server is not allowed to return a
   * StatusCode for the ReceiveTime indicating an error.
   *
   * @method setReceiveTime
   * @param time {Date} : UTCTime
   */
  setReceiveTime(time) {
    assert(time instanceof Date);
    const self = this;
    return self._set_var("receiveTime", DataType.DateTime, time);
  }

  /**
   * (as per OPCUA 1.0.3 part 5)

   * Time provides the time the Event occurred. This value is set as close to the event generator as
   * possible. It often comes from the underlying system or device. Once set, intermediate OPC UA
   * Servers shall not alter the value.
   *
   * @method setTime
   * @param time {Date}
   */
  setTime(time) {
    assert(time instanceof Date);
    const self = this;
    return self._set_var("time", DataType.DateTime, time);
  }

  /**
   * LocalTime is a structure containing the Offset and the DaylightSavingInOffset flag. The Offset
   * specifies the time difference (in minutes) between the Time Property and the time at the
   * location in which the event was issued. If DaylightSavingInOffset is TRUE, then
   * Standard/Daylight savings time (DST) at the originating location is in effect and Offset
   * includes the DST c orrection. If FALSE then the Offset does not include DST correction and DST
   * may or may not have been in effect.
   * @method setLocalTime
   * @param localTime {TimeZone}
   */
  setLocalTime(localTime) {
    assert(localTime instanceof TimeZone);
    const self = this;
    return self._set_var("localTime", DataType.ExtensionObject, new TimeZone(localTime));
  }

  // read only !
  getSourceName() {
    return this._get_var("sourceName", DataType.LocalizedText);
  }

  /**
   * @method getSourceNode
   * return {NodeId}
   */
  getSourceNode() {
    return this._get_var("sourceNode", DataType.NodeId);
  }

  /**
   * @method getEventType
   * return {NodeId}
   */
  getEventType() {
    return this._get_var("eventType", DataType.NodeId);
  }

  /**
   * @method getMessage
   * return {LocalizedText}
   */
  getMessage() {
    return this._get_var("message", DataType.LocalizedText);
  }
}

const disabledVar = new Variant({ dataType: "StatusCode", value: StatusCodes.BadConditionDisabled });

function normalizeName(str) {
  return str.split(".").map(lowerFirstLetter).join(".");
}
ConditionSnapshot.normalizeName = normalizeName;
let _varTable = {
  eventId: 1,
  eventType: 1,
  SourceNode: 1,
  sourceName: 1,
  time: 1,
  enabledState: 1
};

const randomGuid = ec.randomGuid;

function _create_new_branch_id() {
  return makeNodeId(randomGuid(), 1);
}

const minDate = new Date(1600, 1, 1);

function prepare_date(sourceTimestamp) {
  if (!sourceTimestamp || !sourceTimestamp.value) {
    return minDate;
  }
  assert(sourceTimestamp.value instanceof Date);
  return sourceTimestamp;
}

function _update_sourceTimestamp(dataValue/* , indexRange*/) {
  const self = this;
  // xx console.log(
  //   "_update_sourceTimestamp = "+self.nodeId.toString().cyan+ " " + self.browseName.toString(),
  //   self.sourceTimestamp.nodeId.toString().cyan + " " + dataValue.sourceTimestamp
  // );
  self.sourceTimestamp.setValueFromSource({
    dataType: DataType.DateTime,
    value: dataValue.sourceTimestamp
  });
}

function _install_condition_variable_type(node) {
  // from spec 1.03 : 5.3 condition variables
  // However,  a change in their value is considered important and supposed to trigger
  // an Event Notification. These information elements are called ConditionVariables.
  node.sourceTimestamp.accessLevel = makeAccessLevel("CurrentRead");
  node.accessLevel = makeAccessLevel("CurrentRead");

  // from spec 1.03 : 5.3 condition variables
  // a condition VariableType has a sourceTimeStamp exposed property
  // SourceTimestamp indicates the time of the last change of the Value of this ConditionVariable.
  // It shall be the same time that would be returned from the Read Service inside the DataValue
  // structure for the ConditionVariable Value Attribute.

  assert(node.typeDefinitionObj.browseName.toString() === "ConditionVariableType");
  assert(node.sourceTimestamp.browseName.toString() === "SourceTimestamp");
  node.on("value_changed", _update_sourceTimestamp);
}


function sameBuffer(b1, b2) {
  if (!b1 && !b2) {
    return true;
  }
  if (b1 && !b2) {
    return false;
  }
  if (!b1 && b2) {
    return false;
  }
  assert(b1 instanceof Buffer);
  assert(b2 instanceof Buffer);
  if (b1.length !== b2.length) {
    return false;
  }
/*
    var bb1 = (Buffer.from(b1)).toString("hex");
    var bb2 = (Buffer.from(b2)).toString("hex");
    return bb1 == bb2;
*/
  const n = b1.length;
  for (let i = 0; i < n; i += 1) {
    if (b1[i] !== b2[i]) {
      return false;
    }
  }
  return true;
}

function _perform_condition_refresh(addressSpace, inputArguments, context) {
  // --- possible StatusCodes:
  //
  // Bad_SubscriptionIdInvalid  See Part 4 for the description of this result code
  // Bad_RefreshInProgress      See Table 74 for the description of this result code
  // Bad_UserAccessDenied       The Method was not called in the context of the Session
  //                            that owns the Subscription
  //

  // istanbul ignore next
  if (addressSpace._condition_refresh_in_progress) {
    // a refresh operation is already in progress....
    return StatusCodes.BadRefreshInProgress;
  }

  addressSpace._condition_refresh_in_progress = true;

  const server = context.object.addressSpace.rootFolder.objects.server;
  assert(server instanceof UAObject);

  const refreshStartEventType = addressSpace.findEventType("RefreshStartEventType");
  const refreshEndEventType = addressSpace.findEventType("RefreshEndEventType");

  assert(refreshStartEventType instanceof UAObjectType);
  assert(refreshEndEventType instanceof UAObjectType);

  server.raiseEvent(refreshStartEventType, {});
    // todo : resend retained conditions

    // starting from server object ..
    // evaluated all --> hasNotifier/hasEventSource -> node
  server._conditionRefresh();

  server.raiseEvent(refreshEndEventType, {});

  addressSpace._condition_refresh_in_progress = false;

  return StatusCodes.Good;
}

/**
 * verify that the subscription id belongs to the session that
 * make the call.
 *
 * @param subscriptionId {Number}
 * @param context {Object}
 * @private
 */
function _check_subscription_id_is_valid(subscriptionId, context) {
  // / todo: return StatusCodes.BadSubscriptionIdInvalid;
  // if subscriptionId doesn't belong to session...
  return StatusCodes.Good;
}

function _condition_refresh_method(inputArguments, context, callback) {
  // arguments : IntegerId SubscriptionId
  assert(inputArguments.length === 1);

  const addressSpace = context.object.addressSpace;
  if (doDebug) {
    debugLog(" ConditionType.ConditionRefresh ! subscriptionId =".red.bgWhite, inputArguments[0].toString());
  }
  const subscriptionId = inputArguments[0].value;

  let statusCode = _check_subscription_id_is_valid(subscriptionId, context);
  if (statusCode !== StatusCodes.Good) {
    return statusCode;
  }

  statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
  return callback(null, { statusCode });
}

function _condition_refresh2_method(inputArguments, context, callback) {
    // arguments : IntegerId SubscriptionId
    // arguments : IntegerId MonitoredItemId
  assert(inputArguments.length === 2);

  const addressSpace = context.object.addressSpace;
  assert(context.server instanceof OPCUAServer);

    // istanbul ignore next
  if (doDebug) {
    debugLog(" ConditionType.conditionRefresh2 !".cyan.bgWhite);
  }

  const subscriptionId = inputArguments[0].value;
  const monitoredItemId = inputArguments[1].value;

  const statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
  return callback(null, { statusCode });
}


/**
 * @method _getCompositeKey
 * @param node {BaseNode}
 * @param key {String}
 * @return {BaseNode}
 * @private
 *
 * @example
 *
 *     var node  = _getComposite(node,"enabledState.id");
 *
 */
function _getCompositeKey(node, key) {
  let cur = node;
  const elements = key.split(".");
  for (let i = 0; i < elements.length; i += 1) {
    const e = elements[i];

        // istanbul ignore next
    if (!Object.prototype.hasOwnProperty.call(cur, e)) {
      throw new Error(` cannot extract '${key}' from ${node.browseName.toString()}`);
    }

    cur = cur[e];
  }
  return cur;
}


export default ConditionSnapshot;
