require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");

var hashCounter = 1;
function ObjectRegistry() {
    this._cache = {};
}

var doDebug = false;

function get_stack() {
    var stack = (new Error()).stack.split("\n");
    return stack.slice(2, 7).join("\n");
}

ObjectRegistry.prototype.register = function (obj) {
    if (!obj._____hash) {
        obj._____hash = hashCounter;
        hashCounter += 1;
        this._cache[obj._____hash] = obj;
    }
    if (doDebug) {
        obj._____trace = require("lib/misc/utils").trace_from_this_projet_only(new Error());
    }
};

ObjectRegistry.prototype.unregister = function (obj) {
    delete  this._cache[obj._____hash];
};

ObjectRegistry.prototype.count = function () {
    return Object.keys(this._cache).length;
};
ObjectRegistry.prototype.toString = function () {

    var self = this;
    var str = " found => " + this.count() +  " object leaking\n";
    if (doDebug) {
        _.forEach(self._cache,function(obj,key){
            var obj = self._cache[key];
            assert(obj.hasOwnProperty("_____trace"));
            str += "   " + key + obj._____trace + "\n";
        });
    }
    return str;
};

exports.ObjectRegistry = ObjectRegistry;
