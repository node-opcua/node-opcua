"use strict";
require("requirish")._(module);
/**
 * @module opcua.address_space
 */

var util = require("util");
var assert = require("better-assert");
var _ = require("underscore");

var NodeId = require("lib/datamodel/nodeid").NodeId;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var UAObject = require("lib/address_space/ua_object").UAObject;
var BaseNode = require("lib/address_space/base_node").BaseNode;
var utils= require("lib/misc/utils");

var doDebug = false;
/*
 *
 * @class UAStateMachine
 * @constructor
 * @extends UAObject
 * UAStateMachine.initialState as Node
 *
 */
function UAStateMachine() {

    /**
     * @property currentState
     */
}
util.inherits(UAStateMachine,UAObject);


UAStateMachine.promote = function( node) {
    if (node instanceof UAStateMachine) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node,UAStateMachine.prototype);
    node._post_initialize();
    return node;
};

UAStateMachine.prototype._post_initialize = function() {
    var self =this;
    var addressSpace = self.addressSpace;
    var finiteStateMachineType = addressSpace.findObjectType("FiniteStateMachineType");
    assert(finiteStateMachineType.browseName.toString() === "FiniteStateMachineType");

    assert(self.typeDefinitionObj&&!self.subtypeOfObj);
    assert(!self.typeDefinitionObj || self.typeDefinitionObj.isSupertypeOf(finiteStateMachineType));
    // get current Status

    var d = self.currentState.readValue();

    if (d.statusCode !== StatusCodes.Good) {
        self.setState(null);
    } else {
        self.currentStateNode = self.getStateByName(d.value.value.text.toString());
    }

};


function getComponentFromTypeAndSubtype(typeDef) {

    var components_parts = [];
    components_parts.push(typeDef.getComponents());

    while(typeDef.subtypeOfObj) {
        typeDef = typeDef.subtypeOfObj;
        components_parts.push(typeDef.getComponents());
    }
    return [].concat.apply([],components_parts);
}

/**
 * @method getStates
 * @returns {*}
 */
UAStateMachine.prototype.getStates = function() {

    var self = this;
    var addressSpace = self.addressSpace;

    var initialStateType = addressSpace.findObjectType("InitialStateType");
    var stateType        = addressSpace.findObjectType("StateType");

    assert(initialStateType.isSupertypeOf(stateType));

    var typeDef = self.typeDefinitionObj;
    
    var comp = getComponentFromTypeAndSubtype(typeDef);

    comp = comp.filter(function(c){
        if (!(c.typeDefinitionObj instanceof UAObjectType)) {
            return false;
        }
        return c.typeDefinitionObj.isSupertypeOf(stateType);
    });

    return comp;
};

UAStateMachine.prototype.__defineGetter__("states",function() {
    return this.getStates();
});

/**
 * @method getStateByName
 * @param name  {string}
 * @returns {null|UAObject}
 */
UAStateMachine.prototype.getStateByName = function(name) {

    var self = this;
    var states = self.getStates();
    states = states.filter(function(s){ return s.browseName.name === name; });
    assert(states.length<=1);
    return states.length === 1 ? states[0] : null;
};


UAStateMachine.prototype.getTransitions = function() {

    var self = this;
    var addressSpace = self.addressSpace;

    var transitionType = addressSpace.findObjectType("TransitionType");
    var typeDef = self.typeDefinitionObj;

    var comp = getComponentFromTypeAndSubtype(typeDef);

    comp = comp.filter(function(c){
        if (!(c.typeDefinitionObj instanceof UAObjectType)) {
            return false;
        }
        return c.typeDefinitionObj.isSupertypeOf(transitionType);
    });

    return comp;

};
UAStateMachine.prototype.__defineGetter__("transitions",function() {
    return this.getTransitions();
});

/**
 * return the node InitialStateType
 * @property initialState
 * @type  {UAObject}
 */
UAStateMachine.prototype.__defineGetter__("initialState", function() {
    var self = this;
    var addressSpace = self.addressSpace;

    var initialStateType = addressSpace.findObjectType("InitialStateType");
    var typeDef = self.typeDefinitionObj;

    var comp = getComponentFromTypeAndSubtype(typeDef);

    comp = comp.filter(function(c){
        return c.typeDefinitionObj === initialStateType;
    });

    // istanbul ignore next
    if (comp.length >1 ) {
        throw new Error(" More than 1 initial state in stateMachine");
    }
    return comp.length === 0 ?  null : comp[0];
});


UAStateMachine.prototype._coerceNode = function(node) {

    if (node == null) {
        return null;
    }
    var self = this;
    var addressSpace = self.addressSpace;
    var retValue = node;
    if (node instanceof BaseNode) {
        return node;
    } else if(node instanceof NodeId) {
        retValue = addressSpace.findNode(node);

    } else if (_.isString(node)) {
        retValue  = self.getStateByName(node);
    }
    if (!retValue) {
        console.log(" cannot find component with ",node ? node.toString():"null");
    }
    return retValue;
};

var UAObject = require("lib/address_space/ua_object").UAObject;

UAObject.prototype.__defineGetter__("toStateNode",function() {
    var self = this;
    var nodes = self.findReferencesAsObject("ToState",true);
    assert(nodes.length<=1);
    return nodes.length === 1 ? nodes[0] : null;
});

UAObject.prototype.__defineGetter__("fromStateNode",function() {
    var self =this;
    var nodes = self.findReferencesAsObject("FromState",true);
    assert(nodes.length<=1);
    return nodes.length === 1 ? nodes[0] : null;
});

/**
 * @method isValidTransition
 * @param toStateNode
 * @returns {boolean}
 */
UAStateMachine.prototype.isValidTransition = function(toStateNode) {
    assert(toStateNode);
    // is it legal to go from state currentState to toStateNode;
    var self = this;
    if (!self.currentStateNode) {
        return true;
    }
    var n = self.currentState.readValue();

    // to be executed there must be a transition from currentState to toState
    var transition = self.findTransitionNode(self.currentStateNode,toStateNode);
    if (!transition) {

        // istanbul ignore next
        if (doDebug) {
            console.log(" No transition from ",self.currentStateNode.browseName.toString(), " to " , toStateNode.toString());
        }
        return false;
    }
    return true;
};

/**
 * @method findTransitionNode
 * @param fromStateNode {NodeId|BaseNode|string}
 * @param toStateNode   {NodeId|BaseNode|string}
 * @returns {UAObject}
 */
UAStateMachine.prototype.findTransitionNode = function(fromStateNode,toStateNode) {

    var self = this;
    var addressSpace = self.addressSpace;

    fromStateNode = self._coerceNode(fromStateNode);
    if (!fromStateNode) { return null; }

    toStateNode = self._coerceNode(toStateNode);

    assert(fromStateNode instanceof UAObject);
    assert(toStateNode   instanceof UAObject);

    var stateType = addressSpace.findObjectType("StateType");

    assert(fromStateNode.typeDefinitionObj.isSupertypeOf(stateType));
    assert(toStateNode.typeDefinitionObj.isSupertypeOf(stateType));

    var transitions = fromStateNode.findReferencesAsObject("FromState",false);

    transitions = transitions.filter(function(transition){
        assert(transition.toStateNode instanceof UAObject);
        return transition.toStateNode === toStateNode;
    });
    if (transitions.length ===0 ) {
        // cannot find a transition from fromState to toState
        return null;
    }
    assert(transitions.length === 1);
    return transitions[0];
};

UAStateMachine.prototype.__defineGetter__("currentStateNode",function() {
    var self = this;
    return self._currentStateNode;
});

/**
 * @property currentStateNode
 * @type BaseNode
 */
UAStateMachine.prototype.__defineSetter__("currentStateNode",function(value) {
    var self = this;
    return self._currentStateNode = value;
});

/**
 * @method getCurrentState
 * @return {String}
 */
UAStateMachine.prototype.getCurrentState = function() {
    //xx self.currentState.readValue().value.value.text
    //xx self.shelvingState.currentStateNode.browseName.toString()
    var self = this;
    if (!self.currentStateNode) {
        return null;
    }
    return self.currentStateNode.browseName.toString();
};

/**
 * @method setState
 * @param toStateNode {String|false|UAObject}
 */
UAStateMachine.prototype.setState = function(toStateNode) {

    var self = this;

    if (!toStateNode) {
        self.currentStateNode = null;
        self.currentState.setValueFromSource({dataType: DataType.Null},StatusCodes.BadStateNotActive);
        return;
    }
    if (_.isString(toStateNode))  {
        var state= self.getStateByName(toStateNode);
        // istanbul ignore next
        if (!state) {
            throw new Error("Cannot find state with name "+toStateNode);
        }
        assert(state.browseName.toString() === toStateNode);
        toStateNode = state;
    }
    var fromStateNode = self.currentStateNode;

    toStateNode = self._coerceNode(toStateNode);
    assert(toStateNode instanceof UAObject);

    self.currentState.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText(toStateNode.browseName.toString())
    },StatusCodes.Good);

    self.currentStateNode = toStateNode;

    var transitionNode = self.findTransitionNode(fromStateNode,toStateNode);

    if (transitionNode) {

        //xx console.log("transitionNode ",transitionNode.toString());
        // The inherited Property SourceNode shall be filled with the NodeId of the StateMachine instance where the
        // Transition occurs. If the Transition occurs in a SubStateMachine, then the NodeId of the SubStateMachine
        // has to be used. If the Transition occurs between a StateMachine and a SubStateMachine, then the NodeId of
        // the StateMachine has to be used, independent of the direction of the Transition.
        // Transition identifies the Transition that triggered the Event.
        // FromState identifies the State before the Transition.
        // ToState identifies the State after the Transition.
        self.raiseEvent("TransitionEventType",{

            // Base EventType
            //xx nodeId:      self.nodeId,
            // TransitionEventType
            // TransitionVariableType
            "transition":    { dataType: "LocalizedText", value: transitionNode.displayName},
            "transition.id": transitionNode.transitionNumber.readValue().value,

            "fromState":     { dataType: "LocalizedText", value: fromStateNode.displayName },   // StateVariableType
            "fromState.id": fromStateNode.stateNumber.readValue().value,

            "toState":       { dataType: "LocalizedText", value: toStateNode.displayName   },    // StateVariableType
            "toState.id":    toStateNode.stateNumber.readValue().value
        });

    } else {
        if (fromStateNode && fromStateNode !== toStateNode) {
            if (doDebug)  {
                var f = fromStateNode.browseName.toString();
                var t = toStateNode.browseName.toString();
                console.log("Warning".red, " cannot raise event :  transition " + f + " to " + t + " is missing");
            }
        }
    }

    // also update executable flags on methods

    self.getMethods().forEach(function(method) {
        method._notifyAttributeChange(AttributeIds.Executable);
    });

};


exports.UAStateMachine = UAStateMachine;
