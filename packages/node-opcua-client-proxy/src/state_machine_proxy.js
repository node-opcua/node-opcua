"use strict";


const async = require("async");
const assert = require("node-opcua-assert").assert;
const EventEmitter = require("events").EventEmitter;
const util = require("util");
/**
 * @module opcua.client
 */


const UAProxyManager = require("./proxy").UAProxyManager;
const makeRefId = require("./proxy").makeRefId;

function UAStateMachineProxy(proxyManager, nodeId, reference) {

    const self = this;
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
    const self = this;
    Object.defineProperty(this, "_node", {value: proxyNode, enumerable: false});
    //xx self._node = proxyNode;
}

Object.defineProperty(ProxyState.prototype, "browseName", {
    get: function () {
        const self = this;
        return self._node.browseName.toString();
    }, hidden: false, enumerable: true
});

//xx ProxyState.prototype.__defineGetter__("name",function() {
//xx     var self = this;
//xx     return self._node.browseName.toString();
//xx });
ProxyState.prototype.__defineGetter__("stateNumber", function () {
    // note stateNumber has no real dataValue
    const self = this;
    return self._node.stateNumber.nodeId.value.toString();
});

ProxyState.prototype.__defineGetter__("nodeId", function () {
    // note stateNumber has no real dataValue
    const self = this;
    return self._node.nodeId;
});



Object.defineProperty(ProxyState.prototype, "stateNumber", {hidden: false, enumerable: true});

ProxyState.prototype.toString = function () {

    return "state " + this.browseName + " stateNumber :" + this.stateNumber.toString();
};

function makeProxyState(node) {
    const ret = new ProxyState(node);
    return ret;
}

function ProxyTransition(proxyNode) {
    const self = this;
    Object.defineProperty(this, "_node", {value: proxyNode, enumerable: false});
    //xx self._node = proxyNode;
}
ProxyTransition.prototype.__defineGetter__("nodeId", function () {
    // note stateNumber has no real dataValue
    const self = this;
    return self._node.nodeId.value.toString();
});


Object.defineProperty(ProxyTransition.prototype, "browseName", {
    get: function () {
        const self = this;
        return self._node.browseName.toString();
    }, hidden: false, enumerable: true
});


ProxyTransition.prototype.__defineGetter__("fromStateNode", function () {
    const self = this;
    return self._node.$fromState;
});
ProxyTransition.prototype.__defineGetter__("toStateNode", function () {
    const self = this;
    return self._node.$toState;
});

function makeProxyTransition(node) {
    return new ProxyTransition(node);
}

function UAStateMachineType(obj) {
    const self = this;


    const local_initialState = obj.$components.filter(function (component) {
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
}


UAProxyManager.prototype.getStateMachineType = function (nodeId, callback) {


    if (typeof nodeId === "string") {
        const org_nodeId = nodeId;
        nodeId = makeRefId(nodeId);
    }
    const self = this;

    self.getObject(nodeId, function (err, obj) {

        // read fromState and toState Reference on
        let stateMachineType;
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
