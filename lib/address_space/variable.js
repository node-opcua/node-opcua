/*JSLint
  global  -require
 */
/**
 * @module opcua.address_space
 */

var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var NodeId = require("../datamodel/nodeid").NodeId;
var makeNodeId  = require("../datamodel/nodeid").makeNodeId;
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;
var s = require("../datamodel/structures");


var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var VariantArrayType = require("../datamodel/variant").VariantArrayType;
var NumericRange = require("../datamodel/numeric_range").NumericRange;

var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var read_service = require("../services/read_service");
var AttributeIds = read_service.AttributeIds;
var browse_service = require("../services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../misc/utils").dumpIf;


var BaseNode = require("./basenode").BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;
var AccessLevelFlag = require("../datamodel/access_level").AccessLevelFlag;
var makeAccessLevel = require("../datamodel/access_level").makeAccessLevel;

/**
 * @class Variable
 * @extends  BaseNode
 * @param options
 * @param options.value
 * @param options.browseName {string}
 * @param options.dataType   {NodeId}
 * @param options.valueRank  {Int32}
 *
 * @constructor

    The AccessLevel Attribute is used to indicate how the Value of a Variable can be accessed (read/write) and if it
    contains current and/or historic data. The AccessLevel does not take any user access rights into account,
    i.e. although the Variable is writeable this may be restricted to a certain user / user group.
    The AccessLevel is an 8-bit unsigned integer with the structure defined in the following table:

    Field	        Bit	Description
    CurrentRead	    0	Indicates if the current value is readable
                        (0 means not readable, 1 means readable).
    CurrentWrite	1	Indicates if the current value is writable
                        (0 means not writable, 1 means writable).
    HistoryRead	    2	Indicates if the history of the value is readable
                        (0 means not readable, 1 means readable).
    HistoryWrite	3	Indicates if the history of the value is writable (0 means not writable, 1 means writable).
    SemanticChange	4	Indicates if the Variable used as Property generates SemanticChangeEvents (see 9.31).
    Reserved	    5:7	Reserved for future use. Shall always be zero.
    The first two bits also indicate if a current value of this Variable is available and the second two bits
    indicates if the history of the Variable is available via the OPC UA server.

 */

function Variable(options) {

    BaseNode.apply(this, arguments);

    assert(this.typeDefinition.value === this.resolveNodeId("VariableTypeNode").value);

    this.value = options.value;


    options.accessLevel      =  options.accessLevel  || "CurrentRead | CurrentWrite";
    options.userAccessLevel  =  options.userAccessLevel  || "CurrentRead | CurrentWrite";
    options.accessLevel = makeAccessLevel(options.accessLevel) ;
    options.userAccessLevel = makeAccessLevel(options.userAccessLevel) ;


    this.dataType =  this.resolveNodeId(options.dataType);    // DataType (NodeId)
    this.valueRank = options.valueRank  || 0 ;  // UInt32
    this.arrayDimensions = options.arrayDimensions || 0;
    this.accessLevel     =  options.accessLevel ;
    this.userAccessLevel =  options.userAccessLevel;

    this.minimumSamplingInterval  = options.minimumSamplingInterval;

    this.parentNodeId = options.parentNodeId;

    this.historizing = options.historizing;

    assert(this.dataType instanceof NodeId);
    assert(_.isFinite(this.minimumSamplingInterval));
    assert(_.isFinite(this.arrayDimensions));

    assert(_.isFinite(this.accessLevel.value));
    assert(_.isFinite(this.userAccessLevel.value));
    assert(_.isString(this.browseName));
}


util.inherits(Variable, BaseNode);
Variable.prototype.nodeClass = NodeClass.Variable;

var emptyVariant = new Variant();
/**
 * @method get_variant
 * @return {Variant}
 */
Variable.prototype.get_variant = function() {

    if (!this.value) {
        console.log(" xxxx variable has not been bound ( node id = ", this.nodeId.toString() + " )" , " name : ",this.browseName);
        return null; // emptyVariant;
    }
    assert(this.value._schema.name === "Variant");
    assert(this.value.isValid());

    return this.value;
};

function is_dataEncoding(dataEncoding)  {
    return (dataEncoding != null && dataEncoding.name != null);
}
function is_valid_dataEnconding(dataEncoding) {

    if (!is_dataEncoding(dataEncoding)) { return true;}

    var valid_encoding = ["DefaultBinary" , "DefaultXml"];
    if (valid_encoding.indexOf(is_dataEncoding.name) === -1 ) {
        return false;
    }
    return true;
}
Variable.prototype.readAttribute = function(attributeId, indexRange, dataEncoding) {

    var options = {};

    if (attributeId != AttributeIds.Value) {
       if( indexRange && indexRange.isDefined() ) {
           options.statusCode = StatusCodes.BadIndexRangeNoData;
           return new DataValue(options);
       }
       if ( is_dataEncoding(dataEncoding)) {
           options.statusCode = StatusCodes.BadDataEncodingInvalid;
           return new DataValue(options);
       }
    }

    switch (attributeId) {
        case AttributeIds.Value:

            if (!is_valid_dataEnconding(dataEncoding)) {
                options.statusCode = StatusCodes.BadDataEncodingInvalid;
                return new DataValue(options);
            }
            try {
                options.value = this.get_variant();
                if (options.value === null) {
                    options.statusCode = StatusCodes.UncertainInitialValue;
                } else {
                    options.statusCode = StatusCodes.Good;

                    var variant = options.value;
                    if (indexRange && options.value.arrayType !== VariantArrayType.Scalar && _.isArray(variant.value)) {

                        var result = indexRange.extract_values(variant.value);
                        variant.value = result.array;
                        options.statusCode = result.statusCode;
                     }
                }
            } catch(err) {
                console.log(" exception raised while extracting variant from variable");
                console.log(" browseName ", this.browseName);
                console.log(" nodeId     ", this.nodeId.toString());
                console.log(err);
                console.log(err.stack);
                options.value = null;
                options.statusCode = StatusCodes.BadInternalError;
            }
            break;
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            options.value = { dataType: DataType.Int32, value: this.valueRank };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            options.value = { dataType: DataType.UInt32, value: this.arrayDimensions };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.AccessLevel:
            options.value = { dataType: DataType.Byte, value: this.accessLevel.value };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.UserAccessLevel:
            options.value = { dataType: DataType.Byte, value: this.userAccessLevel.value };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.MinimumSamplingInterval:
            if (this.minimumSamplingInterval === undefined) {
                options.statusCode = StatusCodes.BadAttributeIdInvalid;
            } else {
                options.value = { dataType: DataType.UInt32, value: this.minimumSamplingInterval };
                options.statusCode = StatusCodes.Good;
            }
            break;
        case AttributeIds.Historizing:
            options.value = { dataType: DataType.Boolean, value: this.historizing };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    //xx console.log("attributeId = ",attributeId); console.log((new Variant(options.value)).isValid());
    return new DataValue(options);
};

/**
 * @method write
 * @param writeValue {WriteValue}
 * @param writeValue.value.value {Variant}
 * @return {StatusCode}
 */
Variable.prototype.writeValue = function(variant) {

    var statusCode = StatusCodes.BadNotWritable;
    if (this._set_func) {
        statusCode = this._set_func(variant) || StatusCodes.BadNotWritable;
    } else {

        this.value = variant.value;
    }
    return statusCode;
};

/**
 * @method writeAttribute
 * @param attributeId
 * @param dataValue {DataValue}
 * @return {StatusCode}
 */
Variable.prototype.writeAttribute =function(attributeId,dataValue) {

    assert(dataValue instanceof DataValue);
    switch (attributeId) {
        case AttributeIds.Value:
            return this.writeValue(dataValue.value);
        default:
            return BaseNode.prototype.writeAttribute.call(this,attributeId,dataValue);
    }
};

/**
 * bind a variable with a get and set functions
 * @method bindVariable
 * @param options
 * @param [options.set] {Function} the variable setter function
 * @param options.get {Function} the variable getter function. the function must return a Variant
 * @param options.dataType {NodeId} [optional] default: null the nodeId of the dataType
 * @param options.accessLevel  {AccessLevelFlagItem} [optional]
 * @param options.userAccessLevel  {AccessLevelFlagItem} [optional]
 */
Variable.prototype.bindVariable =function(options) {

    options = options || {};

    assert(_.isFunction(options.get));

    this._get_func =options.get;
    this._set_func =options.set;

    Object.defineProperty(this,"value",{
        get: options.get,
        set: options.set || function() {},
        enumerable: true
    });

    if (options.dataType) {
        options.dataType = resolveNodeId(options.dataType);
        this.dataType = options.dataType;
        assert(this.dataType instanceof NodeId);
    }

    if (options.accessLevel) {
        this.accessLevel = makeAccessLevel(options.accessLevel);
    }
    if (options.userAccessLevel) {
        this.userAccessLevel = makeAccessLevel(options.userAccessLevel);
    }

    // check that the function returns a variant
    var value_check = this.value;
    if (!value_check instanceof Variant){
       console.log(" Bind variable error: ".red," : the getter must return a Variant");
    }
    assert( value_check instanceof Variant);
};

exports.Variable = Variable;
