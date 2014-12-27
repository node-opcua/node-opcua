/**
 * @module services.browse
 */
var Enum = require("enum");

// Specifies the NodeClasses of the TargetNodes. Only TargetNodes with the
// selected NodeClasses are returned. The NodeClasses are assigned the
// following bits:
// If set to zero, then all NodeClasses are returned.
// @example
//    var mask = NodeClassMask.get("Object |  ObjectType");
//    mask.value.should.eql(1 + (1<<3));

var NodeClassMask = new Enum({
    'Object': (1 << 0),
    'Variable': (1 << 1),
    'Method': (1 << 2),
    'ObjectType': (1 << 3),
    'VariableType': (1 << 4),
    'Reference': (1 << 5),
    'DataType': (1 << 6),
    'View': (1 << 7)
});
exports.NodeClassMask = NodeClassMask;

// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
exports.makeNodeClassMask = function (str) {
    return NodeClassMask.get(str).value;
};


// Specifies the fields in the ReferenceDescription structure that should be
// returned. The fields are assigned the following bits:
var ResultMask = new Enum({
    'ReferenceType': (1 << 0),
    'IsForward': (1 << 1),
    'NodeClass': (1 << 2),
    'BrowseName': (1 << 3),
    'DisplayName': (1 << 4),
    'TypeDefinition': (1 << 5)
});

// The ReferenceDescription type is defined in 7.24.

// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
exports.makeResultMask = function (str) {
    return ResultMask.get(str).value;
};

var ViewDescription  = require("../../_generated_/_auto_generated_ViewDescription").ViewDescription;

exports.BrowseDirection = require("../../schemas/BrowseDirection_enum").BrowseDirection;

exports.ReferenceDescription =  require("../../_generated_/_auto_generated_ReferenceDescription").ReferenceDescription;
exports.BrowseResult         =  require("../../_generated_/_auto_generated_BrowseResult").BrowseResult;
exports.BrowseDescription    =  require("../../_generated_/_auto_generated_BrowseDescription").BrowseDescription;
exports.BrowseRequest        =  require("../../_generated_/_auto_generated_BrowseRequest").BrowseRequest;
exports.BrowseResponse       =  require("../../_generated_/_auto_generated_BrowseResponse").BrowseResponse;
var NodeClass = require("../datamodel/nodeclass").NodeClass;

exports.BrowseNextRequest    =  require("../../_generated_/_auto_generated_BrowseNextRequest").BrowseNextRequest;
exports.BrowseNextResponse   =  require("../../_generated_/_auto_generated_BrowseNextResponse").BrowseNextResponse;

