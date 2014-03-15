var NodeClass = require("../../lib/browse_service").NodeClass;
var NodeId = require("../../lib/nodeid").NodeId;
var makeNodeId  = require("../../lib/nodeid").makeNodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var s = require("../../lib/structures");


var DataValue = require("../datavalue").DataValue;
var Variant = require("../variant").Variant;
var DataType = require("../variant").DataType;
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var read_service = require("../../lib/read_service");
var AttributeIds = read_service.AttributeIds;

var browse_service = require("../../lib/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../utils").dumpIf;


var BaseNode = require("./basenode").BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;

/**
 *
 * @param options
 * @constructor
 */
function ObjectType(options) {
    BaseNode.apply(this, arguments);
    //
    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
}
util.inherits(ObjectType, BaseNode);
ObjectType.prototype.nodeClass = NodeClass.ObjectType;

ObjectType.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

exports.ObjectType = ObjectType;
