"use strict";
/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */

var assert = require("better-assert");
var _ = require("underscore");

var factories = {};
exports.getFactory = function(type_name) {
    return factories[type_name];
};

var registerFactory = function(type_name,constructor) {

    if(exports.getFactory(type_name)) {
        throw new Error(" registerFactory  : " + type_name + " already registered");
    }
    factories[type_name] = constructor;
};
exports.registerFactory = registerFactory;


function callConstructor(constructor) {

    assert(_.isFunction(constructor));

    var factoryFunction = constructor.bind.apply(constructor, arguments);

    return new factoryFunction();
}
exports.callConstructor = callConstructor;

/*
exports.constructObject = function(type_name,options){

    _constructor = factories[type_name];
    return callConstructor(_constructor, options);
};
*/

var getConstructor = function (expandedId) {
    if (!(expandedId && (expandedId.value in constructorMap))) {
        console.log( "cannot find constructor for expandedId ".red.bold);
        console.log(expandedId);
    }
    return constructorMap[expandedId.value];
};

exports.constructObject = function (expandedNodeId) {
    var constructor = getConstructor(expandedNodeId);
    if (!constructor) return null;
    return new constructor();
};

var constructorMap = {};
function register_class_definition(classname,class_constructor) {

    registerFactory(classname,class_constructor);

    var expandedNodeId =class_constructor.prototype.encodingDefaultBinary;
    if (expandedNodeId.value in constructorMap) {
        throw new Error(" Class " + classname + " with ID " + expandedNodeId +"  already in constructorMap for  " + constructorMap[expandedNodeId.value].name);
    }
    constructorMap[expandedNodeId.value] = class_constructor;
}
exports.register_class_definition = register_class_definition;


exports._private = { factories : factories };

