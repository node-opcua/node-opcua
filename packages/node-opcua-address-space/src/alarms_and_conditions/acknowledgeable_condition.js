"use strict";

/**
 * @module opcua.address_space.AlarmsAndConditions
 */
const util = require("util");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");




const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;

const LocalizedText = require("node-opcua-data-model").LocalizedText;
const NodeId = require("node-opcua-nodeid").NodeId;

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const AddressSpace = require("../address_space").AddressSpace;
const UATwoStateVariable = require("../ua_two_state_variable").UATwoStateVariable;

const conditions =require("./condition");

const UAConditionBase = conditions.UAConditionBase;
const ConditionSnapshot = conditions.ConditionSnapshot;

function _getValueAsBoolean(node) {
    assert(!node.id);
    return !!node.readValue().value.value;
}

const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;


const _setAckedState = function(self, requestedAckedState,eventId,comment) {

    assert(self instanceof ConditionSnapshot);

    const ackedState = self.getAckedState();

    if (ackedState && requestedAckedState) {
        return StatusCodes.BadConditionBranchAlreadyAcked;
    }
    self._set_twoStateVariable("ackedState",requestedAckedState);
    return StatusCodes.Good;
};

ConditionSnapshot.prototype.getAckedState = function()
{
    const self = this;
    if (!self.condition.ackedState) {
        const condition = self.condition;
        throw new Error("Node "+ condition.browseName.toString()+
            " of type "+ condition.typeDefinitionObj.browseName.toString()+
            " has no AckedState");
    }
    return self._get_twoStateVariable("ackedState");
};

ConditionSnapshot.prototype.setAckedState = function(ackedState) {
    ackedState = !!ackedState;
    const self = this;
    return _setAckedState(self, ackedState);
};

ConditionSnapshot.prototype.getConfirmedState = function()
{
    const self = this;
    assert(self.condition.confirmedState,"Must have a confirmed state");
    return self._get_twoStateVariable("confirmedState");
};

ConditionSnapshot.prototype.setConfirmedStateIfExists = function(confirmedState) {
    confirmedState = !!confirmedState;
    const self = this;
    if (!self.condition.confirmedState) {
        // no condition node has been defined (this is valid)
        // confirm state cannot be set
        return;
    }
    // todo deal with Error code BadConditionBranchAlreadyConfirmed
    return self._set_twoStateVariable("confirmedState",confirmedState);
};

ConditionSnapshot.prototype.setConfirmedState = function(confirmedState) {
    const self = this;
    assert(self.condition.confirmedState,"Must have a confirmed state.  Add ConfirmedState to the optionals");
    return self.setConfirmedStateIfExists(confirmedState);
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
    const self = this;
    UAConditionBase.prototype._populate_EventData.call(self,eventData);
    self._populate_EventData_with_AcknowledgeableConditionTypeElements(eventData);
};

UAAcknowledgeableConditionBase.prototype._populate_EventData_with_AcknowledgeableConditionTypeElements = function(eventData) {
    const self = this;
    const data = {
        // -----------------------------------------------------------
        // AcknowledgeableConditionType
        // -----------------------------------------------------------
        ackedState:     self.ackedState.readValue().value,
        confirmedState: self.confirmedState.readValue().value
    };
    eventData= _.extend(eventData,data);
};


UAAcknowledgeableConditionBase.prototype._raiseAuditConditionAcknowledgeEvent = function(branch) {


    // raise the AuditConditionAcknowledgeEventType
    const eventData = {

        // EventType
        eventId:  { dataType: DataType.ByteString, value: branch.getEventId() },
        //xx branchId: branch.branchId.readValue().value,
        // AuditEventType
        actionTimeStamp: { dataType: DataType.DateTime, value : new Date() },
        status: { dataType: DataType.StatusCodes, value: StatusCodes.Good },
        serverId: {},
        clientAuditEntryId: {},
        clientUserId: {},
        methodId: {},
        inputArguments: {},
        comment:   {dataType: DataType.LocalizedText, value: branch.getComment() }
    };
    this.raiseEvent("AuditConditionAcknowledgeEventType",eventData);

};

UAAcknowledgeableConditionBase.prototype._raiseAuditConditionConfirmEvent = function(branch) {

    // raise the AuditConditionConfirmEventType
    const eventData = {

        // EventType
        eventId:  { dataType: DataType.ByteString, value: branch.getEventId() },
        //xx branchId: branch.branchId.readValue().value,
        // AuditEventType
        actionTimeStamp: { dataType: DataType.DateTime, value : new Date() },
        status: { dataType: DataType.StatusCodes, value: StatusCodes.Good },
        serverId: {},
        clientAuditEntryId: {},
        clientUserId: {},
        methodId: {},
        inputArguments: {},
        comment:   {dataType: DataType.LocalizedText, value: branch.getComment() }
    };
    this.raiseEvent("AuditConditionConfirmEventType",eventData);

};


UAAcknowledgeableConditionBase.prototype._acknowledge_branch = function (eventId,comment,branch,message) {

    assert(typeof(message) === "string");

    const conditionNode = this;

    if(conditionNode.confirmedState) {
        // alarm has a confirmed state !
        // we should be waiting for confirmation now
        branch.setConfirmedState(false);
        branch.setRetain(true);
    } else {
        branch.setRetain(false);
    }

    const statusCode = _setAckedState(branch,true,eventId,comment);
    if (statusCode !== StatusCodes.Good) {
        return statusCode;
    }

    branch.setComment(comment);

    conditionNode.raiseNewBranchState(branch);

    //xx conditionNode._raiseAuditConditionCommentEvent("Method/Acknowledge",eventId,comment);
    conditionNode._raiseAuditConditionAcknowledgeEvent(branch);


    /**
     * @event acknowledged
     * @param  eventId   {Buffer|null}
     * @param  comment   {LocalizedText}
     * @param  branch    {ConditionSnapshot}
     * raised when the alarm branch has been acknowledged
     */
    conditionNode.emit("acknowledged",eventId,comment,branch);

};



function _acknowledge_method(inputArguments,context,callback) {

    UAConditionBase.with_condition_method(inputArguments, context, callback,function(eventId,comment,branch,conditionNode) {

        // precondition checking
        assert(!eventId || eventId instanceof Buffer,"must have a valid eventId or  null");
        assert(comment instanceof LocalizedText, "expecting a comment as LocalizedText");
        assert(conditionNode instanceof UAAcknowledgeableConditionBase);
        conditionNode._acknowledge_branch(eventId,comment,branch,"Method/Acknowledged");
        return StatusCodes.Good;
    });
}

/**
 * @method _confirm_branch
 * @param eventId
 * @param comment
 * @param branch
 * @param message
 * @private
 */
UAAcknowledgeableConditionBase.prototype._confirm_branch = function _confirm_branch(eventId,comment,branch,message) {

    assert(typeof(message) === "string");
    assert(comment instanceof LocalizedText);

    const conditionNode = this;
    //xx var eventId = branch.getEventId();
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

};

/**
 * @method autoConfirmBranch
 * @param branch
 * @param comment
 */
UAAcknowledgeableConditionBase.prototype.autoConfirmBranch = function(branch,comment) {
    assert(branch instanceof ConditionSnapshot);
    if (!this.confirmedState) {
        // no confirmedState => ignoring
        return;
    }
    assert(!branch.getConfirmedState(),"already confirmed ?");
    const conditionNode = this;
    const eventId = branch.getEventId();
    console.log("autoConfirmBranch getAckedState ",branch.getAckedState());
    conditionNode._confirm_branch(eventId,comment,branch,"Server/Confirm");
};

/**
 * @method acknowledgeAndAutoConfirmBranch
 * @param branch {ConditionSnapshot}
 * @param comment {String|LocalizedText}
 */
UAAcknowledgeableConditionBase.prototype.acknowledgeAndAutoConfirmBranch = function(branch,comment) {

    comment = LocalizedText.coerce(comment);
    const eventId = branch.getEventId();
    branch.setRetain(false);
    this._acknowledge_branch(eventId,comment,branch,"Server/Acknowledge");
    this.autoConfirmBranch(branch,comment);
};

/*
 *
 * param inputArguments {Variant[]}
 * param context        {Object}
 * param callback       {Function}
 *
 * @private
 */
function _confirm_method(inputArguments,context,callback) {

    UAConditionBase.with_condition_method(inputArguments, context, callback,function(eventId,comment,branch,conditionNode) {

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

UAAcknowledgeableConditionBase.install_method_handle_on_type = function _install_condition_refresh_handle(addressSpace) {
    const acknowledgeableConditionType = addressSpace.findEventType("AcknowledgeableConditionType");
    assert(acknowledgeableConditionType !== null);
    acknowledgeableConditionType.acknowledge.bindMethod(_acknowledge_method);
    acknowledgeableConditionType.confirm.bindMethod(_confirm_method);

};
