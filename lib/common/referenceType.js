var BaseNode = require("./basenode").BaseNode;
var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../utils").dumpIf;
var NodeClass = require("../../lib/browse_service").NodeClass;
var NodeId = require("../../lib/nodeid").NodeId;
var DataValue = require("../datavalue").DataValue;
var Variant = require("../variant").Variant;
var DataType = require("../variant").DataType;
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var read_service = require("../../lib/read_service");
var AttributeIds = read_service.AttributeIds;

var s = require("../../lib/structures");
var coerceQualifyName = s.coerceQualifyName;
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
 * @param referenceType
 * @param baseType
 * @returns true if self is a Subtype of baseType
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