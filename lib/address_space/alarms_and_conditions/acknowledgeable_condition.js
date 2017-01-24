/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);

import assert from "better-assert";
import _ from "underscore";
import { UAVariable } from "lib/address_space/ua_variable";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { UAObjectType } from "lib/address_space/ua_object_type";
import { UAObject } from "lib/address_space/ua_object";
import { AttributeIds } from "lib/datamodel/attributeIds";
import { LocalizedText } from "lib/datamodel/localized_text";
import util from "util";
import { NodeClass } from "lib/datamodel/nodeclass";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { NodeId } from "lib/datamodel/nodeid";
import { AddressSpace } from "lib/address_space/address_space";
import { UATwoStateVariable } from "lib/address_space/ua_two_state_variable";
import { 
  UAConditionBase,
  ConditionSnapshot
} from "./condition";
import { coerceLocalizedText } from "lib/datamodel/localized_text";

assert(UATwoStateVariable);

function _getValueAsBoolean(node) {
  assert(!node.id);
  return !!node.readValue().value.value;
}


ConditionSnapshot.prototype.isCurrentBranch = function () {
  return this._get_var("branchId") === NodeId.NullNodeId;
};
/**
 * @class ConditionSnapshot
 * @param varName
 * @param value
 * @private
 */
ConditionSnapshot.prototype._set_twoStateVariable = function (varName,value) {
  value = !!value;
  const self = this;

  const hrKey = ConditionSnapshot.normalizeName(varName);
  const idKey = `${ConditionSnapshot.normalizeName(varName)}.id`;

  const variant = new Variant({ dataType: DataType.Boolean , value });
  self._map[idKey] = variant;

    // also change varName with human readable text
  const twoStateNode = self._node_index[hrKey];
  assert(twoStateNode);
  assert(twoStateNode instanceof UATwoStateVariable);

  const txt = value ? twoStateNode._trueState : twoStateNode._falseState;

  const hrValue = new Variant({
    dataType: DataType.LocalizedText,
    value:  coerceLocalizedText(txt)
  });
  self._map[hrKey] = hrValue;

  const node = self._node_index[idKey];

    // also change ConditionNode if we are on currentBranch
  if (self.isCurrentBranch()) {
    assert(twoStateNode instanceof UATwoStateVariable);
    twoStateNode.setValue(value);
        // xx console.log("Is current branch", twoStateNode.toString(),variant.toString());
        // xx console.log("  = ",twoStateNode.getValue());
  }
  self.emit("value_changed",node,variant);
};

ConditionSnapshot.prototype._get_twoStateVariable = function (varName) {
  const self = this;
  const key = `${ConditionSnapshot.normalizeName(varName)}.id`;
  const variant = self._map[key];

    // istanbul ignore next
  if (!variant) {
    throw new Error(`Cannot find TwoStateVariable with name ${varName}`);
  }
  return variant.value;
};

const _setAckedState = (self, requestedAckedState, eventId, comment) => {
  assert(self instanceof ConditionSnapshot);

  const ackedState = self.getAckedState();

  if (ackedState && requestedAckedState) {
    return StatusCodes.BadConditionBranchAlreadyAcked;
  }
  self._set_twoStateVariable("ackedState",requestedAckedState);
  return StatusCodes.Good;
};

ConditionSnapshot.prototype.getAckedState = function () {
  const self = this;
  if (!self.condition.ackedState) {
    const condition = self.condition;
    throw new Error(`Node ${condition.browseName.toString()} of type ${condition.typeDefinitionObj.browseName.toString()} has no AckedState`);
  }
  return self._get_twoStateVariable("ackedState");
};

ConditionSnapshot.prototype.setAckedState = function (ackedState) {
  ackedState = !!ackedState;
  const self = this;
    // xx var oldAckedState = self.getAckedState();
  _setAckedState(self, ackedState);
    // xx if (!oldAckedState && ackedState) {
    // xx     // need to set unconfirmed
    // xx     self.setConfirmedState(false);
    // xx }
};

ConditionSnapshot.prototype.getConfirmedState = function () {
  const self = this;
  assert(self.condition.confirmedState,"Must have a confirmed state");
  return self._get_twoStateVariable("confirmedState");
};

ConditionSnapshot.prototype.setConfirmedState = function (confirmedState) {
  confirmedState = !!confirmedState;
  const self = this;
  assert(self.condition.confirmedState,"Must have a confirmed state.  Add ConfirmedState to the optionals");
    // todo deal with Error code BadConditionBranchAlreadyConfirmed
  self._set_twoStateVariable("confirmedState",confirmedState);
};

/**
 * @class UAAcknowledgeableConditionBase
 * @constructor
 * @extends UAConditionBase
 */
class UAAcknowledgeableConditionBase extends UAConditionBase {
  _populate_EventData(eventData) {
    const self = this;
    UAConditionBase.prototype._populate_EventData.call(self,eventData);
    self._populate_EventData_with_AcknowledgeableConditionTypeElements(eventData);
  }

  _populate_EventData_with_AcknowledgeableConditionTypeElements(eventData) {
    const self = this;
    const data = {
          // -----------------------------------------------------------
          // AcknowledgeableConditionType
          // -----------------------------------------------------------
      ackedState:     self.ackedState.readValue().value,
      confirmedState: self.confirmedState.readValue().value
    };
    eventData = _.extend(eventData,data);
  }

  _raiseAuditConditionAcknowledgeEvent(branch) {
      // raise the AuditConditionAcknowledgeEventType
    const eventData = {

          // EventType
      eventId:  { dataType: DataType.ByteString, value: branch.getEventId() },
          // xx branchId: branch.branchId.readValue().value,
          // AuditEventType
      actionTimeStamp: { dataType: DataType.DateTime, value : new Date() },
      status: { dataType: DataType.StatusCodes, value: StatusCodes.Good },
      serverId: {},
      clientAuditEntryId: {},
      clientUserId: {},
      methodId: {},
      inputArguments: {},
      comment:   { dataType: DataType.LocalizedText, value: branch.getComment() }
    };
    this.raiseEvent("AuditConditionAcknowledgeEventType",eventData);
  }

  _raiseAuditConditionConfirmEvent(branch) {
      // raise the AuditConditionConfirmEventType
    const eventData = {

          // EventType
      eventId:  { dataType: DataType.ByteString, value: branch.getEventId() },
          // xx branchId: branch.branchId.readValue().value,
          // AuditEventType
      actionTimeStamp: { dataType: DataType.DateTime, value : new Date() },
      status: { dataType: DataType.StatusCodes, value: StatusCodes.Good },
      serverId: {},
      clientAuditEntryId: {},
      clientUserId: {},
      methodId: {},
      inputArguments: {},
      comment:   { dataType: DataType.LocalizedText, value: branch.getComment() }
    };
    this.raiseEvent("AuditConditionConfirmEventType",eventData);
  }

  _acknowledge_branch(eventId, comment, branch, message) {
    assert(typeof (message) === "string");

    const conditionNode = this;

    if (conditionNode.confirmedState) {
          // alarm has a confirmed state !
          // we should be waiting for confirmation now
      branch.setConfirmedState(false);
      branch.setRetain(true);
    } else {
      branch.setRetain(false);
    }

    const statusCode = _setAckedState(branch,true,eventId,comment);
    if (statusCode != StatusCodes.Good) {
      return statusCode;
    }

    branch.setComment(comment);

    conditionNode.raiseNewBranchState(branch);

      // xx conditionNode._raiseAuditConditionCommentEvent("Method/Acknowledge",eventId,comment);
    conditionNode._raiseAuditConditionAcknowledgeEvent(branch);


      /**
       * @event acknowledged
       * @param  eventId   {Buffer|null}
       * @param  comment   {LocalizedText}
       * @param  branch    {ConditionSnapshot}
       * raised when the alarm branch has been acknowledged
       */
    conditionNode.emit("acknowledged",eventId,comment,branch);
  }

  /**
   * @method _confirm_branch
   * @param eventId
   * @param comment
   * @param branch
   * @param message
   * @private
   */
  _confirm_branch(eventId, comment, branch, message) {
    assert(typeof (message) === "string");
    assert(comment instanceof LocalizedText);

    const conditionNode = this;
    var eventId = branch.getEventId();
    assert(branch.getEventId().toString("hex") === eventId.toString("hex"));
    branch.setConfirmedState(true);
    branch.setRetain(false);

    branch.setComment(comment);

    conditionNode._raiseAuditConditionCommentEvent(message,eventId,comment);
    conditionNode._raiseAuditConditionConfirmEvent(branch);

    conditionNode.raiseNewBranchState(branch);

      /**
       * @event confirmed
       * @param  eventId
       * @param  comment
       * @param  eventId
       * raised when the alarm branch has been confirmed
       */
    conditionNode.emit("confirmed",eventId,comment,branch);
  }

  /**
   * @method autoConfirmBranch
   * @param branch
   * @param comment
   */
  autoConfirmBranch(branch, comment) {
    assert(branch instanceof ConditionSnapshot);
    assert(!branch.getConfirmedState(),"already confirmed ?");
    const conditionNode = this;
    const eventId = branch.getEventId();
    console.log("autoConfirmBranch getAckedState ",branch.getAckedState());
    conditionNode._confirm_branch(eventId,comment,branch,"Server/Confirm");
  }

  /**
   * @method acknowledgeAndAutoConfirmBranch
   * @param branch
   * @param comment
   */
  acknowledgeAndAutoConfirmBranch(branch, comment) {
    comment = LocalizedText.coerce(comment);
    const eventId = branch.getEventId();
    branch.setRetain(false);
    this._acknowledge_branch(eventId,comment,branch,"Server/Acknowledge");
    this.autoConfirmBranch(branch,comment);
  }

  static install_method_handle_on_type(addressSpace) {
    const OPCUAServer = require("lib/server/opcua_server").OPCUAServer;
    assert(OPCUAServer != null);

    const acknowledgeableConditionType = addressSpace.findEventType("AcknowledgeableConditionType");
    assert(acknowledgeableConditionType != null);
    acknowledgeableConditionType.acknowledge.bindMethod(_acknowledge_method);
    acknowledgeableConditionType.confirm.bindMethod(_confirm_method);
  }
}


function _acknowledge_method(inputArguments,context,callback) {
  UAConditionBase.with_condition_method(inputArguments, context, callback,(eventId, comment, branch, conditionNode) => {
        // precondition checking
    assert(!eventId || eventId instanceof Buffer,"must have a valid eventId or  null");
    assert(comment instanceof LocalizedText, "expecting a comment as LocalizedText");
    assert(conditionNode instanceof UAAcknowledgeableConditionBase);
    conditionNode._acknowledge_branch(eventId,comment,branch,"Method/Acknowledged");
    return StatusCodes.Good;
  });
}

/**
 *
 * StatusCodes :
 *
 * @param inputArguments {Variant[]}
 * @param context        {Object}
 * @param callback       {Function}
 * @private
 */
function _confirm_method(inputArguments,context,callback) {
  UAConditionBase.with_condition_method(inputArguments, context, callback,(eventId, comment, branch, conditionNode) => {
    assert(eventId instanceof Buffer);
    assert(branch.getEventId()  instanceof Buffer);
    assert(branch.getEventId().toString("hex") === eventId.toString("hex"));

    if (branch.getConfirmedState()) {
      return  StatusCodes.BadConditionBranchAlreadyConfirmed;
    }
    conditionNode._confirm_branch(eventId,comment,branch,"Method/Confirm");
    return StatusCodes.Good;
  });
}


/**
 * @method (static)UAAcknowledgeableConditionBase.instantiate
 * @param addressSpace    {AddressSpace}
 * @param conditionTypeId {String|NodeId}
 * @param options
 * @param data
 * @return {UAAcknowledgeableConditionBase}
 */
UAAcknowledgeableConditionBase.instantiate = (addressSpace, conditionTypeId, options, data) => {
    // xx assert(options.conditionOf,"must provide a conditionOf Node");

  const conditionNode = UAConditionBase.instantiate(addressSpace, conditionTypeId, options, data);
  Object.setPrototypeOf(conditionNode,UAAcknowledgeableConditionBase.prototype);

    // ----------------------- Install Acknowledge-able Condition stuff
    // install ackedState - Mandatory
    /**
     * @property ackedState
     * @type TwoStateVariable
     */
  AddressSpace._install_TwoStateVariable_machinery(conditionNode.ackedState,{
    trueState: "Acknowledged",
    falseState: "Unacknowledged"
  });

    /**
     * @property acknowledge
     * @type UAMethod
     */
  conditionNode.acknowledge.bindMethod(_acknowledge_method);

    // install confirmedState - Optional
    /**
     * @property confirmedState
     * @type TwoStateVariable
     */
  if (conditionNode.confirmedState) {
    AddressSpace._install_TwoStateVariable_machinery(conditionNode.confirmedState,{
      trueState: "Confirmed",
      falseState: "Unconfirmed"
    });
  }

    // install confirm Method - Optional
    /**
     * @property confirm
     * @type UAMethod
     */
  if (conditionNode.confirm) {
    conditionNode.confirm.bindMethod(_confirm_method);
  }
  assert(conditionNode instanceof UAAcknowledgeableConditionBase);
  return conditionNode;
};
export { UAAcknowledgeableConditionBase };
