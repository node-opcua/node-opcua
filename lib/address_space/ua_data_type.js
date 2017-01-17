/**
 * @module opcua.address_space
 */
require("requirish")._(module);

const NodeClass = require("lib/datamodel/nodeclass").NodeClass;
const BaseNode = require("lib/address_space/base_node").BaseNode;
const DataValue = require("lib/datamodel/datavalue").DataValue;
const DataType = require("lib/datamodel/variant").DataType;
const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
const read_service = require("lib/services/read_service");
const AttributeIds = read_service.AttributeIds;
const NumericRange = require("lib/datamodel/numeric_range").NumericRange;

const assert = require("better-assert");
const util = require("util");
const _ = require("underscore");
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
};

UADataType.prototype.getEncodingNodeId = function (encoding_name) {
  assert(encoding_name === "Default Binary" || encoding_name === "Default XML");
    // could be binary or xml
  const refs = this.findReferences("HasEncoding", true);

  const addressSpace = this.addressSpace;

  const encoding = refs.map(ref => addressSpace.findNode(ref.nodeId))
        .filter(obj => obj.browseName.toString() === encoding_name);

  return encoding.length === 0 ? null : encoding[0];
};

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


UADataType.prototype._toString = function (str,options) {
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


UADataType.prototype._getDefinition = function () {
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
};
UADataType.prototype.install_extra_properties = () => {
    //
};


exports.UADataType = UADataType;

