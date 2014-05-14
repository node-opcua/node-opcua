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
 *
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
 * @param attributeId {AttributeIds}
 * @returns {DataValue}
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
 *
 * @param baseType {ReferenceType}
 * @returns {Boolean}  true if self is a Subtype of baseType
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
exports.ReferenceType = ReferenceType;