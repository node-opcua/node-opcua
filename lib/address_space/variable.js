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


function Variable(options) {

    BaseNode.apply(this, arguments);

    assert(this.typeDefinition.value === this.resolveNodeId("VariableType").value);

    this.value = options.value;


    this.dataType =  this.resolveNodeId(options.dataType);    // DataType (NodeId)
    this.valueRank = options.valueRank;  // UInt32
    this.arrayDimensions = options.arrayDimensions || 0;
    this.accessLevel     = options.accessLevel || 0;
    this.userAccessLevel = options.userAccessLevel || 0;

    this.minimumSamplingInterval  = options.minimumSamplingInterval;

    this.parentNodeId = options.parentNodeId;

    this.historizing = options.historizing;

    assert(this.dataType instanceof NodeId);
    assert(_.isFinite(this.minimumSamplingInterval));
    assert(_.isFinite(this.arrayDimensions));
    assert(_.isFinite(this.accessLevel));
    assert(_.isFinite(this.userAccessLevel));
}


util.inherits(Variable, BaseNode);
Variable.prototype.nodeClass = NodeClass.Variable;


Variable.prototype.get_variant = function() {
    if (!this.value) {
        console.log(" variable has not been bound ( node id = ", this.nodeId.toString() + " )");
        return new Variant();
    }
    assert(this.value._schema.name === "Variant");
    assert(this.value.isValid());

    return this.value;
};

Variable.prototype.readAttribute = function (attributeId) {

    var options = {};

    switch (attributeId) {
        case AttributeIds.Value:
            options.value = this.get_variant();
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            var valueRank = this.valueRank;
            options.value = { dataType: DataType.Int32, value: valueRank };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            options.value = { dataType: DataType.UInt32, value: this.arrayDimensions };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.AccessLevel:
            options.value = { dataType: DataType.Byte, value: this.accessLevel };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.UserAccessLevel:
            options.value = { dataType: DataType.Byte, value: this.userAccessLevel };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.MinimumSamplingInterval:
            if (this.minimumSamplingInterval === undefined) {
                options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            } else {
                options.value = { dataType: DataType.UInt32, value: this.minimumSamplingInterval };
                options.statusCode = StatusCodes.Good;
            }
            break;
        case AttributeIds.Historizing:
            options.value = { dataType: DataType.Boolean, value: this.historizing };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    //xx console.log("attributeId = ",attributeId); console.log((new Variant(options.value)).isValid());
    return new DataValue(options);


};

Variable.prototype.write = function(writeValue) {


    var statusCode = StatusCodes.Bad_NotWritable;
    if (this._set_func) {
        statusCode = this._set_func(writeValue.value) || StatusCodes.Bad_NotWritable;
    } else {
        this.value = writeValue.value.value;
    }
    return statusCode;
};

/**
 * bind a variable with a get and set functions
 * @param options
 */
Variable.prototype.bindVariable =function(options) {
    options = options || {};

    assert(_.isFunction(options.get));

    this._get_func =options.get;
    this._set_func =options.set;
    Object.defineProperty(this,"value",{
        get: options.get,
        set: options.set || function() {},
        enumerable: true
    });
};

exports.Variable = Variable;
