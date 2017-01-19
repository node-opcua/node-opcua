/**
 * @module opcua.address_space
 */
require("requirish")._(module);

import {BaseNode} from "lib/address_space/base_node";
import assert from "better-assert";
import util from "util";
import {NodeClass} from "lib/datamodel/nodeclass";
import {DataValue} from "lib/datamodel/datavalue";
import {DataType} from "lib/datamodel/variant";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import read_service from "lib/services/read_service";
import {
  construct_isSupertypeOf,
  construct_slow_isSupertypeOf
} from "./tool_isSupertypeOf";

const AttributeIds = read_service.AttributeIds;

// xx var coerceQualifyName = require("lib/datamodel/qualified_name").coerceQualifyName;
import {coerceLocalizedText} from "lib/datamodel/localized_text";

let ReferenceTypeCounter = 0;

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

  ReferenceTypeCounter += 1;
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
ReferenceType.prototype.readAttribute = function (attributeId, indexRange, dataEncoding) {
  const options = {};
  switch (attributeId) {
    case AttributeIds.IsAbstract:
      options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
      options.statusCode = StatusCodes.Good;
      break;
    case AttributeIds.Symmetric:
      options.value = { dataType: DataType.Boolean, value: !!this.symmetric };
      options.statusCode = StatusCodes.Good;
      break;
    case AttributeIds.InverseName: // LocalizedText
      options.value = { dataType: DataType.LocalizedText, value: this.inverseName };
      options.statusCode = StatusCodes.Good;
      break;
    default:
      return BaseNode.prototype.readAttribute.call(this, attributeId);
  }
  return new DataValue(options);
};
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
ReferenceType.prototype.isSupertypeOf = construct_isSupertypeOf(ReferenceType);

ReferenceType.prototype._slow_isSupertypeOf = construct_slow_isSupertypeOf(ReferenceType);

ReferenceType.prototype.toString = function () {
  let str = "";
  str += this.isAbstract ? "A" : " ";
  str += this.symmetric ? "S" : " ";
  str += ` ${this.browseName.toString()}/${this.inverseName.text} `;
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
    references.forEach((_r) => {
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
ReferenceType.prototype.getAllSubtypes = function () {
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
  const possibleReferenceTypes = referenceType.getAllSubtypes();
    // create a index of reference type with browseName as key for faster search
  const keys = {};
  possibleReferenceTypes.forEach((refType) => {
    keys[refType.browseName.toString()] = refType;
  });

  return keys;
}
ReferenceType.prototype.getSubtypeIndex = function () {
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

ReferenceType.prototype.is = function (referenceTypeString) {
  return this.getSubtypeIndex().hasOwnProperty(referenceTypeString);
};

ReferenceType.prototype.install_extra_properties = () => {
    //
};

export {ReferenceType};

