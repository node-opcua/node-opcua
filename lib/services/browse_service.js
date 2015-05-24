"use strict";
/**
 * @module services.browse
 */
require("requirish")._(module);
var Enum = require("lib/misc/enum");

// Specifies the NodeClasses of the TargetNodes. Only TargetNodes with the
// selected NodeClasses are returned. The NodeClasses are assigned the
// following bits:
// If set to zero, then all NodeClasses are returned.
// @example
//    var mask = NodeClassMask.get("Object |  ObjectType");
//    mask.value.should.eql(1 + (1<<3));

var NodeClassMask = new Enum({
    "Object": (1 << 0),
    "Variable": (1 << 1),
    "Method": (1 << 2),
    "ObjectType": (1 << 3),
    "VariableType": (1 << 4),
    "ReferenceType": (1 << 5),
    "DataType": (1 << 6),
    "View": (1 << 7)
});
exports.NodeClassMask = NodeClassMask;

// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
exports.makeNodeClassMask = function (str) {
    var classMask =NodeClassMask.get(str);
    /* istanbul ignore next */
    if (!classMask) {
        throw new Error(" cannot find class mask for " + str);
    }
    return classMask.value;
};


// Specifies the fields in the ReferenceDescription structure that should be
// returned. The fields are assigned the following bits:
var ResultMask = require("schemas/ResultMask_enum").ResultMask;
// The ReferenceDescription type is defined in 7.24.
// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
exports.makeResultMask = function (str) {
    return ResultMask.get(str).value;
};

// var ViewDescription  = require("_generated_/_auto_generated_ViewDescription").ViewDescription;

exports.BrowseDirection = require("schemas/BrowseDirection_enum").BrowseDirection;

exports.ReferenceDescription =  require("_generated_/_auto_generated_ReferenceDescription").ReferenceDescription;
exports.BrowseResult         =  require("_generated_/_auto_generated_BrowseResult").BrowseResult;
exports.BrowseDescription    =  require("_generated_/_auto_generated_BrowseDescription").BrowseDescription;
exports.BrowseRequest        =  require("_generated_/_auto_generated_BrowseRequest").BrowseRequest;
exports.BrowseResponse       =  require("_generated_/_auto_generated_BrowseResponse").BrowseResponse;
// var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

exports.BrowseNextRequest    =  require("_generated_/_auto_generated_BrowseNextRequest").BrowseNextRequest;
exports.BrowseNextResponse   =  require("_generated_/_auto_generated_BrowseNextResponse").BrowseNextResponse;

exports.RegisterNodesRequest = require("_generated_/_auto_generated_RegisterNodesRequest").RegisterNodesRequest;
exports.RegisterNodesResponse= require("_generated_/_auto_generated_RegisterNodesResponse").RegisterNodesResponse;
exports.UnregisterNodesRequest = require("_generated_/_auto_generated_UnregisterNodesRequest").UnregisterNodesRequest;
exports.UnregisterNodesResponse= require("_generated_/_auto_generated_UnregisterNodesResponse").UnregisterNodesResponse;