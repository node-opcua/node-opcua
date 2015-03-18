"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;


var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");

var BaseNode = require("lib/address_space/basenode").BaseNode;


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
    this.arrayDimensions = options.arrayDimensions ||  [];
    assert(_.isArray(this.arrayDimensions));

    this.isAbstract =  this.isAbstract ? true:  false ;  // false indicates that the VariableType cannot be used  as type definition
}
util.inherits(VariableType, BaseNode);
VariableType.prototype.nodeClass = NodeClass.VariableType;

VariableType.prototype.readAttribute = function (attributeId) {
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
            assert(_.isArray(this.arrayDimensions) || this.arrayDimensions === null);
            options.value = { dataType: DataType.UInt32, arrayType: VariantArrayType.Array,  value: this.arrayDimensions };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

exports.VariableType = VariableType;

