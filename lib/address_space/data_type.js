"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var BaseNode = require("lib/address_space/basenode").BaseNode;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var assert  = require("better-assert");
var util = require("util");

/**
 * @class UADataType
 * @extends  BaseNode
 * @param {Object} options
 * @param {Object} options.definition_name
 * @param {Object[]} options.definition
 *
 * @constructor
 */
function UADataType(options) {

//xx    console.log(" CONSTRUCTING A DATATYPE",options);

    BaseNode.apply(this, arguments);

    this.definition_name = options.definition_name || "<UNKNOWN>";
    this.definition = options.definition || [];

    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;

}
util.inherits(UADataType, BaseNode);

UADataType.prototype.readAttribute = function (attributeId) {
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

UADataType.prototype.getEncodingNodeId = function(encoding_name) {

    assert(encoding_name ===  "Default Binary" ||  encoding_name === "Default XML");
    // could be binary or xml
    var refs = this.findReferences("HasEncoding", true);

    var address_space = this.__address_space;

    var encoding = refs.map(function(ref){return address_space.findObject(ref.nodeId); }).
        filter(function(obj){ return obj.browseName === encoding_name; });

    return encoding.length === 0 ? null: encoding[0];
};

/**
 * returns the encoding of this node's
 * @property hasEncoding {NodeId}
 * TODO objects have 2 encodings : XML and Binaries
 */
UADataType.prototype.__defineGetter__("binaryEncodingNodeId", function () {

    if (!this._cache.binaryEncodingNodeId) {

        var encoding = this.getEncodingNodeId("Default Binary");
        this._cache.binaryEncodingNodeId = encoding ? encoding.nodeId : null;
    }
    return this._cache.binaryEncodingNodeId;
});


var tools = require("./tool_isSuperTypeOf");
/**
 * returns true if self is a super type of baseType
 * @method isSupertypeOf
 * @param  baseType {UADataType}
 * @return {Boolean}  true if self is a Subtype of baseType
 *
 *
 * @example
 *
 *  var dataTypeDouble = address_space.findDataType("Double");
 *  var dataTypeNumber = address_space.findDataType("Number");
 *  assert(dataTypeDouble.isSupertypeOf(dataTypeNumber));
 *  assert(!dataTypeNumber.isSupertypeOf(dataTypeDouble));
 *
 */
UADataType.prototype.isSupertypeOf = tools.construct_isSupertypeOf(UADataType);

UADataType.prototype.nodeClass = NodeClass.DataType;
exports.UADataType = UADataType;

