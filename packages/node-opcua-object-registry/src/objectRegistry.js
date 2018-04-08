"use strict";
const _ = require("underscore");
const assert = require("node-opcua-assert").assert;
const trace_from_this_projet_only = require("node-opcua-debug").trace_from_this_projet_only;

const g_registries = [];

let hashCounter = 1;
function ObjectRegistry(objectType) {

    this._objectType = objectType;
    this._cache = {};
    g_registries.push(this);
}

ObjectRegistry.doDebug = false;

ObjectRegistry.registries = g_registries;

ObjectRegistry.prototype.getClassName = function() {
   return this._objectType ? this._objectType.name : "<???>";
};

ObjectRegistry.prototype.register = function (obj) {

    if (!this._objectType) {
        this._objectType = obj.constructor;
    }

    if (!obj._____hash) {
        obj._____hash = hashCounter;
        hashCounter += 1;
        this._cache[obj._____hash] = obj;
    }

    // istanbul ignore next
    if (ObjectRegistry.doDebug) {
        obj._____trace = trace_from_this_projet_only(new Error());
    }
};

ObjectRegistry.prototype.unregister = function (obj) {
    this._cache[obj._____hash] = null;
    delete this._cache[obj._____hash];
};

ObjectRegistry.prototype.count = function () {
    return Object.keys(this._cache).length;
};


// istanbul ignore next
ObjectRegistry.prototype.toString = function () {

    const className = this.getClassName();
    const self = this;
    let str = " className :" + className +  " found => " + this.count() +  " object leaking\n";

    _.forEach(self._cache,function(obj/*,key*/) {
        str += obj.constructor.name + " " + obj.toString()+ "\n";
    });

    if (ObjectRegistry.doDebug) {
        _.forEach(self._cache,function(obj,key){
            const cachedObject = self._cache[key];
            assert(cachedObject.hasOwnProperty("_____trace"));
            str += "   " + key + cachedObject._____trace + "\n";
        });
    }
    return str;
};

exports.ObjectRegistry = ObjectRegistry;
