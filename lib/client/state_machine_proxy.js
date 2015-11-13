"use strict";
var async = require("async");
var assert = require("better-assert");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
/**
 * @module opcua.client
 */


var UAProxyManager = require("./proxy").UAProxyManager;
var makeRefId = require("./proxy").makeRefId;

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
    return self._node.nodeId.value.toString();
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

ProxyTransition.prototype.__defineGetter__("fromState", function () {
    var self = this;
    return self._node.$fromState.nodeId.value.toString();
});
ProxyTransition.prototype.__defineGetter__("toState", function () {
    var self = this;
    return self._node.$toState.nodeId.value.toString();
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


    dumpStateMachineToGraphViz(self);
    dumpStateMachineToPlantUML(self);
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

function dumpStateMachineToPlantUML(stateMachineType) {
    function w(str) {
        console.log(str);
    }

    function s(state) {
        return state.nodeId.toString();
    }


    function n(state) {
        return state.browseName.toString();
    }
    w("@startuml " ); //+ stateMachineType.browseName.toString() + ".png");
    // initial state if any

    if (stateMachineType.initialState) {
        w(" [*] --> "+ s(stateMachineType.initialState));
        w(" " + s(stateMachineType.initialState) + ":" + n(stateMachineType.initialState));
    }else {
        w("[*] --> [*]")
    }

    function t(transition) {
        var name = n(transition);
        name = name.replace(":","");
        name = name.replace("To","\\nTo\\n");
        name = name.replace("Transition","\\nTransition");
        return name;
    }
    stateMachineType.states.forEach(function (state) {
        w(" " + s(state) + ": " + n(state));
    });

    stateMachineType.transitions.forEach(function(transition) {

        w("  " + transition.fromState + " --> " + transition.toState + " : " + t(transition));
    });

    w("@enduml");

}
/*
 @startuml

 2930: Unshelved

 2932: TimedShelved

 2933: OneShotShelved

 2930 --> 2932 :   "2935\nUnshelvedToTimedShelved"

 2930 --> 2933 :   "2936\nUnshelvedToOneShotShelved"

 2932 --> 2930 :   "2940\nTimedShelvedToUnshelved"

 2932 --> 2933 :   "2942\nTimedShelvedToOneShotShelved"

 2933 --> 2930 :   "2943\nOneShotShelvedToUnshelved"

 2933 --> 2932 :   "2945\nOneShotShelvedToTimedShelved"

 @enduml

 */
/*
 digraph finite_state_machine {
 rankdir=LR;
 size="8,5"
 node [shape = doublecircle]; LR_0 LR_3 LR_4 LR_8;
 node [shape = circle];
 LR_0 -> LR_2 [ label = "SS(B)" ];
 LR_0 -> LR_1 [ label = "SS(S)" ];
 LR_1 -> LR_3 [ label = "S($end)" ];
 LR_2 -> LR_6 [ label = "SS(b)" ];
 LR_2 -> LR_5 [ label = "SS(a)" ];
 LR_2 -> LR_4 [ label = "S(A)" ];
 LR_5 -> LR_7 [ label = "S(b)" ];
 LR_5 -> LR_5 [ label = "S(a)" ];
 LR_6 -> LR_6 [ label = "S(b)" ];
 LR_6 -> LR_5 [ label = "S(a)" ];
 LR_7 -> LR_8 [ label = "S(b)" ];
 LR_7 -> LR_5 [ label = "S(a)" ];
 LR_8 -> LR_6 [ label = "S(b)" ];
 LR_8 -> LR_5 [ label = "S(a)" ];
 }
 */
function dumpStateMachineToGraphViz(/*UAStateMachineProxy*/ stateMachineType) {

    function w(str) {
        console.log(str);
    }

    function s(state) {
        return state.nodeId.toString();
    }

    function s_full(state) {
        return s(state) + " [ label = \"" + state.browseName.toString() + "\" ]";
    }

    w("digraph finite_state_machine {");
    // initial state if any

    if (stateMachineType.initialState) {
        w("node [ shape = doublecircle];");
        w("  _" + s_full(stateMachineType.initialState) + " ;");
    }
    w("node [ shape = circle];");
    stateMachineType.states.forEach(function (state) {
        w("   _" + s_full(state));
    });

    stateMachineType.transitions.forEach(function(transition) {

        w("  _" + transition.fromState + " -> _" + transition.toState + " [ " +
            " labeltooltip = \"" + transition.nodeId.toString() + "\" " +
            ", label = \"" + transition.browseName.toString() +  "\" ];");
    });

    w("}");
}
exports.UAProxyManager = UAProxyManager;
