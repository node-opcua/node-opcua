/**
 * @module opcua.address_space
 */


var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var NodeId = require("../datamodel/nodeid").NodeId;
var makeNodeId  = require("../datamodel/nodeid").makeNodeId;
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;
var s = require("../datamodel/structures");


var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var read_service = require("../services/read_service");
var AttributeIds = read_service.AttributeIds;

var browse_service = require("../services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../misc/utils").dumpIf;


var BaseNode = require("./basenode").BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;



function Method(options) {

    BaseNode.apply(this, arguments);
    // assert(this.typeDefinition.value === resolveNodeId("MethodType").value);
    this.value = options.value;
}
util.inherits(Method, BaseNode);
Method.prototype.nodeClass = NodeClass.Method;

Method.prototype.readAttribute = function (attributeId) {

    var options = {};
    switch (attributeId) {
        case AttributeIds.Executable:
            console.log(" warning Executable not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.BadAttributeIdInvalid;
            break;
        case AttributeIds.UserExecutable:
            console.log(" warning UserExecutable not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.BadAttributeIdInvalid;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

exports.Method = Method;
