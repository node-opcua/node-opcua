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

var conditions = require("./condition");
var UAConditionBase = conditions.UAConditionBase;
var ConditionSnapshot = conditions.ConditionSnapshot;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var UAAcknowledgeableConditionBase = require("./acknowledgeable_condition").UAAcknowledgeableConditionBase;

var doDebug = false;
//----------------------------------------------------------------------------------------------------------------------
// UAShelvingStateMachine
//----------------------------------------------------------------------------------------------------------------------
var UAStateMachine = require("lib/address_space/state_machine/finite_state_machine").UAStateMachine;

function UAShelvingStateMachine()
{

}
util.inherits(UAShelvingStateMachine,UAStateMachine);

UAShelvingStateMachine.promote = function(shelvingState) {

    UAStateMachine.promote(shelvingState);

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
        shelvingState.unshelveTime.bindVariable({ get: _unShelveTimeFunc.bind(null,shelvingState)},true)
    }

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
    var self = this;
    return self._get_twoStateVariable("suppressedState");
};

/**
 * @method setSuppressedState
 * @param suppressed {Boolean}
 */
ConditionSnapshot.prototype.setSuppressedState = function (suppressed) {
    suppressed = !!suppressed;
    var self = this;
    self._set_twoStateVariable("suppressedState", suppressed);
};

ConditionSnapshot.prototype.getActiveState = function() {
  var self = this;
  return self._get_twoStateVariable("activeState");
};

ConditionSnapshot.prototype.setActiveState = function(newActiveState) {
    var self = this;
    var activeState = self.getActiveState();
    if (activeState == newActiveState) {
        return StatusCodes.Bad;
    }
    self._set_twoStateVariable("activeState",newActiveState);
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




/**
 * @method activateAlarm
 */
UAAlarmConditionBase.prototype.activateAlarm = function() {
    // will set acknowledgeable to false and retain to true
    var self = this;
    var branch = self.currentBranch();
    branch.setRetain(true);
    branch.setActiveState(true);
    branch.setAckedState(false);
};

/**
 * @method desactivateAlarm
 */
UAAlarmConditionBase.prototype.desactivateAlarm = function() {
    var self = this;
    var self = this;
    var branch = self.currentBranch();
    branch.setRetain(true);
    branch.setActiveState(false);
};


/**
 * @method isSuppressedOrShelved
 * @return {boolean}
 */
UAAlarmConditionBase.prototype.isSuppressedOrShelved = function () {

    var node = this;
    var suppressed = false;
    if (node.suppressedState) {
        suppressed = node.suppressedState.id.readValue().value.value;
    }
    var shelved = false;
    if (node.shelvingState) {
        var shelvedValue = node.shelvingState.currentState.readValue().value.value;
        if (shelvedValue && shelvedValue.text != "Unshelved") {
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
    var node = this;
    return node.suppressedOrShelved.readValue().value.value;
};

/**
 * @method setMaxTimeShelved
 * @param duration  ( Duration in Milliseconds)
 */
UAAlarmConditionBase.prototype.setMaxTimeShelved = function (duration) {
    var self = this;
    self.maxTimeShelved.setValueFromSource({
        dataType: "Duration", // <= Duration is basic Type Double! ( milliseconds)
        value: duration
    });
};

UAAlarmConditionBase.MaxDuration = 999999999.999;
/**
 * @method getMaxTimeShelved
 * @return {Duration}
 */
UAAlarmConditionBase.prototype.getMaxTimeShelved = function () {
    var node = this;
    if (!node.maxTimeShelved)  {
        return UAAlarmConditionBase.MaxDuration;
    }
    var dataValue = node.maxTimeShelved.readValue();
    assert(dataValue.value.dataType == DataType.Double); // Double <= Duration
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

    var shelvingState = context.object;
    if (shelvingState.getCurrentState() == "Unshelved") {
        return callback(null, {statusCode: StatusCodes.BadConditionNotShelved});
    }
    shelvingState.setState("Unshelved");

    shelvingState._unsheveldTime = new Date(); // now

    _clear_timer_if_any(shelvingState);
    assert(!shelvingState._timer);

    return callback(null, {statusCode: StatusCodes.Good});
}

function _clear_timer_if_any(shelvingState) {
    if (shelvingState._timer) {
        clearTimeout(shelvingState._timer);
        shelvingState._timer = null;
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

    var shelvingState = context.object;
    if (shelvingState.getCurrentState() != "Unshelved") {
        return callback(null, {statusCode: StatusCodes.BadConditionAlreadyShelved});
    }
    // checking duration ...
    var alarmNode = context.object.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionBase)) {
        return callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
    }
    var maxTimeShelved = alarmNode.getMaxTimeShelved();
    assert(_.isFinite(maxTimeShelved));

    assert(inputArguments[0].dataType == DataType.Double); // Duration
    assert(inputArguments[0] instanceof Variant);

    //xx console.log("inputArguments",inputArguments[0].toString());

    var proposedDuration = inputArguments[0].value;// as double (milliseconds)
    if (proposedDuration > maxTimeShelved) {
        return callback(null, {statusCode: StatusCodes.BadShelvingTimeOutOfRange});

    }
    _clear_timer_if_any(shelvingState);

    shelvingState.setState("TimedShelved");

    shelvingState._sheveldTime = new Date(); // now
    shelvingState._duration    = proposedDuration;
    assert(!shelvingState._timer);

    if (doDebug) {
        console.log("shelvingState._duration",shelvingState._duration);
    }
    shelvingState._timer = setTimeout(_automatically_unshelve.bind(null,shelvingState),shelvingState._duration);

    return callback(null, {statusCode: StatusCodes.Good});

}

function _automatically_unshelve(shelvingState){

    if (doDebug) {
        console.log("Automatically unshelving variable " ,shelvingState.browseName.toString());
    }

    if (shelvingState.getCurrentState() == "Unshelved") {
      throw new Error(StatusCodes.BadConditionNotShelved);
    }
    shelvingState.setState("Unshelved");

    shelvingState._unsheveldTime = new Date(); // now
    if (shelvingState._timer) {
        clearTimeout(shelvingState._timer);
        shelvingState._timer = null;
    }
    assert(!shelvingState._timer);
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
    var shelvingState = context.object;
    if (shelvingState.getCurrentState() == "OneShotShelved") {
        return callback(null, {statusCode: StatusCodes.BadConditionAlreadyShelved});
    }
    // checking duration ...
    var alarmNode = context.object.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionBase)) {
        return callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
    }

    _clear_timer_if_any(shelvingState);

    shelvingState.setState("OneShotShelved");

    var maxTimeShelved = alarmNode.getMaxTimeShelved();
    assert(_.isFinite(maxTimeShelved));
    assert(maxTimeShelved !== UAAlarmConditionBase.MaxDuration);

    shelvingState._sheveldTime = new Date(); // now
    shelvingState._duration    = maxTimeShelved;

    // set automatic unshelving timer
    assert(!shelvingState._timer);

    if (maxTimeShelved != UAAlarmConditionBase.MaxDuration) {
        shelvingState._timer = setTimeout(_automatically_unshelve.bind(null,shelvingState),shelvingState._duration);
    }

    return callback(null, {statusCode: StatusCodes.Good});
}
// from spec 1.03 :
// * UnshelveTime specifies the remaining time in milliseconds until the Alarm automatically
//   transitions into the Un-shelved state.
// * For the TimedShelved state this time is initialised with the ShelvingTime argument of the
//   TimedShelve Method call.
// * For the OneShotShelved state the UnshelveTime will be a constant set to the maximum Duration
//   except if a MaxTimeShelved Property is provided.
function _unShelveTimeFunc(shelvingState) {


    if (shelvingState.getCurrentState() == "Unshelved") {
        return new Variant({
            dataType: DataType.StatusCode,
            value: StatusCodes.BadConditionNotShelved
        });
    }

    if (shelvingState.getCurrentState() == "OneShotShelved" &&  shelvingState._duration === UAAlarmConditionBase.MaxDuration ) {
        return new Variant({
            dataType: DataType.Double,
            value: UAAlarmConditionBase.MaxDuration
        });
    }
    var now =new Date();
    var timeToAutomaticUnshelvedState = shelvingState._duration - (now - shelvingState._sheveldTime) ;
    // timeToAutomaticUnshelvedState should be greater than zero

    return new Variant({
        dataType: DataType.Double, // duration
        value: timeToAutomaticUnshelvedState
    });
}


/**
 * @method getInputNodeNode
 * @return {BaseNode}
 */
UAAlarmConditionBase.prototype.getInputNodeNode = function () {
    var nodeId = this.inputNode.readValue().value.value;
    assert(nodeId instanceof NodeId || nodeId === null);
    return this.addressSpace.findNode(nodeId);
};

/**
 * @method getInputNodeValue
 * @returns {*}
 */
UAAlarmConditionBase.prototype.getInputNodeValue = function () {
    var node= this.getInputNodeNode();
    if(!node) { return null;}
    assert(node instanceof UAVariable);
    return node.readValue().value.value;
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
    var alarmConditionType = addressSpace.findEventType(alarmConditionTypeId);

    /* istanbul ignore next */
    if (!alarmConditionType) {
        throw new Error(" cannot find Alarm Condition Type for " + alarmConditionTypeId);
    }

    var alarmConditionTypeBase = addressSpace.findEventType("AlarmConditionType");
    /* istanbul ignore next */
    if (!alarmConditionTypeBase) {
        throw new Error("cannot find AlarmConditionType");
    }

    options.optionals = options.optionals ||[];
    if(options.hasOwnProperty("maxTimeShelved")) {
        options.optionals.push("MaxTimeShelved");
        assert(_.isFinite(options.maxTimeShelved));
    }

    assert(alarmConditionTypeBase == alarmConditionType || alarmConditionType.isSupertypeOf(alarmConditionTypeBase));

    var alarmNode = UAAcknowledgeableConditionBase.instantiate(addressSpace, alarmConditionTypeId, options, data);
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
     * @property suppressedState
     * @type UAVariable - DataType Boolean
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
        alarmNode.maxTimeShelved.setValueFromSource({dataType: "Duration", value: options.maxTimeShelved})
    }



    // ---------- install inputNode
    assert(options.inputNode," must provide options.inputNode (NodeId or BaseNode object)");
    if (options.inputNode === NodeId.NullNodeId) {
        alarmNode.inputNode.setValueFromSource({dataType: DataType.NodeId, value: options.inputNode});
    } else {
        var inputNode = addressSpace._coerceNode(options.inputNode);
        assert(inputNode, "Expecting a valid input node");
        alarmNode.inputNode.setValueFromSource({dataType: DataType.NodeId, value: inputNode.nodeId});
    }

    assert(alarmNode instanceof UAAcknowledgeableConditionBase);
    assert(alarmNode instanceof UAAlarmConditionBase);
    return alarmNode;
};

