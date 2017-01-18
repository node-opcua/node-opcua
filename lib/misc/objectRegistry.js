require("requirish")._(module);
import _ from "underscore";
import assert from "better-assert";

let hashCounter = 1;
function ObjectRegistry() {
  this._cache = {};
}

ObjectRegistry.doDebug = false;

ObjectRegistry.prototype.register = function (obj) {
  if (!obj._____hash) {
    obj._____hash = hashCounter;
    hashCounter += 1;
    this._cache[obj._____hash] = obj;
  }

    // istanbul ignore next
  if (ObjectRegistry.doDebug) {
    obj._____trace = require("lib/misc/utils").trace_from_this_projet_only(new Error());
  }
};

ObjectRegistry.prototype.unregister = function (obj) {
  delete  this._cache[obj._____hash];
};

ObjectRegistry.prototype.count = function () {
  return Object.keys(this._cache).length;
};


// istanbul ignore next
ObjectRegistry.prototype.toString = function () {
  const self = this;
  let str = ` found => ${this.count()} object leaking\n`;

  _.forEach(self._cache,(obj, key) => {
    str += `${obj.constructor.name} ${obj.toString()}\n`;
  });

  if (ObjectRegistry.doDebug) {
    _.forEach(self._cache,(obj, key) => {
      var obj = self._cache[key];
      assert(obj.hasOwnProperty("_____trace"));
      str += `   ${key}${obj._____trace}\n`;
    });
  }
  return str;
};

export {ObjectRegistry};
