"use strict";
require("requirish")._(module);

var async = require("async");
var assert = require("better-assert");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
/**
 * @module opcua.client
 */


var UAProxyManager = require("./proxy").UAProxyManager;
var makeRefId = require("./proxy").makeRefId;

var dumpStateMachineToGraphViz = require("lib/misc/dump_statemachine").dumpStateMachineToGraphViz;
var dumpStateMachineToPlantUML = require("lib/misc/dump_statemachine").dumpStateMachineToPlantUML;

function UAStateMachineProxy(proxyManager, nodeId, reference) {

    var self = this;
    self.nodeId = nodeId;
    self.proxyManager = proxyManager;
    assert(self.proxyManager.session, "expecting valid session");
    Object.defineProperty(self, "proxyManager", {
        enumerable: false,
        writable: true
    });

}

util.inherits(UAStateMachineProxy, EventEmitter);

//
//var browsePath = [{
//    startingNode: /* NodeId  */ resolveNodeId("BaseObjectType"),
//    relativePath: /* RelativePath   */  {
//        elements: /* RelativePathElement */ [
//            {
//                referenceTypeId: hasPropertyRefId,
//                isInverse: false,
//                includeSubtypes: false,
//                targetName: {namespaceIndex: 0, name: "InputArguments"}
//            }
//        ]
//    }
//}];

function ProxyState(proxyNode) {
    var self = this;
    Object.defineProperty(this, "_node", {value: proxyNode, enumerable: false});
    //xx self._node = proxyNode;
}

Object.defineProperty(ProxyState.prototype, "browseName", {
    get: function () {
        var self = this;
        return self._node.browseName.toString();
    }, hidden: false, enumerable: true
});

//xx ProxyState.prototype.__defineGetter__("name",function() {
//xx     var self = this;
//xx     return self._node.browseName.toString();
//xx });
ProxyState.prototype.__defineGetter__("stateNumber", function () {
    // note stateNumber has no real dataValue
    var self = this;
    return self._node.stateNumber.nodeId.value.toString();
});

ProxyState.prototype.__defineGetter__("nodeId", function () {
    // note stateNumber has no real dataValue
    var self = this;
    return self._node.nodeId;
});



Object.defineProperty(ProxyState.prototype, "stateNumber", {hidden: false, enumerable: true});

ProxyState.prototype.toString = function () {

    return "state " + this.browseName + " stateNumber :" + this.stateNumber.toString();
};

function makeProxyState(node) {
    var ret = new ProxyState(node);
    return ret;
}

function ProxyTransition(proxyNode) {
    var self = this;
    Object.defineProperty(this, "_node", {value: proxyNode, enumerable: false});
    //xx self._node = proxyNode;
}
ProxyTransition.prototype.__defineGetter__("nodeId", function () {
    // note stateNumber has no real dataValue
    var self = this;
    return self._node.nodeId.value.toString();
});


Object.defineProperty(ProxyTransition.prototype, "browseName", {
    get: function () {
        var self = this;
        return self._node.browseName.toString();
    }, hidden: false, enumerable: true
});


ProxyTransition.prototype.__defineGetter__("fromStateNode", function () {
    var self = this;
    return self._node.$fromState;
});
ProxyTransition.prototype.__defineGetter__("toStateNode", function () {
    var self = this;
    return self._node.$toState;
});

function makeProxyTransition(node) {
    return new ProxyTransition(node);
}

function UAStateMachineType(obj) {
    var self = this;


    var local_initialState = obj.$components.filter(function (component) {
        if(!component.typeDefinition) { return false; }
        return component.typeDefinition.toString() === "InitialStateType";
    });

    if (local_initialState.length) {
        assert(local_initialState.length === 1);
        self.initialState = new ProxyState(local_initialState[0]);
    }

    self.states = obj.$components.filter(function (component) {
        if(!component.typeDefinition) { return false; }
        return component.typeDefinition.toString() === "StateType";
    }).map(makeProxyState);

    self.transitions = obj.$components.filter(function (component) {
        if(!component.typeDefinition) { return false; }
        return component.typeDefinition.toString() === "TransitionType";
    }).map(makeProxyTransition);


//xx    dumpStateMachineToGraphViz(self);
//xx    dumpStateMachineToPlantUML(self);
}


UAProxyManager.prototype.getStateMachineType = function (nodeId, callback) {


    if (typeof nodeId === "string") {
        var org_nodeId = nodeId;
        nodeId = makeRefId(nodeId);
    }
    var self = this;

    self.getObject(nodeId, function (err, obj) {

        // read fromState and toState Reference on
        var stateMachineType;
        if (!err) {
            stateMachineType = new UAStateMachineType(obj);
        }
        callback(err, stateMachineType);
    });

    //var initialStateTypeId = makeRefId("InitialStateType");
    //
    //var initialStateType = addressSpace.findObjectType("InitialStateType");
    //should(!!initialStateType).eql(true);
    //
    //var stateType = addressSpace.findObjectType("StateType");
    //should(!!stateType).eql(true);
    //
    //var transitionType = addressSpace.findObjectType("TransitionType");
    //should(!!transitionType).eql(true);


};

exports.UAProxyManager = UAProxyManager;
