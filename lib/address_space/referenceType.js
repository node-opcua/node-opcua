"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var BaseNode = require("lib/address_space/basenode").BaseNode;
var assert  = require("better-assert");
var util = require("util");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

//xx var coerceQualifyName = require("lib/datamodel/qualified_name").coerceQualifyName;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

/**
 * @class ReferenceType
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function ReferenceType(options) {
    BaseNode.apply(this, arguments);
    this.isAbstract  = (options.isAbstract === null) ? false : options.isAbstract;
    this.symmetric   =  (options.symmetric === null) ? false : options.symmetric;
    this.inverseName = coerceLocalizedText(options.inverseName);
}
util.inherits(ReferenceType, BaseNode);
ReferenceType.prototype.nodeClass = NodeClass.ReferenceType;

/**
 *
 * @method readAttribute
 * @param attributeId {AttributeIds}
 * @return {DataValue}
 */
ReferenceType.prototype.readAttribute = function (attributeId) {

    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.Symmetric:
            options.value = { dataType: DataType.Boolean, value: this.symmetric ? true : false };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.InverseName: // LocalizedText
            options.value = { dataType: DataType.LocalizedText, value: this.inverseName  };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};
exports.ReferenceType = ReferenceType;


var tools = require("./tool_isSubTypeOf");
/**
 * returns true if self is  a sub type of baseType
 * @method isSubtypeOf
 * @param baseType {ReferenceType}
 * @return {Boolean}  true if self is a Subtype of baseType
 *
 *
 * @example
 *
 *
 */
ReferenceType.prototype.isSubtypeOf = tools.construct_isSubTypeOf(ReferenceType);

ReferenceType.prototype._slow_isSubtypeOf = tools.construct_slow_isSubTypeOf(ReferenceType);

ReferenceType.prototype.toString = function()
{
    var str = "";
    str += this.isAbstract ? "A": " ";
    str += this.symmetric  ? "S": " ";
    str += " " + this.browseName + "/" + this.inverseName.text + " ";
    str += this.nodeId.toString();
    return str;
};

exports.ReferenceType = ReferenceType;



