"use strict";

/**
 * @module opcua.address_space.AlarmsAndConditions
 */


const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const UAVariable = require("../ua_variable").UAVariable;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;


const util = require("util");

const conditions = require("./condition");
const ConditionInfo = require("./condition").ConditionInfo;
const ConditionSnapshot = conditions.ConditionSnapshot;
const AddressSpace = require("../address_space").AddressSpace;
const NodeId = require("node-opcua-nodeid").NodeId;

const UAAcknowledgeableConditionBase = require("./acknowledgeable_condition").UAAcknowledgeableConditionBase;

const doDebug = false;
//----------------------------------------------------------------------------------------------------------------------
// UAShelvingStateMachine
//----------------------------------------------------------------------------------------------------------------------
const UAStateMachine = require("../state_machine/finite_state_machine").UAStateMachine;

function UAShelvingStateMachine() {

}

util.inherits(UAShelvingStateMachine, UAStateMachine);

UAShelvingStateMachine.promote = function (shelvingState) {

    UAStateMachine.promote(shelvingState);

    Object.setPrototypeOf(shelvingState, UAShelvingStateMachine.prototype);
    shelvingState._timer = null;

    if (shelvingState.unshelve) {
        shelvingState.unshelve.bindMethod(_unshelve_method);
    }
    if (shelvingState.timedShelve) {
        shelvingState.timedShelve.bindMethod(_timedShelve_method);
    }
    if (shelvingState.oneShotShelve) {
        shelvingState.oneShotShelve.bindMethod(_oneShotShelve_method);
    }
    // install unshelveTime
    if (shelvingState.unshelveTime) {
        shelvingState.unshelveTime.minimumSamplingInterval = 500;
        shelvingState.unshelveTime.bindVariable({
            get: _unShelveTimeFunc.bind(null, shelvingState)
        }, true);
    }

    assert(shelvingState instanceof UAShelvingStateMachine);
};


//----------------------------------------------------------------------------------------------------------------------
// Extension of the snapshot object
//----------------------------------------------------------------------------------------------------------------------

/**
 * @class ConditionSnapshot
 */
/**
 * @method getSuppressedState
 * @return {Boolean}
 */
ConditionSnapshot.prototype.getSuppressedState = function () {
    const self = this;
    return self._get_twoStateVariable("suppressedState");
};

/**
 * @method setSuppressedState
 * @param suppressed {Boolean}
 */
ConditionSnapshot.prototype.setSuppressedState = function (suppressed) {
    suppressed = !!suppressed;
    const self = this;
    self._set_twoStateVariable("suppressedState", suppressed);
};

ConditionSnapshot.prototype.getActiveState = function () {
    const self = this;
    return self._get_twoStateVariable("activeState");
};

ConditionSnapshot.prototype.setActiveState = function (newActiveState) {
    const self = this;
    //xx var activeState = self.getActiveState();
    //xx if (activeState === newActiveState) {
    //xx     return StatusCodes.Bad;
    //xx }
    self._set_twoStateVariable("activeState", newActiveState);
    return StatusCodes.Good;
};

ConditionSnapshot.prototype.setShelvingState = function (state) {

};

/**
 * @class UAAlarmConditionBase
 * @constructor
 * @extends UAAcknowledgeableConditionBase
 */
function UAAlarmConditionBase() {

}

util.inherits(UAAlarmConditionBase, UAAcknowledgeableConditionBase);

UAAlarmConditionBase.prototype.dispose = function () {
    const self = this;
    if (self.shelvingState) {
        _clear_timer_if_any(self.shelvingState);
    }
    UAAcknowledgeableConditionBase.prototype.dispose.apply(self, arguments);
};


/**
 * @method activateAlarm
 */
UAAlarmConditionBase.prototype.activateAlarm = function () {
    // will set acknowledgeable to false and retain to true
    const self = this;
    const branch = self.currentBranch();
    branch.setRetain(true);
    branch.setActiveState(true);
    branch.setAckedState(false);
};

/**
 * @method desactivateAlarm
 */
UAAlarmConditionBase.prototype.desactivateAlarm = function () {
    const self = this;
    const branch = self.currentBranch();
    branch.setRetain(true);
    branch.setActiveState(false);
};


/**
 * @method isSuppressedOrShelved
 * @return {boolean}
 */
UAAlarmConditionBase.prototype.isSuppressedOrShelved = function () {

    const node = this;
    let suppressed = false;
    if (node.suppressedState) {
        suppressed = node.suppressedState.id.readValue().value.value;
    }
    let shelved = false;
    if (node.shelvingState) {
        const shelvedValue = node.shelvingState.currentState.readValue().value.value;
        if (shelvedValue && shelvedValue.text !== "Unshelved") {
            shelved = true;
        }
        //console.log("shelved = shelved",shelvedValue,shelved);
    }
    //xx console.log(" isSuppressedOrShelved ",suppressed,shelved);
    return suppressed || shelved;
};

/**
 * @method getSuppressedOrShelved
 * @return {Boolean}
 */
UAAlarmConditionBase.prototype.getSuppressedOrShelved = function () {
    const node = this;
    return node.suppressedOrShelved.readValue().value.value;
};

/**
 * @class UAAlarmConditionBase
 * @static
 * @property MaxDuration
 * @type {Duration}
 */
UAAlarmConditionBase.MaxDuration = Math.pow(2,31);

/**
 * @method setMaxTimeShelved
 * @param duration  ( Duration in Milliseconds)
 *
 * note: duration must be greater than 10ms and lesser than 2**31 ms
 */
UAAlarmConditionBase.prototype.setMaxTimeShelved = function (duration) {

    const self = this;
    if (duration < 10 || duration >= Math.pow(2,31)) {
        throw new Error(" Invalid maxTimeShelved duration: " + duration+ "  must be [10,2**31] ");
    }
    self.maxTimeShelved.setValueFromSource({
        dataType: "Duration", // <= Duration is basic Type Double! ( milliseconds)
        value: duration
    });
};

/**
 * @method getMaxTimeShelved
 * @return {Duration}
 */
UAAlarmConditionBase.prototype.getMaxTimeShelved = function () {
    const node = this;
    if (!node.maxTimeShelved) {
        // if maxTimeShelved is not provided we assume MaxDuration
        assert(UAAlarmConditionBase.MaxDuration <= 2147483648 , "MaxDuration cannot be greater than 2**31");
        return UAAlarmConditionBase.MaxDuration;
    }
    const dataValue = node.maxTimeShelved.readValue();
    assert(dataValue.value.dataType === DataType.Double); // Double <= Duration
    return dataValue.value.value;
};

function _update_suppressedOrShelved(alarmNode) {

    alarmNode.suppressedOrShelved.setValueFromSource({
        dataType: DataType.Boolean,
        value: alarmNode.isSuppressedOrShelved()
    });
}

// The Unshelve Method sets the AlarmCondition to the Unshelved state. Normally, the MethodId found
// the Shelving child of the Condition instance and the NodeId of the Shelving object as the ObjectId
// are passed to the Call Service. However, some Servers do not expose Condition instances in the
// AddressSpace. Therefore all Servers shall also allow Clients to call the Unshelve Method by
// specifying ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the
// ShelvedStateMachineType Node.
// output => Bad_ConditionNotShelved
function _unshelve_method(inputArguments, context, callback) {

    assert(inputArguments.length === 0);
    // var alarmNode = context.object.parent;
    // if (!(alarmNode instanceof UAAlarmConditionBase)) {
    //     return callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
    // }
    //
    // if (!alarmNode.getEnabledState() ) {
    //     return callback(null, {statusCode: StatusCodes.BadConditionDisabled});
    // }

    const shelvingState = context.object;
    if (shelvingState.getCurrentState() === "Unshelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionNotShelved
        });
    }
    shelvingState.setState("Unshelved");

    shelvingState._unsheveldTime = new Date(); // now

    _clear_timer_if_any(shelvingState);
    assert(!shelvingState._timer);

    return callback(null, {
        statusCode: StatusCodes.Good
    });
}

function _clear_timer_if_any(shelvingState) {
    assert(shelvingState instanceof UAShelvingStateMachine);
    if (shelvingState._timer) {
        clearTimeout(shelvingState._timer);
        //xx console.log("_clear_timer_if_any shelvingState = ",shelvingState._timer,shelvingState.constructor.name);
        shelvingState._timer = null;
    }
}

function _automatically_unshelve(shelvingState) {

    assert(shelvingState._timer, "expecting timerId to be set");
    shelvingState._timer = null;

    if (doDebug) {
        debugLog("Automatically unshelving variable ", shelvingState.browseName.toString());
    }

    if (shelvingState.getCurrentState() === "Unshelved") {
        // just ignore !!!
        return ;
        //throw new Error(StatusCodes.BadConditionNotShelved);
    }
    shelvingState.setState("Unshelved");
    shelvingState._unsheveldTime = new Date(); // now
    assert(!shelvingState._timer);
}

function _start_timer_for_automatic_unshelve(shelvingState, duration) {

    if (duration < 10 || duration >= Math.pow(2,31)) {
        throw new Error(" Invalid maxTimeShelved duration: " + duration+ "  must be [10,2**31] ");
    }
    assert(!shelvingState._timer);

    shelvingState._sheveldTime = new Date(); // now
    shelvingState._duration = duration;

    if (doDebug) {
        debugLog("shelvingState._duration", shelvingState._duration);
    }

    if (duration !== UAAlarmConditionBase.MaxDuration) {
        assert(!shelvingState._timer);
        shelvingState._timer = setTimeout(_automatically_unshelve.bind(null, shelvingState), shelvingState._duration);
    }
}

// Spec 1.03:
// The TimedShelve Method sets the AlarmCondition to the TimedShelved state
// (parameters are defined in Table 38 and result codes are described in Table 39).
// Normally, the MethodId found in the Shelving child of the Condition instance and the NodeId of the Shelving object
// as the ObjectId are passed to the Call Service. However, some Servers do not expose Condition instances in the
// AddressSpace. Therefore all Servers shall also allow Clients to call the TimedShelve Method by specifying
// ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the ShelvedStateMachineType Node.
//
// Signature:   TimedShelve([in] Duration ShelvingTime);
//
// ShelvingTime Specifies a fixed time for which the Alarm is to be shelved. The Server may refuse the provided duration.
//              If a MaxTimeShelved Property exist on the Alarm than the Shelving time shall be less than or equal
//              to the value of this Property.
// StatusCode :
//               Bad_ConditionAlreadyShelved The Alarm is already in TimedShelved state and the system does not allow
//                                           a reset of the shelved timer.
//               Bad_ShelvingTimeOutOfRange
function _timedShelve_method(inputArguments, context, callback) {
    assert(inputArguments.length === 1);

    const shelvingState = context.object;
    assert(shelvingState instanceof UAShelvingStateMachine);

    if (shelvingState.getCurrentState() !== "Unshelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionAlreadyShelved
        });
    }
    // checking duration ...
    const alarmNode = context.object.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionBase)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }
    const maxTimeShelved = alarmNode.getMaxTimeShelved();
    assert(_.isFinite(maxTimeShelved));

    assert(inputArguments[0].dataType === DataType.Double); // Duration
    assert(inputArguments[0] instanceof Variant);

    //xx console.log("inputArguments",inputArguments[0].toString());

    const proposedDuration = inputArguments[0].value; // as double (milliseconds)
    if (proposedDuration > maxTimeShelved) {
        return callback(null, {
            statusCode: StatusCodes.BadShelvingTimeOutOfRange
        });
    }

    if (proposedDuration < 0) {
        return callback(null, {
            statusCode: StatusCodes.BadShelvingTimeOutOfRange
        });
    }

    _clear_timer_if_any(shelvingState);
    shelvingState.setState("TimedShelved");
    _start_timer_for_automatic_unshelve(shelvingState, proposedDuration);

    return callback(null, {
        statusCode: StatusCodes.Good
    });

}


// Spec 1.03:
// OneShotShelve Method
// The OneShotShelve Method sets the AlarmCondition to the OneShotShelved state. Normally, the MethodId found in the
// Shelving child of the Condition instance and the NodeId of the Shelving object as the ObjectId are passed to the
// Call Service. However, some Servers do not expose Condition instances in the AddressSpace. Therefore all Servers
// shall also allow Clients to call the OneShotShelve Method by specifying ConditionId as the ObjectId. The Method
// cannot be called with an ObjectId of the ShelvedStateMachineType Node
function _oneShotShelve_method(inputArguments, context, callback) {

    assert(inputArguments.length === 0);
    const shelvingState = context.object;
    if (shelvingState.getCurrentState() === "OneShotShelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionAlreadyShelved
        });
    }
    // checking duration ...
    const alarmNode = context.object.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionBase)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }


    const maxTimeShelved = alarmNode.getMaxTimeShelved();
    assert(_.isFinite(maxTimeShelved));
    assert(maxTimeShelved !== UAAlarmConditionBase.MaxDuration);

    // set automatic unshelving timer
    _clear_timer_if_any(shelvingState);
    shelvingState.setState("OneShotShelved");
    _start_timer_for_automatic_unshelve(shelvingState, maxTimeShelved);

    return callback(null, {
        statusCode: StatusCodes.Good
    });
}

// from spec 1.03 :
// * UnshelveTime specifies the remaining time in milliseconds until the Alarm automatically
//   transitions into the Un-shelved state.
// * For the TimedShelved state this time is initialised with the ShelvingTime argument of the
//   TimedShelve Method call.
// * For the OneShotShelved state the UnshelveTime will be a constant set to the maximum Duration
//   except if a MaxTimeShelved Property is provided.
function _unShelveTimeFunc(shelvingState) {


    if (shelvingState.getCurrentState() === "Unshelved") {
        return new Variant({
            dataType: DataType.StatusCode,
            value: StatusCodes.BadConditionNotShelved
        });
    }

    if (!shelvingState._sheveldTime) {
        return new Variant({
            dataType: DataType.StatusCode,
            value: StatusCodes.BadConditionNotShelved
        });
    }
    if (shelvingState.getCurrentState() === "OneShotShelved" && shelvingState._duration === UAAlarmConditionBase.MaxDuration) {
        return new Variant({
            dataType: DataType.Double,
            value: UAAlarmConditionBase.MaxDuration
        });
    }
    const now = new Date();
    let timeToAutomaticUnshelvedState = shelvingState._duration - (now.getTime() - shelvingState._sheveldTime.getTime());
    // timeToAutomaticUnshelvedState should always be greater than (or equal) zero
    timeToAutomaticUnshelvedState = Math.max(timeToAutomaticUnshelvedState,0);
    return new Variant({
        dataType: DataType.Double, // duration
        value: timeToAutomaticUnshelvedState
    });
}


/**
 * @method getInputNodeNode
 * @return {BaseNode} return the node in the address space pointed by the inputNode value
 * 
 * Note: please note the difference between alarm.inputNode
 *    *  alarm.inputNode is a UAVariable property of the alarm object holding the nodeid of the input node in its value.
 *    *  getInputNodeNode() is the UAVariable that contains the value that affects the state of the alarm and 
 *       whose node id is stored in alarm.inputNode
 */
UAAlarmConditionBase.prototype.getInputNodeNode = function () {
    const nodeId = this.inputNode.readValue().value.value;
    assert(nodeId instanceof NodeId || nodeId === null);
    return this.addressSpace.findNode(nodeId);
};

/**
 * @method getInputNodeValue
 * @return {*}
 */
UAAlarmConditionBase.prototype.getInputNodeValue = function () {
    const node = this.getInputNodeNode();
    if (!node) {
        return null;
    }
    assert(node instanceof UAVariable);
    return node.readValue().value.value;
};

UAAlarmConditionBase.prototype.updateState = function () {
    const alarm = this;
    const dataValue = alarm.getInputNodeNode().readValue();
    alarm._onInputDataValueChange(dataValue);
};

UAAlarmConditionBase.prototype._onInputDataValueChange = function (newValue) {
    //xx console.log("class=",this.constructor.name,this.browseName.toString());
    //xx throw new Error("_onInputDataValueChange must be overridden");
};

/**
 * @method _installInputNodeMonitoring
 * install mechanism that listen to input node datavalue changes so that alarm status
 * can be automatically updated appropriatly.
 * @param inputNode {BaseNode}
 * @return {void}
 * @protected
 */
UAAlarmConditionBase.prototype._installInputNodeMonitoring = function (inputNode) {
    const alarm = this;
    /**
     *
     * The InputNode Property provides the NodeId of the Variable the Value of which is used as
     * primary input in the calculation of the Alarm state. If this Variable is not in the AddressSpace,
     * a Null NodeId shall be provided. In some systems, an Alarm may be calculated based on
     * multiple Variables Values; it is up to the system to determine which Variable’s NodeId is used.
     * dataType is DataType.NodeId
     * @property inputNode
     * @type     UAVariable
     */
    assert(alarm.inputNode instanceof UAVariable);


    const addressSpace = this.addressSpace;
    assert(inputNode, " must provide options.inputNode (NodeId or BaseNode object)");

    if (inputNode === NodeId.NullNodeId) {

        alarm.inputNode.setValueFromSource({
            dataType: DataType.NodeId,
            value: NodeId.NullNodeId
        });

    } else {

        alarm.inputNode.setValueFromSource({
            dataType: "NodeId",
            value: inputNode.nodeId
        });

        const _node = addressSpace._coerceNode(inputNode);
        if (!_node) {
            console.log(" cannot find nodeId ", inputNode);
        }
        assert(_node, "Expecting a valid input node");
        alarm.inputNode.setValueFromSource({
            dataType: DataType.NodeId,
            value: _node.nodeId
        });
        alarm.getInputNodeNode().on("value_changed", function (newDataValue /*, oldDataValue */) {
            if (!alarm.getEnabledState()) {
                // disabled alarms shall ignored input node value change event
                // (alarm shall be reevaluated when EnabledState goes back to true)
                return;
            }
            alarm._onInputDataValueChange(newDataValue);
        });
    }


};

UAAlarmConditionBase.prototype.getCurrentConditionInfo = function () {

    const alarm = this;

    const oldSeverity = alarm.currentBranch().getSeverity();
    const oldQuality = alarm.currentBranch().getQuality();
    const oldMessage = alarm.currentBranch().getMessage();
    const oldRetain = alarm.currentBranch().getRetain();

    const oldConditionInfo = new ConditionInfo({
        severity: oldSeverity,
        quality: oldQuality,
        message: oldMessage,
        retain: oldRetain
    });

    return oldConditionInfo;
};


/***
 * @method  _calculateConditionInfo
 * @param stateData {Object}   the new calculated state of the alarm
 * @param isActive  {Boolean}
 * @param value     {Number}   the new value of the limit alarm
 * @param oldCondition  {ConditionInfo} given for information purpose
 * @param oldCondition.severity
 * @param oldCondition.quality
 * @param oldCondition.message
 * @param oldCondition.retain
 * @return {ConditionInfo} the new condition info
 *
 * this method need to be overridden by the instantiate to allow custom message and severity
 * to be set based on specific context of the alarm.
 *
 * @example
 *
 *
 *    var myAlarm = addressSpace.instantiateExclusiveLimitAlarm({...});
 *    myAlarm._calculateConditionInfo = function(stateName,value,oldCondition) {
 *       var percent = Math.ceil(value * 100);
 *       return new ConditionInfo({
 *            message: "Tank is almost " + percent + "% full",
 *            severity: 100,
 *            quality: StatusCodes.Good
 *      });
 *    };
 *
 */
UAAlarmConditionBase.prototype._calculateConditionInfo = function (stateData, isActive, value, oldCondition) {

    if (!stateData) {
        return new ConditionInfo({
            severity: 0,
            message: "Back to normal",
            quality: StatusCodes.Good,
            retain: true
        });
    } else {
        return new ConditionInfo({
            severity: 150,
            message: "Condition value is " + value + " and state is " + stateData,
            quality: StatusCodes.Good,
            retain: true
        });

    }
};

UAAlarmConditionBase.prototype._signalInitialCondition = function () {
    const alarm = this;
    alarm.currentBranch().setActiveState(false);
    alarm.currentBranch().setAckedState(true);
};
UAAlarmConditionBase.prototype._signalNewCondition = function (stateName, isActive, value) {

    const alarm = this;
    //xx if(stateName === null) {
    //xx     alarm.currentBranch().setActiveState(false);
    //xx     alarm.currentBranch().setAckedState(true);
    //xx     return;
    //xx }
    // disabled alarm shall not generate new condition events
    assert(alarm.getEnabledState() === true);
    //xx assert(isActive !== alarm.activeState.getValue());

    const oldConditionInfo = alarm.getCurrentConditionInfo();
    const newConditionInfo = alarm._calculateConditionInfo(stateName, isActive, value, oldConditionInfo);

    // detect potential internal bugs due to misused of _signalNewCondition
    if (_.isEqual(oldConditionInfo, newConditionInfo)) {
        console.log(oldConditionInfo);
        throw new Error("condition values have not change, shall we really raise an event ? alarm " + alarm.browseName.toString());
    }
    assert(!_.isEqual(oldConditionInfo, newConditionInfo), "condition values have not change, shall we really raise an event ?");

    if (isActive) {
        alarm.currentBranch().setActiveState(true);
        alarm.currentBranch().setAckedState(false);
        alarm.raiseNewCondition(newConditionInfo);
    } else {

        if (alarm.currentBranch().getAckedState() === false) {
            // prior state need acknowledgement
            // note : TODO : timestamp of branch and new state of current branch must be identical

            if (alarm.currentBranch().getRetain()) {

                // we need to create a new branch so the previous state could be acknowledged
                const newBranch = alarm.createBranch();
                assert(newBranch.getBranchId() !== NodeId.NullNodeId);
                // also raised a new Event for the new branch as branchId has changed
                alarm.raiseNewBranchState(newBranch);

            }
        }

        alarm.currentBranch().setActiveState(false);
        alarm.currentBranch().setAckedState(true);

        alarm.raiseNewCondition(newConditionInfo);
    }
};

exports.UAAlarmConditionBase = UAAlarmConditionBase;

/**
 * @method (static)UAAlarmConditionBase.instantiate
 * @param alarmConditionTypeId
 * @param options
 * @param options.inputNode
 * @param options.optionals  could be "SuppressedState" , "ShelvingState"
 * @param [options.maxTimeShelved {Number|null}] max TimeShelved duration (in ms)
 * @param data
 */
UAAlarmConditionBase.instantiate = function (addressSpace, alarmConditionTypeId, options, data) {

    //xx assert(options.hasOwnProperty("conditionOf")); // must provide a conditionOf
    assert(options.hasOwnProperty("inputNode")); // must provide a inputNode
    const alarmConditionType = addressSpace.findEventType(alarmConditionTypeId);

    /* istanbul ignore next */
    if (!alarmConditionType) {
        throw new Error(" cannot find Alarm Condition Type for " + alarmConditionTypeId);
    }

    const alarmConditionTypeBase = addressSpace.findEventType("AlarmConditionType");
    /* istanbul ignore next */
    if (!alarmConditionTypeBase) {
        throw new Error("cannot find AlarmConditionType");
    }

    options.optionals = options.optionals || [];
    if (options.hasOwnProperty("maxTimeShelved")) {
        options.optionals.push("MaxTimeShelved");
        assert(_.isFinite(options.maxTimeShelved));
    }

    assert(alarmConditionTypeBase === alarmConditionType || alarmConditionType.isSupertypeOf(alarmConditionTypeBase));

    const alarmNode = UAAcknowledgeableConditionBase.instantiate(addressSpace, alarmConditionTypeId, options, data);
    Object.setPrototypeOf(alarmNode, UAAlarmConditionBase.prototype);

    // ----------------------- Install Alarm specifics
    //

    // Specs 1.03:
    // ActiveState/Id when set to TRUE indicates that the situation the Condition is representing
    // currently exists. When a Condition instance is in the inactive state (ActiveState/Id when set to
    // FALSE) it is representing a situation that has returned to a normal state. The transitions of
    // Conditions to the inactive and Active states are triggered by Server specific actions. Sub-
    // Types of the AlarmConditionType specified later in this document will have sub-state models
    // that further define the Active state. Recommended state names are described in Annex A.
    // install activeState - Mandatory

    /**
     * @property activeState
     * @type {UATwoStateVariable}
     */
    AddressSpace._install_TwoStateVariable_machinery(alarmNode.activeState, {
        trueState: "Active",
        falseState: "Inactive"
    });

    alarmNode.currentBranch().setActiveState(false);

    // Specs 1.03:
    /**
     *
     * SuppressState is used internally by a Server to automatically suppress Alarms due to system
     * specific reasons. For example a system may be configured to suppress Alarms that are
     * associated with machinery that is shutdown, such as a low level Alarm for a tank that is
     * currently not in use.
     *
     * @property suppressedState
     * @type UATwoStateVariable
     */
    if (alarmNode.suppressedState) {
        // install activeState - Optional
        AddressSpace._install_TwoStateVariable_machinery(alarmNode.suppressedState, {
            trueState: "Suppressed",
            falseState: "Unsuppressed"
        });

    }
    // Specs 1.03:
    /**
     * ShelvingState suggests whether an Alarm shall (temporarily) be prevented from being
     * displayed to the user. It is quite often used to block nuisance Alarms.
     *
     * @property shelvingState
     * @type UAShelvingStateMachine
     */
    if (alarmNode.shelvingState) {
        UAShelvingStateMachine.promote(alarmNode.shelvingState);

    }

    // SuppressedOrShelved : Mandatory
    // install supressedOrShelved automatic detection
    /**
     * The SuppressedState and the ShelvingState together result in the SuppressedOrShelved status of the
     * Condition. When an Alarm is in one of the states, the SuppressedOrShelved property will be set TRUE
     * and this Alarm is then typically not displayed by the Client. State transitions associated with the
     * Alarm do occur, but they are not typically displayed by the Clients as long as the Alarm remains in
     * either the Suppressed or Shelved state.
     * The dataType is Boolean.
     * @property suppressedState
     * @type UAVariable
     *
     */
    if (alarmNode.suppressedState) {
        alarmNode.suppressedState.on("value_changed", function (newDataValue) {
            _update_suppressedOrShelved(alarmNode);
        });
    }
    if (alarmNode.shelvingState) {
        alarmNode.shelvingState.currentState.on("value_changed", function (newDataValue) {
            _update_suppressedOrShelved(alarmNode);
        });
    }
    _update_suppressedOrShelved(alarmNode);

    /**
     * The optional Property MaxTimeShelved is used to set the maximum time that an Alarm Condition may be shelved.
     * The value is expressed as duration. Systems can use this Property to prevent permanent Shelving of an Alarm.
     * If this Property is present it will be an upper limit on the duration passed into a TimedShelve Method call.
     * If a value that exceeds the value of this property is passed to the TimedShelve Method,
     * than a Bad_ShelvingTimeOutOfRange error code is returned on the call. If this Property is present it will
     * also be enforced for the OneShotShelved state, in that an Alarm Condition will transition to the Unshelved
     * state from the OneShotShelved state if the duration specified in this Property expires following a
     * OneShotShelve operation without a change of any of the other items associated with the Condition.
     *
     * @property maxTimeShelved
     * @type {UAVariable}
     */
    if (alarmNode.maxTimeShelved) {
        options.maxTimeShelved = options.maxTimeShelved || 60.0 * 1000; // 60 seconds
        alarmNode.maxTimeShelved.setValueFromSource({
            dataType: "Duration",
            value: options.maxTimeShelved
        });
    }


    // ---------- install inputNode
    assert(options.inputNode, " must provide options.inputNode (NodeId or BaseNode object)");
    alarmNode._installInputNodeMonitoring(options.inputNode);

    assert(alarmNode instanceof UAAcknowledgeableConditionBase);
    assert(alarmNode instanceof UAAlarmConditionBase);
    return alarmNode;
};