"use strict";

/**
 * @module opcua.address_space
 * @class AddressSpace
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

var conditions =require("./condition");
var UAConditionBase = conditions.UAConditionBase;
var ConditionSnapshot = conditions.ConditionSnapshot;

function _getValueAsBoolean(node) {
    assert(!node.id);
    return !!node.readValue().value.value;
}

var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

ConditionSnapshot.prototype._set_twoStateVariable = function(varName,value) {

    value = !!value;
    var self = this;

    var hrKey = varName.toLowerCase();
    var idKey = varName.toLowerCase()+".id";

    var variant = new Variant({ dataType: DataType.Boolean , value: value});
    self._map[idKey] = variant;

    // also change varName with human readable text
    var twoStateNode = self._node_index[hrKey];

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
    var key = varName.toLowerCase()+".id";
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
    return self._get_twoStateVariable("AckedState");
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

    // todo deal with Error code BadConditionBranchAlreadyConfirmed

    self._set_twoStateVariable("confirmedState",confirmedState);
};


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


UAAcknowledgeableConditionBase.prototype.raiseNewCondition = function(options) {

    var self = this;
    var selfConditionType = self.typeDefinitionObj;

    var acknowledgeableConditionType = self.addressSpace.findObjectType("AcknowledgeableConditionType");

    assert(acknowledgeableConditionType.isSupertypeOf(conditionType));
    var isAcknowledgeable = acknowledgeableConditionType.isSupertypeOf(selfConditionType);

    if (isAcknowledgeable) {
        self.setAckedState(false);
        self.setConfirmedState(false);
    }

    UAConditionBase.prototype.raiseNewCondition.call(self,options);

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

UAAcknowledgeableConditionBase.prototype.activateAlarm = function() {
    // will set acknowledgeable to false and retain to true
    var self = this;
    var branch = self.currentBranch();
    branch.setRetain(true);
    branch.setAckedState(false);
};

UAAcknowledgeableConditionBase.prototype.desactivateAlarm = function() {
    var self = this;
};




function _acknwoledge_method(inputArguments,context,callback) {

    UAConditionBase.with_condition_method(inputArguments, context, callback,function(eventId,comment,branch,conditionNode) {

        var conditionNode = context.object;
        assert(conditionNode instanceof UAAcknowledgeableConditionBase);
        branch.setConfirmedState(false);
        var statusCode = _setAckedState(branch,true,eventId,comment);
        if (statusCode != StatusCodes.Good) {
            return statusCode;
        }
        branch.setComment(comment);
        conditionNode._raiseAuditConditionCommentEvent("Method/Acknowledge",eventId,comment);
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

        return StatusCodes.Good;
    });

}



exports.UAAcknowledgeableConditionBase = UAAcknowledgeableConditionBase;

UAAcknowledgeableConditionBase.instantiate = function (addressSpace,conditionTypeId, options,data ) {

    var conditionNode = UAConditionBase.instantiate(addressSpace, conditionTypeId, options, data);

    Object.setPrototypeOf(conditionNode,UAAcknowledgeableConditionBase.prototype);

    // ----------------------- Install Acknowledge-able Condition stuff
    // install ackedState - Mandatory
    AddressSpace._install_TwoStateVariable_machinery(conditionNode.ackedState,{
        trueState: "Acknowledged",
        falseState: "Unacknowledged"
    });
    conditionNode.acknowledge.bindMethod(_acknwoledge_method);

    // install confirmedState - Optional
    if (conditionNode.confirmedState) {
        AddressSpace._install_TwoStateVariable_machinery(conditionNode.confirmedState,{
            trueState: "Confirmed",
            falseState: "Unconfirmed"
        });
    }

    // install confirm Method - Optional
    if (conditionNode.confirm) {
        conditionNode.confirm.bindMethod(_confirm_method);
    }
    assert(conditionNode instanceof UAAcknowledgeableConditionBase);
    return conditionNode;
};
