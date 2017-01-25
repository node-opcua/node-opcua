/**
 * @module opcua.address_space
 */

import { NodeClass } from "lib/datamodel/nodeclass";
import { BaseNode } from "lib/address_space/base_node";
import { DataValue } from "lib/datamodel/datavalue";
import { DataType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { AttributeIds } from "lib/services/read_service";
import { NumericRange } from "lib/datamodel/numeric_range";
import assert from "better-assert";
import util from "util";
import _ from "underscore";

import { construct_isSupertypeOf } from "./tool_isSupertypeOf";
/**
 * @class UADataType
 * @extends  BaseNode
 * @param {Object} options
 * @param {Object} options.definition_name
 * @param {Object[]} options.definition
 *
 * @constructor
 */
class UADataType extends BaseNode {
  constructor(options) {
    super(...arguments);
    
    this.definition_name = options.definition_name || "<UNKNOWN>";
    this.definition = options.definition || [];

    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
  }

  readAttribute(attributeId) {
    const options = {};
    switch (attributeId) {
      case AttributeIds.IsAbstract:
        options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
        options.statusCode = StatusCodes.Good;
        break;
      default:
        return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
  }

  getEncodingNodeId(encoding_name) {
    assert(encoding_name === "Default Binary" || encoding_name === "Default XML");
      // could be binary or xml
    const refs = this.findReferences("HasEncoding", true);

    const addressSpace = this.addressSpace;

    const encoding = refs.map(ref => addressSpace.findNode(ref.nodeId))
          .filter(obj => obj.browseName.toString() === encoding_name);

    return encoding.length === 0 ? null : encoding[0];
  }

  _toString(str, options) {
    const self = this;
    BaseNode.prototype._toString.call(self,str,options);
    options.add(options.padding + "          binaryEncodingNodeId: ".yellow +
          (self.binaryEncodingNodeId ? self.binaryEncodingNodeId.toString() : ""));
    options.add(options.padding + "          xmlEncodingNodeId   : ".yellow +
          (self.xmlEncodingNodeId ? self.xmlEncodingNodeId.toString() : ""));

    if (self.subtypeOfObj) {
      options.add(options.padding + "          subtypeOfObj       : ".yellow +
              (self.subtypeOfObj ? self.subtypeOfObj.browseName.toString() : ""));
    }
  }

  _getDefinition() {
    const self = this;
    let definition = [];
    if (self.enumStrings) {
      const enumStrings = self.enumStrings.readValue().value.value;
      assert(_.isArray(enumStrings));
      definition = enumStrings.map((e, index) => ({
        value: index,
        name: e.text
      }));
    } else if (self.enumValues) {
      assert(self.enumValues,"must have a enumValues property");
      const enumValues = self.enumValues.readValue().value.value;
      assert(_.isArray(enumValues));
      definition = _.map(enumValues,e => ({
        name: e.displayName.text,
        value: e.value[1]
      }));
    }

      // construct nameIndex and valueIndex
    const indexes = {
      nameIndex: {},
      valueIndex: {}
    };
    definition.forEach((e) => {
      indexes.nameIndex[e.name]   = e;
      indexes.valueIndex[e.value] = e;
    });
    return indexes;
  }

  install_extra_properties() {
      //
  }
}

/**
 * returns the encoding of this node's
 * @property hasEncoding {NodeId}
 * TODO objects have 2 encodings : XML and Binaries
 */
UADataType.prototype.__defineGetter__("binaryEncodingNodeId", function () {
  if (!this._cache.binaryEncodingNodeId) {
    const encoding = this.getEncodingNodeId("Default Binary");
    this._cache.binaryEncodingNodeId = encoding ? encoding.nodeId : null;
  }
  return this._cache.binaryEncodingNodeId;
});


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
UADataType.prototype.isSupertypeOf = construct_isSupertypeOf(UADataType);


UADataType.prototype.nodeClass = NodeClass.DataType;


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
  const indexRange = new NumericRange();
  const descriptionNode = this.binaryEncoding.findReferencesAsObject("HasDescription")[0];
  const structureVar    = descriptionNode.findReferencesAsObject("HasComponent",false)[0];
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
  const indexRange = new NumericRange();
  const descriptionNode = this.xmlEncoding.findReferencesAsObject("HasDescription")[0];
  const structureVar    = descriptionNode.findReferencesAsObject("HasComponent",false)[0];
  return structureVar.readValue(indexRange).value.value.toString();
});


export { UADataType };

