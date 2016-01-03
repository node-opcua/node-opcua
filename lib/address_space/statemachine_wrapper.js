"use strict";
require("requirish")._(module);
var schema_helpers = require("lib/misc/factories_schema_helpers");
schema_helpers.doDebug = true;

var opcua = require("../..");
var path = require("path");
var assert = require("better-assert");
var _ = require("underscore");

var NodeId              = opcua.NodeId;
var DataType            = opcua.DataType;
var coerceLocalizedText = opcua.coerceLocalizedText;
var StatusCodes         = opcua.StatusCodes;

var BaseNode = require("lib/address_space/base_node").BaseNode;
var utils = require("lib/misc/utils");


/*
 *
 * UAStateMachine
 * UAStateMachine.initialState as Node
 *
 */
function UAStateMachine(node) {
    var self = this;
    self.node = node;
    var addressSpace = self.node.__address_space;
    var finiteStateMachineType = addressSpace.findObjectType("FiniteStateMachineType");
    assert(finiteStateMachineType.browseName.toString() === "FiniteStateMachineType");

    assert(node.typeDefinitionObj&&!node.subtypeOfObj);
    assert(!node.typeDefinitionObj || node.typeDefinitionObj.isSupertypeOf(finiteStateMachineType));
}

UAStateMachine.prototype.getStates = function() {

    var self = this;
    var addressSpace = self.node.__address_space;

    var initialStateType = addressSpace.findObjectType("InitialStateType");
    var stateType        = addressSpace.findObjectType("StateType");

    var typeDef = self.node.typeDefinitionObj;

    var comp = typeDef.getComponents();

    comp = comp.filter(function(c){
        return c.typeDefinitionObj.isSupertypeOf(stateType);
    });

    return comp;
};

UAStateMachine.prototype.__defineGetter__("states",function() {
    return this.getStates();
});

UAStateMachine.prototype.getStateByName = function(name) {

    var self = this;
    var states = self.getStates();
    states = states.filter(function(s){ return s.browseName.name === name; });
    assert(states.length<=1);
    return states.length === 1 ? states[0] : null;
};


UAStateMachine.prototype.getTransitions = function() {

    var self = this;
    var addressSpace = self.node.__address_space;

    var transitionType = addressSpace.findObjectType("TransitionType");
    var typeDef = self.node.typeDefinitionObj;

    var comp = typeDef.getComponents();

    comp = comp.filter(function(c){
        return c.typeDefinitionObj.isSupertypeOf(transitionType);
    });

    return comp;

};
UAStateMachine.prototype.__defineGetter__("transitions",function() {
    return this.getTransitions();
});

/**
 * return the node InitialStateType
 */
UAStateMachine.prototype.__defineGetter__("initialState", function() {
    var self = this;
    var addressSpace = self.node.__address_space;

    var initialStateType = addressSpace.findObjectType("InitialStateType");
    var typeDef = self.node.typeDefinitionObj;

    var comp = typeDef.getComponents();

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

    var self = this;
    var addressSpace = self.node.__address_space;
    if (node instanceof BaseNode) {
        return node;
    } else if(node instanceof NodeId) {
        node = addressSpace.findNode(node);

    } else if (_.isString(node)) {
        node  = self.node.getComponentByName(node);
    }
    return node;
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

UAStateMachine.prototype.findTransitionNode = function(fromStateNode,toStateNode) {

    var self = this;
    var addressSpace = self.node.__address_space;

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

UAStateMachine.prototype.setState = function(toStateNode) {

    var self = this;
    if (!toStateNode) {
        self._currentStateNode = null;
        self.node.currentState.setValueFromSource({dataType: DataType.Null},StatusCodes.BadStateNotActive);
        return;
    }

    var fromStateNode = self.currentStateNode;

    toStateNode = self._coerceNode(toStateNode);

    self.node.currentState.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText(toStateNode.browseName.toString())
    },StatusCodes.Good);

    self._currentStateNode = toStateNode;

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
        self.node.raiseEvent("TransitionEventType",{

            // Base EventType
            //xx nodeId:      self.node.nodeId,

            // TransitionEventType
            // TransitionVariableType
            transition: { dataType: "LocalizedText", value: transitionNode.displayName},
            //xx"transition.id": { dataType: "LocalizedText", value: transitionNode.displayName},
            fromState:  { dataType: "LocalizedText", value: fromStateNode.displayName },   // StateVariableType
            toState:    { dataType: "LocalizedText", value: toStateNode.displayName   }    // StateVariableType
        });

    } else {
        if (fromStateNode && fromStateNode !== toStateNode) {
            var f = fromStateNode.browseName.toString();
            var t = toStateNode.browseName.toString();
            console.log("Warning".red, " cannot raise event :  transition " + f + " to " + t + " is missing");
        }
    }
};

exports.UAStateMachine = UAStateMachine;
