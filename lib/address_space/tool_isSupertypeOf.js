import assert from "better-assert";
import _ from "underscore";

function _filterSubType(reference) {
  return (reference.referenceType === "HasSubtype" && !reference.isForward);
}
const _slow_isSupertypeOf = (self, Class, baseType) => {
    // xx console.log(" ",self.browseName, " versus ",baseType.browseName);
  assert(self instanceof Class);
  assert(baseType instanceof Class, " Object must have same type");
  assert(self.addressSpace);

  if (self.nodeId === baseType.nodeId) {
    return true;
  }
  const subTypes = _.filter(self._referenceIdx,_filterSubType);
  assert(subTypes.length <= 1 && " should have zero or one subtype no more");

  for (let i = 0; i < subTypes.length; i++) {
    const subTypeId = subTypes[i].nodeId;
    const subType = self.addressSpace.findNode(subTypeId);
        // istanbul ignore next
    if (!subType) {
      throw new Error(`Cannot find object with nodeId ${subTypeId.toString()}`);
    }
    if (subType.nodeId === baseType.nodeId) {
      return true;
    } else if (_slow_isSupertypeOf(subType, Class, baseType)) {
      return true;
    }
  }
  return false;
};

//  http://jsperf.com/underscore-js-memoize-refactor-test
//  http://addyosmani.com/blog/faster-javascript-memoization/

function wrap_memoize(func, hasher) {
  hasher = hasher || (p => p.toString());

  return function memoize(param) {
    if (!this.__cache) {
      this.__cache = {};
    }
    const hash = hasher.call(this, param);
    let cache_value = this.__cache[hash];
    if (cache_value === undefined) {
      cache_value = func.call(this, param); // custom function
      this.__cache[hash] = cache_value;
    }
    return cache_value;
  };
}

function hasher_func(e) {
  return e.nodeId.value;
}

export function construct_isSupertypeOf(Class) {
  assert(_.isFunction(Class));
  return wrap_memoize(function (baseType) {
    assert(baseType instanceof Class);
    assert(this instanceof Class);
    return _slow_isSupertypeOf(this, Class, baseType);
  }, hasher_func);
}

export function construct_slow_isSupertypeOf(Class) {
  return function (baseType) {
    return _slow_isSupertypeOf(this, Class, baseType);
  };
}
