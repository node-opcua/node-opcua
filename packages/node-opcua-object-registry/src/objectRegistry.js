"use strict";
var _ = require("underscore");
var assert = require("node-opcua-assert");
var trace_from_this_projet_only = require("node-opcua-debug").trace_from_this_projet_only;

var g_registries = [];

var hashCounter = 1;
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

    var className = this.getClassName();
    var self = this;
    var str = " className :" + className +  " found => " + this.count() +  " object leaking\n";

    _.forEach(self._cache,function(obj/*,key*/) {
        str += obj.constructor.name + " " + obj.toString()+ "\n";
    });

    if (ObjectRegistry.doDebug) {
        _.forEach(self._cache,function(obj,key){
            var cachedObject = self._cache[key];
            assert(cachedObject.hasOwnProperty("_____trace"));
            str += "   " + key + cachedObject._____trace + "\n";
        });
    }
    return str;
};

exports.ObjectRegistry = ObjectRegistry;
