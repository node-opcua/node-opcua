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

var coerceQualifyName = require("../datamodel/qualified_name").coerceQualifyName;
var coerceLocalizedText = require("../datamodel/localized_text").coerceLocalizedText;
var QualifiedName = require("../datamodel/qualified_name").QualifiedName;
var LocalizedText = require("../datamodel/localized_text").LocalizedText;

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
ReferenceType.prototype.readAttribute = function (attributeId, callback) {

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
            BaseNode.prototype.readAttribute.call(this,attributeId, callback);
            return;
    }
    callback(new DataValue(options));
};
exports.ReferenceType = ReferenceType;


function _filterSubType(reference) {
    return (reference.referenceType === 'HasSubtype' && !reference.isForward);
}

/**
 * returns true if self is  a sub type of baseType
 * @method isSubtypeOf
 * @param baseType {ReferenceType}
 * @return {Boolean}  true if self is a Subtype of baseType
 */
ReferenceType.prototype._slow_isSubtypeOf =  function(baseType) {

    var referenceType = this;
    assert(referenceType instanceof ReferenceType);
    assert(baseType instanceof ReferenceType);
    assert(referenceType.__address_space);

    var subTypes =  referenceType.references.filter(_filterSubType);
    assert( subTypes.length <= 1 && " should have zero or one subtype no more");

    for (var i=0;i<subTypes.length;i++) {
        var subTypeId = subTypes[i].nodeId;
        var subType = referenceType.__address_space.findObject(subTypeId);
        if ( subType.nodeId === baseType.nodeId ) {
            return true;
        } else {
            if (subType._slow_isSubtypeOf(baseType)) {
                return true;
            }
        }
    }
    return false;
};

//  http://jsperf.com/underscore-js-memoize-refactor-test
//  http://addyosmani.com/blog/faster-javascript-memoization/

function wrap_memoize(func, hasher) {

    hasher = hasher || function(p) { return p.toString(); };

    return function memoize(param) {

        if (!this.__cache) {
            this.__cache = {};
        }
        var hash = hasher.call(this,param);
        var cache_value = this.__cache[hash];
        if (cache_value === undefined ) {
            cache_value = func.call(this,param); //custom function
            this.__cache[hash] = cache_value;
        }
        return cache_value;
    }
}

function hasher_func(e) { return  e.nodeId.value; }
ReferenceType.prototype.isSubtypeOf = wrap_memoize(ReferenceType.prototype._slow_isSubtypeOf,hasher_func);



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



