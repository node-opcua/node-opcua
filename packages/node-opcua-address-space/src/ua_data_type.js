"use strict";

/**
 * @module opcua.address_space
 */


const assert = require("node-opcua-assert").assert;
const util = require("util");
const _ = require("underscore");

const NodeClass = require("node-opcua-data-model").NodeClass;
const AttributeIds =  require("node-opcua-data-model").AttributeIds;


const DataValue =  require("node-opcua-data-value").DataValue;

const DataType = require("node-opcua-variant").DataType;

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const NumericRange = require("node-opcua-numeric-range").NumericRange;


const BaseNode = require("./base_node").BaseNode;
const SessionContext = require("./session_context").SessionContext;


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

UADataType.prototype.readAttribute = function (context, attributeId) {

    assert(context instanceof SessionContext);

    const options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = {dataType: DataType.Boolean, value: this.isAbstract ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }
    return new DataValue(options);
};

UADataType.prototype.getEncodingNodeId = function (encoding_name) {

    assert(encoding_name === "Default Binary" || encoding_name === "Default XML");
    // could be binary or xml
    const refs = this.findReferences("HasEncoding", true);

    const addressSpace = this.addressSpace;

    const encoding = refs.map(function (ref) {
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

    const _cache = BaseNode._getCache(this);
    if (!_cache.binaryEncodingNodeId) {

        const encoding = this.getEncodingNodeId("Default Binary");
        _cache.binaryEncodingNodeId = encoding ? encoding.nodeId : null;
    }
    return _cache.binaryEncodingNodeId;
});


const tools = require("./tool_isSupertypeOf");
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
    const self = this;
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

    const _cache = BaseNode._getCache(this);
    if (!_cache.binaryEncodingNode) {
        _cache.binaryEncodingNode = this.__findReferenceWithBrowseName("HasEncoding","Default Binary");
    }
    return _cache.binaryEncodingNode;
});


/**
 * @property binaryEncodingDefinition
 * @type {String}
 */
UADataType.prototype.__defineGetter__("binaryEncodingDefinition", function () {
    const indexRange = new NumericRange();
    const descriptionNode = this.binaryEncoding.findReferencesAsObject("HasDescription")[0];
    const structureVar    = descriptionNode.findReferencesAsObject("HasComponent",false)[0];
    const dataValue = structureVar.readValue(SessionContext.defaultContext, indexRange);
    //xx if (!dataValue || !dataValue.value || !dataValue.value.value) { return "empty";}
    return dataValue.value.value.toString();
});

/**
 * @property xmlEncoding
 * @type {BaseNode}
 */
UADataType.prototype.__defineGetter__("xmlEncoding", function () {

    const _cache = BaseNode._getCache(this);
    if (!_cache.xmlEncodingNode) {
        _cache.xmlEncodingNode = this.__findReferenceWithBrowseName("HasEncoding","Default XML");
    }
    return _cache.xmlEncodingNode;
});

/**
 * @property binaryEncodingDefinition
 * @type {String}
 */
UADataType.prototype.__defineGetter__("xmlEncodingDefinition", function () {
    const indexRange = new NumericRange();
    const descriptionNode = this.xmlEncoding.findReferencesAsObject("HasDescription")[0];
    const structureVar    = descriptionNode.findReferencesAsObject("HasComponent",false)[0];
    const dataValue = structureVar.readValue(SessionContext.defaultContext, indexRange);
    if (!dataValue || !dataValue.value || !dataValue.value.value) {
        return "empty";
    }
    return dataValue.value.value.toString();
});


UADataType.prototype._getDefinition = function () {

    const self = this;
    let definition = [];
    if (self.enumStrings) {
        const enumStrings = self.enumStrings.readValue().value.value;
        assert(_.isArray(enumStrings));
        definition = enumStrings.map(function(e,index){
            return {
                value: index,
                name: e.text
            };
        });
    } else if (self.enumValues) {
        assert(self.enumValues,"must have a enumValues property");
        const enumValues = self.enumValues.readValue().value.value;
        assert(_.isArray(enumValues));
        definition = _.map(enumValues,function(e) {
            return { name: e.displayName.text, value: e.value[1]};
        });
    }

    // construct nameIndex and valueIndex
    const indexes = {
        nameIndex: {},
        valueIndex: {}
    };
    definition.forEach(function(e){
        indexes.nameIndex[e.name]   =e;
        indexes.valueIndex[e.value] =e;
    });
    return indexes;
};
UADataType.prototype.install_extra_properties = function () {
    //
};


exports.UADataType = UADataType;

