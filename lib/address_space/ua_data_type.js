"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var BaseNode = require("lib/address_space/base_node").BaseNode;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");
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
            options.value = {dataType: DataType.Boolean, value: this.isAbstract ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
};

UADataType.prototype.getEncodingNodeId = function (encoding_name) {

    assert(encoding_name === "Default Binary" || encoding_name === "Default XML");
    // could be binary or xml
    var refs = this.findReferences("HasEncoding", true);

    var addressSpace = this.__address_space;

    var encoding = refs.map(function (ref) {
        return addressSpace.findNode(ref.nodeId);
    }).
        filter(function (obj) {
            return obj.browseName.toString() === encoding_name;
        });

    return encoding.length === 0 ? null : encoding[0];
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


var tools = require("./tool_isSupertypeOf");
/**
 * returns true if self is a super type of baseType
 * @method isSupertypeOf
 * @param  baseType {UADataType}
 * @return {Boolean}  true if self is a Subtype of baseType
 *
 *
 * @example
 *
 *    var dataTypeDouble = addressSpace.findDataType("Double");
 *    var dataTypeNumber = addressSpace.findDataType("Number");
 *    assert(dataTypeDouble.isSupertypeOf(dataTypeNumber));
 *    assert(!dataTypeNumber.isSupertypeOf(dataTypeDouble));
 *
 */
UADataType.prototype.isSupertypeOf = tools.construct_isSupertypeOf(UADataType);


UADataType.prototype.nodeClass = NodeClass.DataType;


UADataType.prototype._toString = function(str,options)
{
    var self = this;
    BaseNode.prototype._toString.call(self,str,options);
    options.add(options.padding + "          binaryEncodingNodeId: ".yellow +
        (self.binaryEncodingNodeId ? self.binaryEncodingNodeId.toString() : "" ));
    options.add(options.padding + "          xmlEncodingNodeId   : ".yellow +
        (self.xmlEncodingNodeId ? self.xmlEncodingNodeId.toString() : "" ));

    if (self.subtypeOfObj) {
        options.add(options.padding + "          subtypeOfObj       : ".yellow +
            (self.subtypeOfObj ? self.subtypeOfObj.browseName.toString() : "" ));

    }
};
/**
 * @property binaryEncoding
 * @type {BaseNode}
 */
UADataType.prototype.__defineGetter__("binaryEncoding", function () {

    if (!this._cache.binaryEncodingNode) {
        this._cache.binaryEncodingNode = this.__findReferenceWithBrowseName("HasEncoding","Default Binary");
    }
    return this._cache.binaryEncodingNode;
});


/**
 * @property binaryEncodingDefinition
 * @type {String}
 */
UADataType.prototype.__defineGetter__("binaryEncodingDefinition", function () {
    var indexRange = new NumericRange("0:16777215");
    var descriptionNode = this.binaryEncoding.findReferencesAsObject("HasDescription")[0];
    var structureVar    = descriptionNode.findReferencesAsObject("HasComponent",false)[0];
    return structureVar.readValue(indexRange).value.value.toString();
});

/**
 * @property xmlEncoding
 * @type {BaseNode}
 */
UADataType.prototype.__defineGetter__("xmlEncoding", function () {

    if (!this._cache.xmlEncodingNode) {
        this._cache.xmlEncodingNode = this.__findReferenceWithBrowseName("HasEncoding","Default XML");
    }
    return this._cache.xmlEncodingNode;
});

/**
 * @property binaryEncodingDefinition
 * @type {String}
 */
UADataType.prototype.__defineGetter__("xmlEncodingDefinition", function () {

    var indexRange = new NumericRange("0:16777215");
    var descriptionNode = this.xmlEncoding.findReferencesAsObject("HasDescription")[0];
    var structureVar    = descriptionNode.findReferencesAsObject("HasComponent",false)[0];
    return structureVar.readValue(indexRange).value.value.toString();
});


UADataType.prototype._getDefinition = function () {

    var self = this;
    var definition = [];
    if (self.enumStrings) {
        var enumStrings = self.enumStrings.readValue().value.value;
        assert(_.isArray(enumStrings));
        definition = enumStrings.map(function(e,index){
            return {
                value: index,
                name: e.text
            };
        });
    } else if (self.enumValues) {
        assert(self.enumValues,"must have a enumValues property");
        var enumValues = self.enumValues.readValue().value.value;
        assert(_.isArray(enumValues));
        definition = _.map(enumValues,function(e) {
            return { name: e.displayName.text, value: e.value[1]};
        });
    }

    // construct nameIndex and valueIndex
    var indexes = {
        nameIndex: {},
        valueIndex: {}
    };
    definition.forEach(function(e){
        indexes.nameIndex[e.name]   =e;
        indexes.valueIndex[e.value] =e;
    });
    return indexes;
};


exports.UADataType = UADataType;

