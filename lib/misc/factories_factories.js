    "use strict";
/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");

var _global_factories = {};
exports.getFactory = function (type_name) {
    return _global_factories[type_name];
};

var registerFactory = function (type_name, constructor) {

    /* istanbul ignore next */
    if (exports.getFactory(type_name)) {
        throw new Error(" registerFactory  : " + type_name + " already registered");
    }
    _global_factories[type_name] = constructor;
};
exports.registerFactory = registerFactory;

/* istanbul ignore next */
exports.dump = function () {
    console.log(" dumping registered factories");
    Object.keys(_global_factories).sort().forEach(function (e) {
        console.log(" Factory ", e);
    });
    console.log(" done");
};

function callConstructor(constructor) {

    assert(_.isFunction(constructor));

    var FactoryFunction = constructor.bind.apply(constructor, arguments);

    return new FactoryFunction();
}
exports.callConstructor = callConstructor;


var getConstructor = function (expandedId) {

    if (!(expandedId && (expandedId.value in constructorMap))) {
        console.log("#getConstructor : cannot find constructor for expandedId ".red.bold, expandedId.toString());
        return null;
    }
    return constructorMap[expandedId.value];
};
exports.getConstructor = getConstructor;

exports.hasConstructor = function(expandedId) {
    if (!expandedId) { return false; }
    assert(expandedId.hasOwnProperty("value"));
    // only namespace 0 can be in constructorMap
    if (expandedId.namespace !== 0){ return false}
    return !!constructorMap[expandedId.value];
};

exports.constructObject = function (expandedNodeId) {
    var constructor = getConstructor(expandedNodeId);
    if (!constructor) { return null; }
    return callConstructor(constructor);
};

var constructorMap = {};
function register_class_definition(classname, class_constructor) {

    registerFactory(classname, class_constructor);

    var expandedNodeId = class_constructor.prototype.encodingDefaultBinary;

    /* istanbul ignore next */
    if (expandedNodeId.value in constructorMap) {
        throw new Error(" Class " + classname + " with ID " + expandedNodeId + "  already in constructorMap for  " + constructorMap[expandedNodeId.value].name);
    }
    constructorMap[expandedNodeId.value] = class_constructor;
}
exports.register_class_definition = register_class_definition;


