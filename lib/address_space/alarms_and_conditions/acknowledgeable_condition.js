"use strict";

/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var UAObject = require("lib/address_space/ua_object").UAObject;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;


var util = require("util");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var UATwoStateVariable = require("lib/address_space/ua_two_state_variable").UATwoStateVariable;
assert(UATwoStateVariable);
var conditions =require("./condition");
var UAConditionBase = conditions.UAConditionBase;
var ConditionSnapshot = conditions.ConditionSnapshot;

function _getValueAsBoolean(node) {
    assert(!node.id);
    return !!node.readValue().value.value;
}

var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

/**
 * @class ConditionSnapshot
 * @param varName
 * @param value
 * @private
 */
ConditionSnapshot.prototype._set_twoStateVariable = function(varName,value) {

    value = !!value;
    var self = this;

    var hrKey = ConditionSnapshot.normalizeName(varName);
    var idKey = ConditionSnapshot.normalizeName(varName)+".id";

    var variant = new Variant({ dataType: DataType.Boolean , value: value});
    self._map[idKey] = variant;

    // also change varName with human readable text
    var twoStateNode = self._node_index[hrKey];
    assert(twoStateNode);
    assert(twoStateNode instanceof UATwoStateVariable);

    var txt = value ? twoStateNode._trueState : twoStateNode._falseState;

    var hrValue = new Variant({
        dataType: DataType.LocalizedText,
        value:  coerceLocalizedText(txt)
    });
    self._map[hrKey] = hrValue;

    var node = self._node_index[idKey];
    self.emit("valueChanged",node,variant);

};

ConditionSnapshot.prototype._get_twoStateVariable = function(varName) {
    var self = this;
    var key = ConditionSnapshot.normalizeName(varName)+".id";
    var variant = self._map[key];
    return variant.value;
};

var _setAckedState = function(self, requestedAckedState,eventId,comment) {

    assert(self instanceof ConditionSnapshot);

    var ackedState = self.getAckedState();

    if (ackedState && requestedAckedState) {
        return StatusCodes.BadConditionBranchAlreadyAcked;
    }
    self._set_twoStateVariable("ackedState",requestedAckedState);
    return StatusCodes.Good;
};

ConditionSnapshot.prototype.getAckedState = function()
{
    var self = this;
    if (!self.condition.ackedState) {
        var condition = self.condition;
        throw new Error("Node "+ condition.browseName.toString()+
            " of type "+ condition.typeDefinitionObj.browseName.toString()+
            " has no AckedState");
    }
    return self._get_twoStateVariable("ackedState");
};

ConditionSnapshot.prototype.setAckedState = function(ackedState) {
    ackedState = !!ackedState;
    var self = this;
    var oldAckedState = self.getAckedState();
    _setAckedState(self, ackedState);
    if (!oldAckedState && ackedState) {
        // need to set unconfirmed
        self.setConfirmedState(false);
    }
};

ConditionSnapshot.prototype.getConfirmedState = function()
{
    var self = this;
    assert(self.condition.confirmedState,"Must have a confirmed state");
    return self._get_twoStateVariable("confirmedState");
};

ConditionSnapshot.prototype.setConfirmedState = function(confirmedState) {
    confirmedState = !!confirmedState;
    var self = this;
    assert(self.condition.confirmedState,"Must have a confirmed state");
    // todo deal with Error code BadConditionBranchAlreadyConfirmed
    self._set_twoStateVariable("confirmedState",confirmedState);
};

/**
 * @class UAAcknowledgeableConditionBase
 * @constructor
 * @extends UAConditionBase
 */
function UAAcknowledgeableConditionBase() {

}
util.inherits(UAAcknowledgeableConditionBase,UAConditionBase);


UAAcknowledgeableConditionBase.prototype._populate_EventData = function(eventData) {
    var self = this;
    UAConditionBase.prototype._populate_EventData.call(self,eventData);
    self._populate_EventData_with_AcknowledgeableConditionTypeElements(eventData);
};

UAAcknowledgeableConditionBase.prototype._populate_EventData_with_AcknowledgeableConditionTypeElements = function(eventData) {
    var self = this;
    var data = {
        // -----------------------------------------------------------
        // AcknowledgeableConditionType
        // -----------------------------------------------------------
        ackedState:     self.ackedState.readValue().value,
        confirmedState: self.confirmedState.readValue().value
    };
    eventData= _.extend(eventData,data);
};




/**
 * @method raiseNewCondition
 * @param conditionInfo {ConditionInfo}
 */
UAAcknowledgeableConditionBase.prototype.raiseNewCondition = function(conditionInfo) {

    var self = this;
    var selfConditionType = self.typeDefinitionObj;

    var acknowledgeableConditionType = self.addressSpace.findObjectType("AcknowledgeableConditionType");
    assert(selfConditionType.isSupertypeOf(acknowledgeableConditionType));
    var isAcknowledgeable = selfConditionType.isSupertypeOf(acknowledgeableConditionType);

    if (isAcknowledgeable) {
        self.currentBranch().setAckedState(false);

        // be careful ! confirmedState is optional
        if (self.confirmedState) {
            self.currentBranch().setConfirmedState(false);
        }
    }

    UAConditionBase.prototype.raiseNewCondition.call(self,conditionInfo);

};



UAAcknowledgeableConditionBase.prototype._raiseAuditConditionConfirmEvent = function() {

    var branch = this;

    // raise the AuditConditionConfirmEventType
    var eventData = {

        // EventType
        eventId: branch.eventId.readValue().value,
        //xx branchId: branch.branchId.readValue().value,
        // AuditEventType
        actionTimeStamp: { dataType: DataType.DateTime, value : new Date() },
        status: { dataType: DataType.StatusCodes, value: StatusCodes.Good },
        serverId: {},
        clientAuditEntryId: {},
        clientUserId: {},
        methodId: {},
        inputArguments: {},
        comment:  branch.comment.readValue().value
    };
    branch.raiseEvent("AuditConditionConfirmEventType",eventData);

};

/**
 * @method activateAlarm
 */
UAAcknowledgeableConditionBase.prototype.activateAlarm = function() {
    // will set acknowledgeable to false and retain to true
    var self = this;
    var branch = self.currentBranch();
    branch.setRetain(true);
    branch.setAckedState(false);
};

/**
 * @method desactivateAlarm
 */
UAAcknowledgeableConditionBase.prototype.desactivateAlarm = function() {
    var self = this;
    // todo
};




function _acknwoledge_method(inputArguments,context,callback) {

    UAConditionBase.with_condition_method(inputArguments, context, callback,function(eventId,comment,branch,conditionNode) {

        // precondition checking
        assert(!eventId || eventId instanceof Buffer,"must have a valid eventId or  null");
        assert(comment instanceof LocalizedText, "expecting a comment as LocalizedText");
        assert(conditionNode instanceof UAAcknowledgeableConditionBase);


        branch.setConfirmedState(false);
        var statusCode = _setAckedState(branch,true,eventId,comment);
        if (statusCode != StatusCodes.Good) {
            return statusCode;
        }


        branch.setComment(comment);
        conditionNode._raiseAuditConditionCommentEvent("Method/Acknowledge",eventId,comment);

        /**
         * @event acknowledged
         * @param  eventId   {Buffer|null}
         * @param  comment   {LocalizedText}
         * @param  branch    {ConditionSnapshot}
         * raised when the alarm branch has been acknowledged
         */
        conditionNode.emit("acknowledged",eventId,comment,branch);

        return StatusCodes.Good;
    });
}

/**
 *
 * StatusCodes :
 *
 * @param inputArguments
 * @param context
 * @param callback
 * @private
 */
function _confirm_method(inputArguments,context,callback) {

    UAConditionBase.with_condition_method(inputArguments, context, callback,function(eventId,comment,branch,conditionNode) {

        if (branch.getConfirmedState()) {
            return  StatusCodes.BadConditionBranchAlreadyConfirmed;
        }
        branch.setConfirmedState(true);
        branch.setRetain(false);

        branch.setComment(comment);

        conditionNode._raiseAuditConditionCommentEvent("Method/Confirm",eventId,comment);
        conditionNode._raiseAuditConditionConfirmEvent();

        /**
         * @event confirmed
         * @param  eventId
         * @param  comment
         * @param  eventId
         * raised when the alarm branch has been confirmed
         */
        conditionNode.emit("confirmed",eventId,comment,branch);

        return StatusCodes.Good;
    });
}

exports.UAAcknowledgeableConditionBase = UAAcknowledgeableConditionBase;

/**
 * @method (static)UAAcknowledgeableConditionBase.instantiate
 * @param addressSpace    {AddressSpace}
 * @param conditionTypeId {String|NodeId}
 * @param options
 * @param data
 * @return {UAAcknowledgeableConditionBase}
 */
UAAcknowledgeableConditionBase.instantiate = function (addressSpace,conditionTypeId, options,data ) {

    //xx assert(options.conditionOf,"must provide a conditionOf Node");

    var conditionNode = UAConditionBase.instantiate(addressSpace, conditionTypeId, options, data);
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
    conditionNode.acknowledge.bindMethod(_acknwoledge_method);

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
