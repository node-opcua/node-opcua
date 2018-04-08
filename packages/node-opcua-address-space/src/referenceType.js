"use strict";

/**
 * @module opcua.address_space
 */

const assert = require("node-opcua-assert").assert;
const util = require("util");

const BaseNode = require("./base_node").BaseNode;
const NodeClass = require("node-opcua-data-model").NodeClass;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const DataValue =  require("node-opcua-data-value").DataValue;
const DataType = require("node-opcua-variant").DataType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const SessionContext = require("./session_context").SessionContext;

const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;

let ReferenceTypeCounter=0;


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

    const options = {};
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


const tools = require("./tool_isSupertypeOf");
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
    let str = "";
    str += this.isAbstract ? "A" : " ";
    str += this.symmetric ? "S" : " ";
    str += " " + this.browseName.toString() + "/" + this.inverseName.text + " ";
    str += this.nodeId.toString();
    return str;
};


function findAllSubTypes(referenceType) {

    const addressSpace = referenceType.addressSpace;
    const possibleReferenceTypes = [];

    function _findAllSubType(referenceType) {
        possibleReferenceTypes.push(referenceType);
        assert(referenceType.nodeClass === NodeClass.ReferenceType);
        const references = referenceType.findReferences("HasSubtype", true);
        references.forEach(function (_r) {
            const subType = addressSpace.findNode(_r.nodeId);
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

    const _cache = BaseNode._getCache(this);

    if (!_cache._allSubTypesVersion || _cache._allSubTypesVersion < ReferenceTypeCounter) {

        _cache._allSubTypes = null;
    }
    if (!_cache._allSubTypes) {
        _cache._allSubTypes = findAllSubTypes(this);
        _cache._allSubTypesVersion = ReferenceTypeCounter;
    }
    return _cache._allSubTypes;
};
function _get_idx(referenceType)  {

    const possibleReferenceTypes = referenceType.getAllSubtypes();
    // create a index of reference type with browseName as key for faster search
    const keys = {};
    possibleReferenceTypes.forEach(function(refType){
        keys[refType.browseName.toString()]= refType;
    });

    return keys;
}
ReferenceType.prototype.getSubtypeIndex = function() {

    const _cache = BaseNode._getCache(this);

    if (_cache._subtype_idxVersion < ReferenceTypeCounter) {
        _cache._subtype_idx = null;
    } else {
    }
    if (!_cache._subtype_idx) {
        _cache._subtype_idx = _get_idx(this);
        _cache._subtype_idxVersion = ReferenceTypeCounter;
    }
    return _cache._subtype_idx;

};

ReferenceType.prototype.is = function(referenceTypeString) {
    return this.getSubtypeIndex().hasOwnProperty(referenceTypeString);
};

ReferenceType.prototype.install_extra_properties = function () {
    //
};

exports.ReferenceType = ReferenceType;



