"use strict";

/**
 * @module opcua.address_space
 */

var assert = require("node-opcua-assert");
var util = require("util");

var BaseNode = require("./base_node").BaseNode;
var NodeClass = require("node-opcua-data-model").NodeClass;
var AttributeIds = require("node-opcua-data-model").AttributeIds;
var DataValue =  require("node-opcua-data-value").DataValue;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;

var SessionContext = require("./session_context").SessionContext;

var coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;

var ReferenceTypeCounter=0;

/**
 * @class ReferenceType
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function ReferenceType(options) {
    BaseNode.apply(this, arguments);
    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
    this.symmetric = (options.symmetric === null) ? false : options.symmetric;
    this.inverseName = coerceLocalizedText(options.inverseName);

    ReferenceTypeCounter +=1;
    
}
util.inherits(ReferenceType, BaseNode);
ReferenceType.prototype.nodeClass = NodeClass.ReferenceType;

/**
 *
 * @method readAttribute
 * @param attributeId {AttributeIds}
 * @param [indexRange {NumericalRange}]
 * @param [dataEncoding {String}]
 * @return {DataValue}
 */
ReferenceType.prototype.readAttribute = function (context, attributeId, indexRange, dataEncoding) {

    assert(context instanceof SessionContext);

    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = {dataType: DataType.Boolean, value: this.isAbstract ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.Symmetric:
            options.value = {dataType: DataType.Boolean, value: this.symmetric ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.InverseName: // LocalizedText
            options.value = {dataType: DataType.LocalizedText, value: this.inverseName};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }
    return new DataValue(options);
};
exports.ReferenceType = ReferenceType;


var tools = require("./tool_isSupertypeOf");
/**
 * returns true if self is  a super type of baseType
 * @method isSupertypeOf
 * @param baseType {ReferenceType}
 * @return {Boolean}  true if self is a Subtype of baseType
 *
 *
 * @example
 *
 *
 */
ReferenceType.prototype.isSupertypeOf = tools.construct_isSupertypeOf(ReferenceType);

ReferenceType.prototype._slow_isSupertypeOf = tools.construct_slow_isSupertypeOf(ReferenceType);

ReferenceType.prototype.toString = function () {
    var str = "";
    str += this.isAbstract ? "A" : " ";
    str += this.symmetric ? "S" : " ";
    str += " " + this.browseName.toString() + "/" + this.inverseName.text + " ";
    str += this.nodeId.toString();
    return str;
};


function findAllSubTypes(referenceType) {

    var addressSpace = referenceType.addressSpace;
    var possibleReferenceTypes = [];

    function _findAllSubType(referenceType) {
        possibleReferenceTypes.push(referenceType);
        assert(referenceType.nodeClass === NodeClass.ReferenceType);
        var references = referenceType.findReferences("HasSubtype", true);
        references.forEach(function (_r) {
            var subType = addressSpace.findNode(_r.nodeId);
            _findAllSubType(subType);
        });
    }
    _findAllSubType(referenceType);

    return possibleReferenceTypes;
}

/**
 * returns a array of all ReferenceTypes in the addressSpace that are self or a subType of self
 * @method getAllSubtypes
 * @return {ReferenceType[]}
 */
ReferenceType.prototype.getAllSubtypes = function() {

    if (!this._cache._allSubTypesVersion || this._cache._allSubTypesVersion < ReferenceTypeCounter) {

        this._cache._allSubTypes = null;
    }
    if (!this._cache._allSubTypes) {
        this._cache._allSubTypes = findAllSubTypes(this);
        this._cache._allSubTypesVersion = ReferenceTypeCounter;
    }
    return this._cache._allSubTypes;
};
function _get_idx(referenceType)  {

    var possibleReferenceTypes = referenceType.getAllSubtypes();
    // create a index of reference type with browseName as key for faster search
    var keys = {};
    possibleReferenceTypes.forEach(function(refType){
        keys[refType.browseName.toString()]= refType;
    });

    return keys;
}
ReferenceType.prototype.getSubtypeIndex = function() {
    if (this._cache._subtype_idxVersion < ReferenceTypeCounter) {
        this._cache._subtype_idx = null;
    } else {
    }
    if (!this._cache._subtype_idx) {
        this._cache._subtype_idx = _get_idx(this);
        this._cache._subtype_idxVersion = ReferenceTypeCounter;
    }
    return this._cache._subtype_idx;

};

ReferenceType.prototype.is = function(referenceTypeString) {
    return this.getSubtypeIndex().hasOwnProperty(referenceTypeString);
};

ReferenceType.prototype.install_extra_properties = function () {
    //
};

exports.ReferenceType = ReferenceType;



