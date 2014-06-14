/**
 * @module opcua.address_space
 */
var BaseNode = require("./basenode").BaseNode;
var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../misc/utils").dumpIf;
var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var NodeId = require("../datamodel/nodeid").NodeId;
var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var read_service = require("../services/read_service");
var AttributeIds = read_service.AttributeIds;

var s = require("../datamodel/structures");
var coerceLocalizedText = s.coerceLocalizedText;

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


/**
 * returns true if self is  a sub type of baseType
 * @method isSubtypeOf
 * @param baseType {ReferenceType}
 * @return {Boolean}  true if self is a Subtype of baseType
 */
ReferenceType.prototype.isSubtypeOf =  function(baseType) {

    var referenceType = this;
    assert(referenceType instanceof ReferenceType);
    assert(baseType instanceof ReferenceType);
    assert(referenceType.__address_space);

    function filterSubType(reference) {
        return (reference.referenceType === 'HasSubtype' && !reference.isForward);
    }
    var subTypes =  referenceType.references.filter(filterSubType);

    assert( subTypes.length <= 1 && " should have zero or one subtype no more");

    for (var i=0;i<subTypes.length;i++) {
        var subTypeId = subTypes[i].nodeId;
        var subType = referenceType.__address_space.findObject(subTypeId);
        if ( subType.nodeId === baseType.nodeId ) {
            return true;
        } else {
            if (subType.isSubtypeOf(baseType)) {
                return true;
            }
        }
    }
    return false;
};

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



