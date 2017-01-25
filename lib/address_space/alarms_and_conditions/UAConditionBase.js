/**
 * @module opcua.address_space.AlarmsAndConditions
 */

import { EventEmitter } from "events";
import util from "util";
import assert from "better-assert";
import _ from "underscore";
import UAVariable from "lib/address_space/UAVariable";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { StatusCode } from "lib/datamodel/opcua_status_code";
import { UAObjectType } from "lib/address_space/ua_object_type";
import { UAObject } from "lib/address_space/ua_object";
import { BaseNode } from "lib/address_space/base_node";
import { AttributeIds } from "lib/datamodel/attributeIds";
import { NodeClass } from "lib/datamodel/nodeclass";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { coerceLocalizedText } from "lib/datamodel/localized_text";
import { LocalizedText } from "lib/datamodel/localized_text";
import { NodeId } from "lib/datamodel/nodeid";
import EventData from "lib/address_space/add-event-type/EventData";
import ConditionSnapshot from './ConditionSnapshot';

import AddressSpace from "lib/address_space/AddressSpace";
import {
  make_debugLog,
  checkDebugFlag,
  lowerFirstLetter
} from "lib/misc/utils";
import * as ec from "lib/misc/encode_decode";
import { makeNodeId } from "lib/datamodel/nodeid";
import { makeAccessLevel } from "lib/datamodel/access_level";


require("set-prototype-of");

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);





let TimeZone;


/**
 * @class BaseEventType
 * @class UAObject
 * @constructor
 */
class BaseEventType extends UAObject {
  /**
   * @method setSourceName
   * @param name
   */
  setSourceName(name) {
    assert(typeof (name) === "string");
    const self = this;
    self.sourceName.setValueFromSource(new Variant({
      dataType: DataType.String,
      value: name
    }));
  }

  /**
   * @method setSourceNode
   * @param node {NodeId|UAObject}
   */
  setSourceNode(node) {
    const self = this;
    self.sourceNode.setValueFromSource(new Variant({
      dataType: DataType.NodeId,
      value: node.nodeId ? node.nodeId : node
    }));
  }
}

/**
 * @class UAConditionBase
 * @constructor
 * @extends BaseEventType
 */
class UAConditionBase extends BaseEventType {
  /**
   * @method initialize
   * @private
   */
  initialize() {
    const self = this;
    self._branches = {};
  }

  /**
   * @method post_initialize
   * @private
   */
  post_initialize() {
    const self = this;
    assert(!self._branch0);
    self._branch0 = new ConditionSnapshot(self, NodeId.NullNodeId);

      // the condition OPCUA object alway reflect the default branch states
      // so we set a mechanism that automatically keeps self in sync
      // with the default branch.
    self._branch0.on("value_changed", (node, variant) => {
      assert(node instanceof UAVariable);
      node.setValueFromSource(variant);
    });
  }

  /**
   * @method getBranchCount
   * @return {Number}
   */
  getBranchCount() {
    const self = this;
    return Object.keys(self._branches).length;
  }

  /**
   * @method createBranch
   * @returns {ConditionSnapshot}
   */
  createBranch() {
    const self = this;
    const branchId = _create_new_branch_id();
    const snapshot = new ConditionSnapshot(self, branchId);
    self._branches[branchId.toString()] = snapshot;
    return snapshot;
  }

  /**
   *  @method deleteBranch
   *  @param branch {ConditionSnapshot}
   */
  deleteBranch(branch) {
    const self = this;
    const key = branch.getBranchId().toString();
    assert(self._branches.hasOwnProperty(key));
    delete self._branches[key];
  }

  /**
   * @method getEnabledState
   * @return {Boolean}
   */
  getEnabledState() {
    const conditionNode = this;
    return !!conditionNode.enabledState.id.readValue().value.value;
  }

  /**
   * @method _setEnabledState
   * @param requestedEnableState {Boolean}
   * @returns {StatusCode} StatusCodes.Good if successfull or BadConditionAlreadyEnabled/BadConditionAlreadyDisabled
   * @private
   */
  _setEnabledState(requestedEnableState) {
    assert(_.isBoolean(requestedEnableState));

    const conditionNode = this;
    const enabledState = conditionNode.getEnabledState();
    if (enabledState && requestedEnableState) {
      return StatusCodes.BadConditionAlreadyEnabled;
    }
    if (!enabledState && !requestedEnableState) {
      return StatusCodes.BadConditionAlreadyDisabled;
    }
    conditionNode.enabledState.setValue(requestedEnableState);

    if (!requestedEnableState) {
          // as per Spec 1.0.3 part 9:
          //* When the Condition instance enters the Disabled state, the Retain Property of this
          // Condition shall be set to FALSE by the Server to indicate to the Client that the
          // Condition instance is currently not of interest to Clients.
          // TODO : shall we really set retain to false or artificially expose the retain false as false
          //        whist enabled state is false ?
      conditionNode._previousRetainFlag = conditionNode.currentBranch().getRetain();
      conditionNode.currentBranch().setRetain(false);

          // install the mechanism by which all condition values will be return
          // as Null | BadConditionDisabled;
      const statusCode = StatusCodes.BadConditionDisabled;


          // a notification must be send
      conditionNode.raiseConditionEvent(conditionNode.currentBranch());
    } else {
          //* When the Condition instance enters the enabled state, the Condition shall be
          //  evaluated and all of its Properties updated to reflect the current values. If this
          //  evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
          //  then an Event Notification shall be generated for that ConditionBranch.
          // todo evaluate branches

          // restore retain flag
      if (conditionNode.hasOwnProperty("_previousRetainFlag")) {
        conditionNode.currentBranch().setRetain(conditionNode._previousRetainFlag);
      }

          // todo send notification for branches with retain = true
      if (conditionNode.currentBranch().getRetain()) {
        conditionNode._resend_conditionEvents();
      }

          // a notification must be send
      conditionNode.raiseConditionEvent(conditionNode.currentBranch());
    }
    return StatusCodes.Good;
  }

  /**
   * @method setReceiveTime
   * @param time {Date}
   */
  setReceiveTime(time) {
    const self = this;
    return self._branch0.setReceiveTime(time);
  }

  /**
   * @method setLocalTime
   * @param time {Date}
   */
  setLocalTime(time) {
    const self = this;
    return self._branch0.setLocalTime(time);
  }

  /**
   * @method setTime
   * @param time {Date}
   */
  setTime(time) {
    const self = this;
    return self._branch0.setTime(time);
  }

  _assert_valid() {
    const self = this;
    assert(self.receiveTime.readValue().value.dataType == DataType.DateTime);
    assert(self.receiveTime.readValue().value.value instanceof Date);

    assert(self.localTime.readValue().value.dataType == DataType.ExtensionObject);
    assert(self.message.readValue().value.dataType == DataType.LocalizedText);
    assert(self.severity.readValue().value.dataType == DataType.UInt16);

    assert(self.time.readValue().value.dataType == DataType.DateTime);
    assert(self.time.readValue().value.value instanceof Date);

    assert(self.quality.readValue().value.dataType == DataType.StatusCode);
    assert(self.enabledState.readValue().value.dataType == DataType.LocalizedText);
    assert(self.branchId.readValue().value.dataType == DataType.NodeId);
  }

  /**
   * @method conditionOfNode
   * @return {UAObject}
   */
  conditionOfNode() {
    const refs = this.findReferencesExAsObject("HasCondition",BrowseDirection.Inverse);
    if (refs.length == 0) {
      return null;
    }
    assert(refs.length != 0,"UAConditionBase must be the condition of some node");
    assert(refs.length === 1,"expecting only one ConditionOf");
    const node = refs[0];
    assert(node instanceof UAObject || node instanceof UAVariable,"node for which we are the condition shall be an UAObject or UAVariable");
    return node;
  }

  /**
   * @method raiseConditionEvent
   * Raise a Instance Event
   * (see also UAObject#raiseEvent to raise a transient event)
   * @param branch {ConditionSnapshot}
   */
  raiseConditionEvent(branch) {
    assert(branch instanceof ConditionSnapshot);
    const self = this;
    self._assert_valid();

      // In fact he event is raised by the object of which we are the condition
    const conditionOfNode = self.conditionOfNode();

    if (conditionOfNode) {
      const eventData = branch._constructEventData();
      if (conditionOfNode instanceof UAObject) {
              // xx assert(conditionOfNode.eventNotifier === 0x01);
        conditionOfNode._bubble_up_event(eventData);
      } else {
        assert(conditionOfNode instanceof UAVariable);
              // in this case
        const eventOfs = conditionOfNode.getEventSourceOfs();
        assert(eventOfs.length === 1);
        const node  = eventOfs[0];
        assert(node instanceof UAObject);
        node._bubble_up_event(eventData);
      }
    }
  }

  /**
   *
   * @method raiseNewCondition
   * @param conditionInfo {ConditionInfo}
   *
   */
  raiseNewCondition(conditionInfo) {
    TimeZone = TimeZone || require("lib/datamodel/time_zone").TimeZone;
    conditionInfo = conditionInfo || {};

    conditionInfo.severity = conditionInfo.hasOwnProperty("severity") ? conditionInfo.severity : UAConditionBase.defaultSeverity;

      // only valid for ConditionObjects
      // todo check that object is of type ConditionType

    const self = this;
    const addressSpace = self.addressSpace;

    const selfConditionType = self.typeDefinitionObj;
    const conditionType = addressSpace.findObjectType("ConditionType");

    assert(selfConditionType.isSupertypeOf(conditionType));

    const branch = self.currentBranch();

      // install the eventTimestamp
      // set the received Time
    branch.setTime(new Date());
    branch.setReceiveTime(new Date());
    branch.setLocalTime(new TimeZone({ offset: 0, daylightSavingInOffset: false }));

    if (conditionInfo.hasOwnProperty("message") && conditionInfo.message) {
      branch.setMessage(conditionInfo.message);
    }
      // todo receive time : when the server received the event from the underlying system.
      // self.receiveTime.setValueFromSource();

    if (conditionInfo.hasOwnProperty("severity") && conditionInfo.severity != null) {
      branch.setSeverity(conditionInfo.severity);
    }
    if (conditionInfo.hasOwnProperty("quality") && conditionInfo.quality != null) {
      branch.setQuality(conditionInfo.quality);
    }
    if (conditionInfo.hasOwnProperty("retain") && conditionInfo.retain != null) {
      branch.setRetain(!!conditionInfo.retain);
    }

    branch.renewEventId();
    self.raiseConditionEvent(branch);
  }

  raiseNewBranchState(branch) {
    const self = this;
    branch.renewEventId();
    self.raiseConditionEvent(branch);

    if (branch.getBranchId() !== NodeId.NullNodeId && !branch.getRetain()) {
      console.log(" Deleting not longer needed branch ", branch.getBranchId().toString());
          // branch can be deleted
      self.deleteBranch(branch);
    }
  }

  _findBranchForEventId(eventId) {
    const conditionNode = this;
    if (sameBuffer(conditionNode.eventId.readValue().value.value, eventId)) {
      return conditionNode.currentBranch();
    }
    const e = _.filter(conditionNode._branches,(branch, key) => sameBuffer(branch.getEventId(),eventId));
    if (e.length == 1) {
      return e[0];
    }
    assert(e.length === 0,"cannot have 2 branches with same eventId");
    return null; // not found
  }

  /**
   * @method _raiseAuditConditionCommentEvent
   * @param sourceName {string}
   * @param eventId    {Buffer}
   * @param comment    {LocalizedText}
   * @private
   */
  _raiseAuditConditionCommentEvent(sourceName, eventId, comment) {
    assert(eventId == null || eventId instanceof Buffer);
    assert(comment instanceof LocalizedText);
    const server = this.addressSpace.rootFolder.objects.server;

    const now = new Date();

      // xx if (true || server.isAuditing) {
          // ----------------------------------------------------------------------------------------------------------------
    server.raiseEvent("AuditConditionCommentEventType", {
              // AuditEventType
              /* part 5 -  6.4.3 AuditEventType */
      actionTimeStamp:    { dataType: "DateTime", value: now },
      status:             { dataType: "Boolean", value: true },

      serverId:           { dataType: "String", value: "" },

              // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
      clientAuditEntryId: { dataType: "String", value: "" },

              // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
              // obtained from the UserIdentityToken passed in the ActivateSession call.
      clientUserId:       { dataType: "String", value: "" },
      sourceName:         { dataType: "String", value: sourceName },

              // AuditUpdateMethodEventType
      methodId: {},
      inputArguments: {},
              // AuditConditionCommentEventType
      eventId: { dataType: DataType.ByteString, value: eventId },
      comment: { dataType: DataType.LocalizedText, value: comment }
    });
      // xx }
  }

  /**
   * @method currentBranch
   * @returns {ConditionSnapshot}
   */
  currentBranch() {
    return this._branch0;
  }

  _resend_conditionEvents() {
      // for the time being , only current branch
    const self = this;
    const currentBranch = self.currentBranch();
    if (currentBranch.getRetain()) {
      debugLog(` resending condition event for ${self.browseName.toString()}`);

      self.raiseConditionEvent(currentBranch);
    }
  }

  static install_condition_refresh_handle(addressSpace) {
    const OPCUAServer = require("lib/server/OPCUAServer");
    console.log('opcuaserver', {OPCUAServer});
    
    assert(OPCUAServer != null);

      //
      // install CondititionRefresh
      //
      // NOTE:
      // OPCUA doesn't implement the condition refresh method ! yet
      // .5.7 ConditionRefresh Method
      // ConditionRefresh allows a Client to request a Refresh of all Condition instances that currently
      // are in an interesting state (they have the Retain flag set). This includes previous states of a
      // Condition instance for which the Server maintains Branches. A Client would typically invoke
      // this Method when it initially connects to a Server and following any situations, such as
      // communication disruptions, in which it would require resynchronization with the Server. This
      // Method is only available on the ConditionType or its subtypes. To invoke this Method, the call
      // shall pass the well known MethodId of the Method on the ConditionType and the ObjectId
      // shall be the well known ObjectId of the ConditionType Object.

    const conditionType = addressSpace.findEventType("ConditionType");
    assert(conditionType != null);

    conditionType.disable.bindMethod(_disable_method);
    conditionType.enable.bindMethod(_enable_method);

    conditionType.conditionRefresh.bindMethod(_condition_refresh_method);

    conditionType.conditionRefresh2.bindMethod(_condition_refresh2_method);

      // those methods can be call on the ConditionType or on the ConditionInstance itself...
    conditionType.addComment.bindMethod(_add_comment_method);
  }
}

UAConditionBase.prototype.nodeClass = NodeClass.Object;
UAConditionBase.typeDefinition = resolveNodeId("ConditionType");

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
    // xx console.log("_update_sourceTimestamp = "+self.nodeId.toString().cyan+ " " + self.browseName.toString(), self.sourceTimestamp.nodeId.toString().cyan + " " + dataValue.sourceTimestamp);
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
  assert(node.sourceTimestamp.browseName.toString() == "SourceTimestamp");
  node.on("value_changed", _update_sourceTimestamp);
}


import { BrowseDirection } from "lib/services/browse_service";



UAConditionBase.defaultSeverity = 250;

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
  if (b1.length != b2.length) {
    return false;
  }
/*
    var bb1 = (Buffer.from(b1)).toString("hex");
    var bb2 = (Buffer.from(b2)).toString("hex");
    return bb1 == bb2;
*/
  const n = b1.length;
  for (let i = 0; i < n; i++) {
    if (b1[i] != b2[i]) {
      return false;
    }
  }
  return true;
}


/**
 *
 * Helper method to handle condition methods that takes a branchId and a comment
 * @method with_condition_method$
 * @param inputArguments             {Array<Variant>}
 * @param context                    {Object}
 * @param context.object             {BaseNode}
 * @param callback                   {Function}
 * @param callback.err               {Error|null}
 * @param callback.result            {Object}
 * @param callback.result.statusCode {StatusCode}
 * @param inner_func                 {Function}
 * @param inner_func.eventId         {Buffer|null}
 * @param inner_func.comment         {LocalizedText}
 * @param inner_func.branch          {ConditionSnapshot}
 * @param inner_func.conditionNode   {UAConditionBase}
 *
 * @return {void}
 */
UAConditionBase.with_condition_method = (inputArguments, context, callback, inner_func) => {
  const conditionNode = context.object;

    // xx console.log(inputArguments.map(function(a){return a.toString()}));
  if (!(conditionNode instanceof UAConditionBase)) {
    callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
    return;
  }

  if (!conditionNode.getEnabledState()) {
    callback(null, { statusCode: StatusCodes.BadConditionDisabled });
    return;
  }

    // inputArguments has 2 arguments
    // EventId  => ByteString    The Identifier of the event to comment
    // Comment  => LocalizedText The Comment to add to the condition
  assert(inputArguments.length === 2);
  assert(inputArguments[0].dataType == DataType.ByteString);
  assert(inputArguments[1].dataType == DataType.LocalizedText);

  const eventId = inputArguments[0].value;
  assert(!eventId || eventId instanceof Buffer);

  const comment = inputArguments[1].value;
  assert(comment instanceof LocalizedText);

  const branch = conditionNode._findBranchForEventId(eventId);
  if (!branch) {
    callback(null, { statusCode: StatusCodes.BadEventIdUnknown });
    return;
  }
  assert(branch instanceof ConditionSnapshot);

  const statusCode = inner_func(eventId, comment, branch, conditionNode);

    // record also who did the call
  branch.setClientUserId(context.userIdentity || "<unknown client user id>");

  callback(null, { statusCode });
};

BaseNode.prototype._conditionRefresh = function (_cache) {
    // visit all notifiers recursively
  _cache = _cache || {};
  const self = this;
  const notifiers = self.getNotifiers();
  const eventSources = self.getEventSources();

  const conditions = this.findReferencesAsObject("HasCondition", true);
  let i;

  for (i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition instanceof UAConditionBase) {
      condition._resend_conditionEvents();
    }
  }
  const arr = [].concat(notifiers, eventSources);

  for (i = 0; i < arr.length; i++) {
    const notifier = arr[i];
    const key = notifier.nodeId.toString();
    if (!_cache[key]) {
      _cache[key] = notifier;
      if (notifier._conditionRefresh) {
        notifier._conditionRefresh(_cache);
      }
    }
  }
};


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


function _add_comment_method(inputArguments, context, callback) {
    //
    // The AddComment Method is used to apply a comment to a specific state of a Condition
    // instance. Normally, the NodeId of the object instance as the ObjectId is passed to the Call
    // Service. However, some Servers do not expose Condition instances in the AddressSpace.
    // Therefore all Servers shall also allow Clients to call the AddComment Method by specifying
    // ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the
    // ConditionType Node.
    // Signature
    //   - EventId EventId identifying a particular Event Notification where a state was reported for a
    //             Condition.
    //   - Comment A localized text to be applied to the Condition.
    //
    // AlwaysGeneratesEvent  AuditConditionCommentEventType
    //
  UAConditionBase.with_condition_method(inputArguments, context, callback, (eventId, comment, branch, conditionNode) => {
    assert(inputArguments instanceof Array);
    assert(eventId instanceof Buffer || eventId === null);
    assert(branch instanceof ConditionSnapshot);
    branch.setComment(comment);

    const sourceName = "Method/AddComment";

    conditionNode._raiseAuditConditionCommentEvent(sourceName, eventId, comment);

        // raise new event
    conditionNode.raiseConditionEvent(branch);

    return StatusCodes.Good;
  });
}


function _enable_method(inputArguments, context, callback) {
  assert(inputArguments.length === 0);
  const conditionNode = context.object;
  assert(conditionNode);

  if (!(conditionNode instanceof UAConditionBase)) {
    return callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
  }
  const statusCode = conditionNode._setEnabledState(true);
  return callback(null, { statusCode });
}

function _disable_method(inputArguments, context, callback) {
  assert(inputArguments.length === 0);

  const conditionNode = context.object;
  assert(conditionNode);

  if (!(conditionNode instanceof UAConditionBase)) {
    return callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
  }
  const statusCode = conditionNode._setEnabledState(false);
  return callback(null, { statusCode });
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
    // / todo: return StatusCodes.BadSubscriptionIdInvalid; if subscriptionId doesn't belong to session...
  return StatusCodes.Good;
}

function _condition_refresh_method(inputArguments, context, callback) {
    // arguments : IntegerId SubscriptionId
  assert(inputArguments.length == 1);

  const addressSpace = context.object.addressSpace;
  if (doDebug) {
    debugLog(" ConditionType.ConditionRefresh ! subscriptionId =".red.bgWhite, inputArguments[0].toString());
  }
  const subscriptionId = inputArguments[0].value;

  let statusCode = _check_subscription_id_is_valid(subscriptionId, context);
  if (statusCode != StatusCodes.Good) {
    return statusCode;
  }

  statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
  return callback(null, { statusCode });
}

function _condition_refresh2_method(inputArguments, context, callback) {
    // arguments : IntegerId SubscriptionId
    // arguments : IntegerId MonitoredItemId
  assert(inputArguments.length == 2);

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
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i];

        // istanbul ignore next
    if (!cur.hasOwnProperty(e)) {
      throw new Error(` cannot extract '${key}' from ${node.browseName.toString()}`);
    }

    cur = cur[e];
  }
  return cur;
}


/**
 * instantiate a Condition.
 * this will create the unique EventId and will set eventType
 * @method instantiate
 * @param addressSpace
 * @param conditionTypeId          {String|NodeId}  the EventType to instantiate
 * @param options                  {object}
 * @param options.browseName       {String|QualifiedName}
 * @param options.componentOf      {NodeId|UAObject}
 * @param options.conditionOf      {NodeId|UAObject} Mandatory
 * @param options.organizedBy      {NodeId|UAObject} ( only provide componentOf or organizedBy but not both)
 * @param options.conditionClassId {NodeId|UAObject}
 * @param options.conditionSource  {NodeId|UAObject} the condition source node.
 *                                                   this node must be marked a EventSource.
 *                                                   the conditionSource is used to populate the sourceNode and
 *                                                   sourceName variables defined by BaseEventType
 * @param [options.optionals]      [Array<String>]   an Array of optinals fields
 *
 * @param data         {object}         a object containing the value to set
 * @param data.eventId {String|NodeId}  the EventType Identifier to instantiate (type cannot be abstract)
 * @return node        {UAConditionBase}
 */
UAConditionBase.instantiate = (addressSpace, conditionTypeId, options, data) => {
  TimeZone = TimeZone || require("lib/datamodel/time_zone").TimeZone;

  const conditionType = addressSpace.findEventType(conditionTypeId);

    /* istanbul ignore next */
  if (!conditionType) {
    throw new Error(` cannot find Condition Type for ${conditionTypeId}`);
  }

    // reminder : abstract event type cannot be instantiated directly !
  assert(!conditionType.isAbstract);

  const baseConditionEventType = addressSpace.findEventType("ConditionType");
    /* istanbul ignore next */
  if (!baseConditionEventType) {
    throw new Error("cannot find  ConditionType");
  }

  assert(conditionType.isSupertypeOf(baseConditionEventType));

    // assert(_.isString(options.browseName));
  options.browseName = options.browseName || "??? instantiateCondition - missing browseName";

  options.optionals = options.optionals || [];

    //
  options.optionals.push("Comment.SourceTimestamp");
  options.optionals.push("EnabledState.TrueState");
  options.optionals.push("EnabledState.TrueState");
  options.optionals.push("EnabledState.FalseState");

  options.optionals.push("EnabledState.TransitionTime");
  options.optionals.push("EnabledState.EffectiveTransitionTime");
  options.optionals.push("EnabledState.EffectiveDisplayName");

  const conditionNode = conditionType.instantiate(options);
  Object.setPrototypeOf(conditionNode, UAConditionBase.prototype);
  conditionNode.initialize();

  assert(options.hasOwnProperty("conditionSource"), "must specify a condition source either as null or as a UAObject");
  if (!options.conditionOf) {
    options.conditionOf = options.conditionSource;
  }
  if (options.conditionOf) {
    assert(options.hasOwnProperty("conditionOf")); // must provide a conditionOf
    options.conditionOf = addressSpace._coerceNode(options.conditionOf);

        // HasCondition References can be used in the Type definition of an Object or a Variable.
    assert(options.conditionOf instanceof UAObject || options.conditionOf instanceof UAVariable);

    conditionNode.addReference({ referenceType: "HasCondition", isForward: false, nodeId: options.conditionOf });
    assert(conditionNode.conditionOfNode().nodeId == options.conditionOf.nodeId);
  }


    /**
     * @property eventType
     * @type {UAVariableType}
     *
     * dataType is DataType.NodeId
     */
    // the constant property of this condition
  conditionNode.eventType.setValueFromSource({ dataType: DataType.NodeId, value: conditionType.nodeId });

  data = data || {};
    // install initial branch ID (null NodeId);
    /**
     * @property branchId
     * @type {UAVariableType}
     *
     * dataType is DataType.NodeId
     */
  conditionNode.branchId.setValueFromSource({ dataType: DataType.NodeId, value: NodeId.NullNodeId });

    // install 'Comment' condition variable
    /**
     * @property comment
     * @type {UAVariableType}
     *
     * dataType is DataType.LocalizedText
     */
  _install_condition_variable_type(conditionNode.comment);


    // install 'Quality' condition variable
    /**
     * @property quality
     * @type {UAVariableType}
     *
     * dataType is DataType.StatusCode
     */
  _install_condition_variable_type(conditionNode.quality);
    // xx conditionNode.quality.setValueFromSource({dataType: DataType.StatusCode,value: StatusCodes.Good });

    // install 'LastSeverity' condition variable
    /**
     * @property lastSeverity
     * @type {UAVariableType}
     *
     * dataType is DataType.StatusCode
     */
  _install_condition_variable_type(conditionNode.lastSeverity);
    // xx conditionNode.severity.setValueFromSource({dataType: DataType.UInt16,value: 0 });
    // xx conditionNode.lastSeverity.setValueFromSource({dataType: DataType.UInt16,value: 0 });


    // install  'EnabledState' TwoStateVariable
    /**
     *  @property enabledState
     *  @type {UATwoStateVariable}
     */
    // -------------- fixing missing EnabledState.EffectiveDisplayName
  if (!conditionNode.enabledState.effectiveDisplayName) {
    addressSpace.addVariable({
      browseName: "EffectiveDisplayName",
      dataType: "LocalizedText",
      propertyOf: conditionNode.enabledState
    });
  }
  AddressSpace._install_TwoStateVariable_machinery(conditionNode.enabledState,{
    trueState: "Enabled",
    falseState: "Disabled"
  });
  assert(conditionNode.enabledState._trueState == "Enabled");
  assert(conditionNode.enabledState._falseState == "Disabled");

    // installing sourceName and sourceNode
  conditionNode.enabledState.setValue(true);

    // set properties to in initial values
  Object.keys(data).forEach((key) => {
    const varNode = _getCompositeKey(conditionNode, key);
    assert(varNode instanceof UAVariable);

    const variant = new Variant(data[key]);

        // check that Variant DataType is compatible with the UAVariable dataType
    const nodeDataType = addressSpace.findNode(varNode.dataType).browseName;

        /* istanbul ignore next */
    if (!varNode._validate_DataType(variant.dataType)) {
      throw new Error(` Invalid variant dataType ${variant} ${varNode.browseName.toString()}`);
    }

    const value = new Variant(data[key]);

    varNode.setValueFromSource(value);
  });

    // bind condition methods -
    /**
     *  @property enable
     *  @type {UAMethod}
     */
  conditionNode.enable.bindMethod(_enable_method);

    /**
     *  @property disable
     *  @type {UAMethod}
     */
  conditionNode.disable.bindMethod(_disable_method);

    // bind condition methods - AddComment
    /**
     *  @property addComment
     *  @type {UAMethod}
     */
  conditionNode.addComment.bindMethod(_add_comment_method);

  assert(conditionNode instanceof UAConditionBase);

    // ConditionSource => cf SourceNode
    //  As per spec OPCUA 1.03 part 9 page 54:
    //    The ConditionType inherits all Properties of the BaseEventType. Their semantic is defined in
    //    Part 5. SourceNode identifies the ConditionSource.
    //    The SourceNode is the Node which the condition is associated with, it may be the same as the
    //    InputNode for an alarm, but it may be a separate node. For example a motor, which is a
    //    variable with a value that is an RPM, may be the ConditionSource for Conditions that are
    //    related to the motor as well as a temperature sensor associated with the motor. In the former
    //    the InputNode for the High RPM alarm is the value of the Motor RPM, while in the later the
    //    InputNode of the High Alarm would be the value of the temperature sensor that is associated
    //    with the motor.
    /**
     * @property sourceNode
     * @type {UAVariableType}
     *
     * dataType is DataType.NodeId
     */

  if (options.conditionSource != null) {
    options.conditionSource = addressSpace._coerceNode(options.conditionSource);
    assert(options.conditionSource instanceof BaseNode);

    const conditionSourceNode = addressSpace.findNode(options.conditionSource.nodeId);

    conditionNode.sourceNode.setValueFromSource({ dataType: DataType.NodeId, value: conditionSourceNode.nodeId });

        // conditionSourceNode node must be registered as a EventSource of an other node.
        // As per spec OPCUA 1.03 part 9 page 54:
        //   HasNotifier and HasEventSource References are used to expose the hierarchical organization
        //   of Event notifying Objects and ConditionSources. An Event notifying Object represents
        //   typically an area of Operator responsibility.  The definition of such an area configuration is
        //   outside the scope of this standard. If areas are available they shall be linked together and
        //   with the included ConditionSources using the HasNotifier and the HasEventSource Reference
        //   Types. The Server Object shall be the root of this hierarchy.
    assert(conditionSourceNode.getEventSourceOfs().length >= 1, "conditionSourceNode must be an event source");

        // set source Node (defined in UABaseEventType)
    conditionNode.sourceNode.setValueFromSource(conditionSourceNode.readAttribute(AttributeIds.NodeId).value);

        // set source Name (defined in UABaseEventType)
    conditionNode.sourceName.setValueFromSource(conditionSourceNode.readAttribute(AttributeIds.DisplayName).value);
  }

  conditionNode.eventType.setValueFromSource({ dataType: DataType.NodeId, value: conditionType.nodeId });
    // as per spec:

    /**
     *  @property conditionName
     *  @type {UAVariable}
     *
     *  dataType: DataType.NodeId
     *
     *  As per spec OPCUA 1.03 part 9:
     *    ConditionClassId specifies in which domain this Condition is used. It is the NodeId of the
     *    corresponding ConditionClassType. See 5.9 for the definition of ConditionClass and a set of
     *    ConditionClasses defined in this standard. When using this Property for filtering, Clients have
     *    to specify all individual ConditionClassType NodeIds. The OfType operator cannot be applied.
     *    BaseConditionClassType is used as class whenever a Condition cannot be assigned to a
     *    more concrete class.
     */
  conditionNode.conditionClassId.setValueFromSource({ dataType: DataType.NodeId, value: NodeId.NullNodeId });

    // as per spec:
    //  ConditionClassName provides the display name of the ConditionClassType.
  conditionNode.conditionClassName.setValueFromSource({
    dataType: DataType.LocalizedText,
    value: coerceLocalizedText("Test")
  });


    // as per spec:
    /**
     * @property conditionName
     * @type {UAVariable}
     *
     * dataType: DataType.String
     *
     * As per spec OPCUA 1.03 part 9:
     *   ConditionName identifies the Condition instance that the Event originated from. It can be used
     *   together with the SourceName in a user display to distinguish between different Condition
     *   instances. If a ConditionSource has only one instance of a ConditionType, and the Server has
     *   no instance name, the Server shall supply the ConditionType browse name.
     */
  conditionNode.conditionName.setValueFromSource({ dataType: DataType.String, value: "Test" });


    // set SourceNode and SourceName based on HasCondition node
  const sourceNodes = conditionNode.findReferencesAsObject("HasCondition", false);
  if (sourceNodes.length) {
    assert(sourceNodes.length == 1);
    conditionNode.setSourceNode(sourceNodes[0].nodeId);
    conditionNode.setSourceName(sourceNodes[0].browseName.toString());
  }

  conditionNode.post_initialize();

  const branch0 = conditionNode.currentBranch();
  branch0.setRetain(false);
  branch0.setComment("Initialized");
  branch0.setQuality(StatusCodes.Good);
  branch0.setSeverity(0);
  branch0.setLocalTime(new TimeZone({ offset: 0, daylightSavingInOffset: false }));
  branch0.setMessage(" ");

  branch0.setReceiveTime(minDate);
  branch0.setTime(minDate);

    // UAConditionBase
  return conditionNode;
};


/*
 As per spec OPCUA 1.03 part 9:

 A Condition’s EnabledState effects the generation of Event Notifications and as such results
 in the following specific behaviour:
 * When the Condition instance enters the Disabled state, the Retain Property of this
 Condition shall be set to FALSE by the Server to indicate to the Client that the
 Condition instance is currently not of interest to Clients.
 * When the Condition instance enters the enabled state, the Condition shall be
 evaluated and all of its Properties updated to reflect the current values. If this
 evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
 then an Event Notification shall be generated for that ConditionBranch.
 * The Server may choose to continue to test for a Condition instance while it is
 Disabled. However, no Event Notifications will be generated while the Condition
 instance is disabled.
 * For any Condition that exists in the AddressSpace the Attributes and the following
 Variables will continue to have valid values even in the Disabled state; EventId, Event
 Type, Source Node, Source Name, Time, and EnabledState.
 Other properties may no longer provide current valid values.
 All Variables that are no longer provided shall return a status of Bad_ConditionDisabled.
 The Event that reports the Disabled state  should report the properties as NULL or with a status
 of Bad_ConditionDisabled.
 When enabled, changes to the following components shall cause a ConditionType Event Notification:
 - Quality
 - Severity (inherited from BaseEventType)
 - Comment

 // spec :
 // The HasCondition ReferenceType is a concrete ReferenceType and can be used directly. It is
 // a subtype of NonHierarchicalReferences.
 // The semantic of this ReferenceType is to specify the relationship between a ConditionSource
 // and its Conditions. Each ConditionSource shall be the target of a HasEventSource Reference
 // or a sub type of HasEventSource. The AddressSpace organisation that shall be provided for
 // Clients to detect Conditions and ConditionSources is defined in Clause 6. Various examples
 // for the use of this ReferenceType can be found in B.2.
 // HasCondition References can be used in the Type definition of an Object or a Variable. In this
 // case, the SourceNode of this ReferenceType shall be an ObjectType or VariableType Node or
 // one of their InstanceDeclaration Nodes. The TargetNode shall be a Condition instance
 // declaration or a ConditionType. The following rules for instantiation apply:
 //  All HasCondition References used in a Type shall exist in instances of these Types as
 //    well.
 //  If the TargetNode in the Type definition is a ConditionType, the same TargetNode will
 //    be referenced on the instance.
 // HasCondition References may be used solely in the instance space when they are not
 // available in Type definitions. In this case the SourceNode of this ReferenceType shall be an
 // Object, Variable or Method Node. The TargetNode shall be a Condition instance or a
 // ConditionType.

 */
export default UAConditionBase;
