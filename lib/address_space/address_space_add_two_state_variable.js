"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var Argument = require("lib/datamodel/argument_list").Argument;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

// Release 1.03 12 OPC Unified Architecture, Part 9
// Two-state state machines
// Most states defined in this standard are simple – i.e. they are either TRUE or FALSE. The
// TwoStateVariableType is introduced specifically for this use case. More complex states are
// modelled by using a StateMachineType defined in Part 5.
// The TwoStateVariableType is derived from the StateVariableType.
//
// Attribute        Value
// BrowseName       TwoStateVariableType
// DataType         LocalizedText
// ValueRank         -1 (-1 = Scalar)
// IsAbstract       False
//
// Subtype of the StateVariableType defined in Part 5.
// Note that a Reference to this subtype is not shown in the definition of the StateVariableType
//
// References      NodeClass BrowseName              DataType      TypeDefinition Modelling Rule
// HasProperty     Variable  Id                      Boolean       PropertyType   Mandatory
// HasProperty     Variable  TransitionTime          UtcTime       PropertyType   Optional
// HasProperty     Variable  EffectiveTransitionTime UtcTime       PropertyType   Optional
// HasProperty     Variable  TrueState               LocalizedText PropertyType   Optional
// HasProperty     Variable  FalseState              LocalizedText PropertyType   Optional
// HasTrueSubState StateMachine or
//                 TwoStateVariableType
//                                                  <StateIdentifier> Defined in Clause 5.4.2 Optional
// HasFalseSubState StateMachine or
//                  TwoStateVariableType
//                                                  <StateIdentifier> Defined in Clause 5.4.3 Optional

function _updateTransitionTime(node) {
    // TransitionTime specifies the time when the current state was entered.
    if (node.transitionTime) {
        node.transitionTime.setValueFromSource({dataType: DataType.DateTime, value: (new Date())})
    }
}

function _updateEffectiveTransitionTime(node,subStateNode) {
    if (node.effectiveTransitionTime) {
        //xx console.log("xxxx _updateEffectiveTransitionTime because subStateNode ",subStateNode.browseName.toString());
        node.effectiveTransitionTime.setValueFromSource({ dataType: DataType.DateTime,value: (new Date())})
    }
}
function _setup_TrueFalseSubStateReleation_detector(node) {

    node._old_add_backward_reference = node._add_backward_reference;
    node._add_backward_reference = function(reference) {

        // call old method
        node._old_add_backward_reference(reference);

        if ( ( reference.referenceType === "HasTrueSubState" ||  reference.referenceType === "HasFalseSubState" ) && reference.isForward) {

            var addressSpace = node.__address_space;
            // add event handle
            var subState = addressSpace.findNode(reference.nodeId);
            subState.on("value_changed",_updateEffectiveTransitionTime.bind(null,node,subState));

        }
    };

    // TODO : shall we care about overloading the remove_backward_reference method ?
}

function _install_effectiveTransitionTime_mechanism(node)
{

    // install change detection on sub State

    // this is useful to change the effective transitionTime
    // EffectiveTransitionTime specifies the time when the current state or one of its sub states was entered.
    // If, for example, a LevelAlarm is active and – while active – switches several times between High and
    // HighHigh, then the TransitionTime stays at the point in time where the Alarm became active whereas the
    // EffectiveTransitionTime changes with each shift of a sub state.
    if(node.effectiveTransitionTime) {

        // install "value_changed" event handler on SubState that are already defined
        var subStates = [].concat(node.getTrueSubStates(),node.getFalseSubStates());
        subStates.forEach(function(subState) {
            subState.on("value_changed",_updateEffectiveTransitionTime.bind(null,node,subState));
        });

        // some TrueSubState and FalseSubState relationship may be added later
        // so we need a mechanism to keep adding the "value_changed" event handle on subStates that
        // will be defined later.
        _setup_TrueFalseSubStateReleation_detector(node);
    }
}




function TwoStateVariable_setValue(boolValue) {

    var node = this;

    var dataValue = node.id.readValue();
    var oldValue = dataValue.value.value;
    if (dataValue.statusCode === StatusCodes.Good && boolValue === oldValue) {
        return; // nothing to do
    }
    //
    node.id.setValueFromSource(new Variant({dataType: DataType.Boolean, value: boolValue}));

    _updateTransitionTime(node);

    _updateEffectiveTransitionTime(node,node);

}
function _getHumanReadableString(node) {

    var dataValue = node.id.readValue();
    if (dataValue.statusCode !== StatusCodes.Good) {
        return dataValue;
    }
    assert(dataValue.value.dataType === DataType.Boolean);
    var boolValue = dataValue.value.value;

    // The Value Attribute of a TwoStateVariable contains the current state as a human readable name.
    // The EnabledState for example, might contain the name “Enabled” when TRUE and “Disabled” when FALSE.
    var valueAsLocalizedText;

    if (boolValue) {
        if (node.trueState) {
            valueAsLocalizedText = node.trueState.readValue().value;
        } else {
            valueAsLocalizedText = { dataType:"LocalizedText", value : { text: "TRUE" }};
        }
    } else {
        if (node.falseState) {
            valueAsLocalizedText = node.falseState.readValue().value;
        } else {
            valueAsLocalizedText = { dataType:"LocalizedText", value : { text: "FALSE" }};
        }
    }
    dataValue = dataValue.clone();
    dataValue.value =new Variant(valueAsLocalizedText);
    return dataValue;

}




function _install_TwoStateVariable_machinery(node) {

    assert(node.typeDefinitionObj.browseName.toString() === "TwoStateVariableType");
    assert(node.dataTypeObj.browseName.toString() === "LocalizedText");
    assert(node.hasOwnProperty("valueRank") && (node.valueRank === -1 || node.valueRank === 0));

    node.id.on("value_changed",function() {
        node._internal_set_dataValue(_getHumanReadableString(node));
    });
    node._internal_set_dataValue(_getHumanReadableString(node));

    _install_effectiveTransitionTime_mechanism(node);

    node.setValue = TwoStateVariable_setValue;

}

//exports.constructionHook = function(node) {
//
//    console.log(" In TwoStateVariable construction hook");
//
//    if (node.typeDefinitionObj.browseName.toString() === "TwoStateVariableType") {
//        _install_TwoStateVariable_machinery(node);
//    }
//
//};


exports.install = function (AddressSpace) {


    AddressSpace._install_TwoStateVariable_machinery = _install_TwoStateVariable_machinery;
    /**
     *
     * @method addTwoStateVariable
     *
     * @param options
     * @param options.browseName  {String}
     * @param [options.description {String}]
     * @param [options.modellingRule {String}]
     * @param [options.minimumSamplingInterval {Number} =0]
     * @param options.componentOf {Node|NodeId}
     * @param options.trueState {String}
     * @param options.falseState {String}
     * @param [options.isTrueSubStateOf {NodeId}]
     * @param [options.isFalseSubStateOf {NodeId}]
     * @return {UAVariable}
     *
     * Optionals can be EffectiveDisplayName, TransitionTime, EffectiveTransitionTime
     */
    AddressSpace.prototype.addTwoStateVariable   = function (options) {

        assert(options.browseName," a browseName is required");
        var addressSpace = this;

        var twoStateVariableType = addressSpace.findVariableType("TwoStateVariableType");

        options.optionals = options.optionals || [];
        if (options.trueState) {
            options.optionals.push("TrueState");
        }
        if (options.falseState) {
            options.optionals.push("FalseState");
        }

        // we want event based change...
        options.minimumSamplingInterval = 0;

        var node = twoStateVariableType.instantiate({
            browseName:  options.browseName,
            description: options.description,

            componentOf: options.componentOf,
            modellingRule : options.modellingRule,

            minimumSamplingInterval: options.minimumSamplingInterval,
            optionals:   options.optionals
        });
        assert(node.dataTypeObj.browseName.toString()=== "LocalizedText");
        assert(node.minimumSamplingInterval === 0);

        if (options.trueState) {
            node.trueState.setValueFromSource({ dataType: "LocalizedText", value: { text : options.trueState }});
        }
        if (options.falseState) {
            node.falseState.setValueFromSource({ dataType: "LocalizedText", value: { text : options.falseState }});
        }

        node.id.setValueFromSource( {dataType: "Boolean", value: false} , StatusCodes.UncertainInitialValue);

        // handle isTrueSubStateOf
        if (options.isTrueSubStateOf) {
            node.addReference({ referenceType: "HasTrueSubState", isForward: false, nodeId: options.isTrueSubStateOf});
        }
        if (options.isFalseSubStateOf) {
            node.addReference({ referenceType: "HasFalseSubState", isForward: false, nodeId: options.isFalseSubStateOf});
        }

        _install_TwoStateVariable_machinery(node);

        return node;
    };
};


