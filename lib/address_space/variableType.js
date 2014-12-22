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


/**
 * @class VariableType
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function VariableType(options) {
    BaseNode.apply(this, arguments);
    //xx dumpif(!options.dataType,options);
    //xx assert(options.isAbstract || options.dataType, "dataType is mandatory if variable type is not abstract");
    this.value = options.value;          // optional default value for instances of this VariableType
    this.dataType = options.dataType;    // DataType (NodeId)
    this.valueRank = options.valueRank || 0 ;  // Int32

    // see OPC-UA part 5 : $3.7 Conventions for Node descriptions
    this.arrayDimensions = options.arrayDimensions || 0;

    this.isAbstract = options.isAbstract;  // false indicates that the VariableType cannot be used  as type definition
}
util.inherits(VariableType, BaseNode);
VariableType.prototype.nodeClass = NodeClass.VariableType;

VariableType.prototype.readAttribute = function (attributeId, callback){
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.Value:
            if (this.hasOwnProperty("value") && this.value !== undefined) {
                assert(this.value._schema.name === "Variant");
                options.value = this.value;
                options.statusCode = StatusCodes.Good;
            } else {
                console.log(" warning Value not implemented");
                options.value = { dataType: DataType.UInt32, value: 0 };
                options.statusCode = StatusCodes.BadAttributeIdInvalid;
            }
            break;
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            options.value = { dataType: DataType.Int32, value: this.valueRank };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            options.value = { dataType: DataType.UInt32, value: this.arrayDimensions };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            BaseNode.prototype.readAttribute.call(this,attributeId,callback);
            return;
    }
    callback(new DataValue(options));
};

exports.VariableType = VariableType;

