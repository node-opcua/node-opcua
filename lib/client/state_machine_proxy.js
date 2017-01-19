require("requirish")._(module);

import async from "async";
import assert from "better-assert";
import { EventEmitter } from "events";
import util from "util";

/**
 * @module opcua.client
 */


import { UAProxyManager } from "./proxy";

import { makeRefId } from "./proxy";

class UAStateMachineProxy extends EventEmitter {
  constructor(proxyManager, nodeId, reference) {
    super();
    const self = this;
    self.nodeId = nodeId;
    self.proxyManager = proxyManager;
    assert(self.proxyManager.session, "expecting valid session");
    Object.defineProperty(self, "proxyManager", {
      enumerable: false,
      writable: true
    });
  }
}

//
// var browsePath = [{
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
// }];

class ProxyState {
  constructor(proxyNode) {
    const self = this;
    Object.defineProperty(this, "_node", { value: proxyNode, enumerable: false });
      // xx self._node = proxyNode;
  }

  get browseName() {
    const self = this;
    return self._node.browseName.toString();
  }

  toString() {
    return `state ${this.browseName} stateNumber :${this.stateNumber.toString()}`;
  }
  // xx ProxyState.prototype.__defineGetter__("name",function() {
// xx     var self = this;
// xx     return self._node.browseName.toString();
// xx });
  get stateNumber() {
      // note stateNumber has no real dataValue
    const self = this;
    return self._node.stateNumber.nodeId.value.toString();
  }

  get nodeId() {
      // note stateNumber has no real dataValue
    const self = this;
    return self._node.nodeId;
  }

}


Object.defineProperty(ProxyState.prototype, "stateNumber", { hidden: false, enumerable: true });

function makeProxyState(node) {
  const ret = new ProxyState(node);
  return ret;
}

class ProxyTransition {
  constructor(proxyNode) {
    const self = this;
    Object.defineProperty(this, "_node", { value: proxyNode, enumerable: false });
      // xx self._node = proxyNode;
  }

  get browseName() {
    const self = this;
    return self._node.browseName.toString();
  }
  get nodeId() {
      // note stateNumber has no real dataValue
    const self = this;
    return self._node.nodeId.value.toString();
  }


  get fromStateNode() {
    const self = this;
    return self._node.$fromState;
  }
  get toStateNode() {
    const self = this;
    return self._node.$toState;
  }

}


function makeProxyTransition(node) {
  return new ProxyTransition(node);
}

function UAStateMachineType(obj) {
  const self = this;


  const local_initialState = obj.$components.filter((component) => {
    if (!component.typeDefinition) { return false; }
    return component.typeDefinition.toString() === "InitialStateType";
  });

  if (local_initialState.length) {
    assert(local_initialState.length === 1);
    self.initialState = new ProxyState(local_initialState[0]);
  }

  self.states = obj.$components.filter((component) => {
    if (!component.typeDefinition) { return false; }
    return component.typeDefinition.toString() === "StateType";
  }).map(makeProxyState);

  self.transitions = obj.$components.filter((component) => {
    if (!component.typeDefinition) { return false; }
    return component.typeDefinition.toString() === "TransitionType";
  }).map(makeProxyTransition);
}


UAProxyManager.prototype.getStateMachineType = function (nodeId, callback) {
  if (typeof nodeId === "string") {
    const org_nodeId = nodeId;
    nodeId = makeRefId(nodeId);
  }
  const self = this;

  self.getObject(nodeId, (err, obj) => {
        // read fromState and toState Reference on
    let stateMachineType;
    if (!err) {
      stateMachineType = new UAStateMachineType(obj);
    }
    callback(err, stateMachineType);
  });

    // var initialStateTypeId = makeRefId("InitialStateType");
    //
    // var initialStateType = addressSpace.findObjectType("InitialStateType");
    // should(!!initialStateType).eql(true);
    //
    // var stateType = addressSpace.findObjectType("StateType");
    // should(!!stateType).eql(true);
    //
    // var transitionType = addressSpace.findObjectType("TransitionType");
    // should(!!transitionType).eql(true);
};

export { UAProxyManager };
