/*JSLint
 global  -require
 */
/**
 * @module opcua.address_space
 */

var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var NodeId = require("../datamodel/nodeid").NodeId;
var makeNodeId = require("../datamodel/nodeid").makeNodeId;
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

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../misc/utils").dumpIf;


var BaseNode = require("./basenode").BaseNode;
var ReferenceType = require("./referenceType").ReferenceType;
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
 *
 *  The AccessLevel Attribute is used to indicate how the Value of a Variable can be accessed (read/write) and if it
 *  contains current and/or historic data. The AccessLevel does not take any user access rights into account,
 *  i.e. although the Variable is writeable this may be restricted to a certain user / user group.
 *  The AccessLevel is an 8-bit unsigned integer with the structure defined in the following table:
 *
 *  Field            Bit    Description
 *  CurrentRead      0      Indicates if the current value is readable
 *                          (0 means not readable, 1 means readable).
 *  CurrentWrite     1      Indicates if the current value is writable
 *                          (0 means not writable, 1 means writable).
 *  HistoryRead      2      Indicates if the history of the value is readable
 *                          (0 means not readable, 1 means readable).
 *  HistoryWrite     3      Indicates if the history of the value is writable (0 means not writable, 1 means writable).
 *  SemanticChange   4      Indicates if the Variable used as Property generates SemanticChangeEvents (see 9.31).
 *  Reserved         5:7    Reserved for future use. Shall always be zero.
 *
 *  The first two bits also indicate if a current value of this Variable is available and the second two bits
 *  indicates if the history of the Variable is available via the OPC UA server.
 *
 */

function Variable(options) {

    BaseNode.apply(this, arguments);

    assert(this.typeDefinition.value === this.resolveNodeId("VariableTypeNode").value);

    this.value = options.value;


    options.accessLevel = options.accessLevel || "CurrentRead | CurrentWrite";
    options.userAccessLevel = options.userAccessLevel || "CurrentRead | CurrentWrite";
    options.accessLevel = makeAccessLevel(options.accessLevel);
    options.userAccessLevel = makeAccessLevel(options.userAccessLevel);


    this.dataType = this.resolveNodeId(options.dataType);    // DataType (NodeId)

    this.valueRank = options.valueRank || 0;  // UInt32
    assert(typeof(this.valueRank) === "number");

    this.arrayDimensions = options.arrayDimensions || 0;
    this.accessLevel = options.accessLevel;
    this.userAccessLevel = options.userAccessLevel;

    this.minimumSamplingInterval = options.minimumSamplingInterval;

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
Variable.prototype.get_variant = function () {


    // retrieve a snapshot of the value
    var snapshot_value =  this.value;

    if (!snapshot_value) {
        console.log(" xxxx variable has not been bound ( node id = ", this.nodeId.toString() + " )", " name : ", this.browseName);
        return null; // emptyVariant;
    }
    assert(is_Variant_or_StatusCode(snapshot_value));
    return snapshot_value;
};

function is_dataEncoding(dataEncoding) {
    return (dataEncoding && typeof dataEncoding.name === "string");
}


function is_valid_dataEncoding(dataEncoding) {

    var valid_encoding = ["DefaultBinary", "DefaultXml"];

    if (!is_dataEncoding(dataEncoding)) {
        return true;
    }
    if (valid_encoding.indexOf(is_dataEncoding.name) === -1) {
        return false;
    }
    return true;
}
function is_Variant(v) {
    return v instanceof Variant;
}
function is_StatusCode(v) {
    return v && v.constructor && v.constructor.name === "StatusCode";
}

function is_Variant_or_StatusCode(v) {

    if (is_Variant(v)){ assert(v.isValid()); }
    return is_Variant(v) || is_StatusCode(v) ;
}


/**
 *
 * @method readValue
 * @param indexRange  {NumericRange||null}
 * @param dataEncoding
 * @param callback
 *
 *
 * from OPC.UA.Spec 1.2 part 4
 *  5.10.2.4 StatusCodes
 *  Table 51 defines values for the operation level statusCode contained in the DataValue structure of
 *  each values element. Common StatusCodes are defined in Table 166.
 *
 * Table 51 – Read Operation Level Result Codes
 *
 *  Symbolic Id                 Description
 *
 *  Bad_NodeIdInvalid           The syntax of the node id is not valid.
 *  Bad_NodeIdUnknown           The node id refers to a node that does not exist in the server address space.
 *  Bad_AttributeIdInvalid      Bad_AttributeIdInvalid The attribute is not supported for the specified node.
 *  Bad_IndexRangeInvalid       The syntax of the index range parameter is invalid.
 *  Bad_IndexRangeNoData        No data exists within the range of indexes specified.
 *  Bad_DataEncodingInvalid     The data encoding is invalid.
 *                              This result is used if no dataEncoding can be applied because an Attribute other than
 *                              Value was requested or the DataType of the Value Attribute is not a subtype of the
 *                              Structure DataType.
 *  Bad_DataEncodingUnsupported The server does not support the requested data encoding for the node.
 *                               This result is used if a dataEncoding can be applied but the passed data encoding is not
 *                               known to the Server.
 *  Bad_NotReadable             The access level does not allow reading or subscribing to the Node.
 *  Bad_UserAccessDenied        User does not have permission to perform the requested operation. (table 165)
 */

Variable.prototype.readValue = function (indexRange, dataEncoding, callback) {

    var options = {};
    if (!is_valid_dataEncoding(dataEncoding)) {
        options.statusCode = StatusCodes.BadDataEncodingInvalid;
        callback(new DataValue(options));
        return;
    }
    try {
        // make sure we only read value once
        this._timestamped_get_func(function(timestamped_value){
            if (timestamped_value) {
                options.sourceTimestamp   = timestamped_value.sourceTimestamp;
                options.sourcePicoseconds = timestamped_value.sourcePicoseconds || 0;
                options.value             = timestamped_value.value;
                assert(is_Variant(options.value), "expecting value to be a variant");
                assert(options.sourceTimestamp instanceof Date, "expecting timestamp to be a Date");

            } else {
                options.value             = this.get_variant();

            }

            if (options.value === null) {

                options.statusCode = StatusCodes.UncertainInitialValue;

            } else if (is_StatusCode(options.value) ) {

                options.statusCode = options.value;
                options.value = null;

            } else {

                options.statusCode = StatusCodes.Good;

                var variant = options.value;
                if (indexRange && options.value.arrayType !== VariantArrayType.Scalar && _.isArray(variant.value)) {

                    var result = indexRange.extract_values(variant.value);
                    variant.value = result.array;
                    options.statusCode = result.statusCode;
                }
            }
            callback(options);
        });
    } catch (err) {
        console.log(" exception raised while extracting variant from variable");
        console.log(" browseName ", this.browseName);
        console.log(" nodeId     ", this.nodeId.toString());
        console.log(err);
        console.log(err.stack);
        options.value = null;
        options.statusCode = StatusCodes.BadInternalError;
        callback(options);
    }
};


/**
 * @method readAttribute
 * @param attributeId {AttributeIds} the attributeId to read
 * @param callback
 * @param indexRange
 * @param dataEncoding
 */
Variable.prototype.readAttribute = function (attributeId, callback, indexRange, dataEncoding) {
    var options = {};

    if (attributeId !== AttributeIds.Value) {
        if (indexRange && indexRange.isDefined()) {
            options.statusCode = StatusCodes.BadIndexRangeNoData;
            callback(new DataValue(options));
        }
        if (is_dataEncoding(dataEncoding)) {
            options.statusCode = StatusCodes.BadDataEncodingInvalid;
            callback(new DataValue(options));
        }
    }
    
    else if (attributeId == AttributeIds.Value){
        this.readValue(indexRange, dataEncoding, function(options){
            callback(new DataValue(options));
        });    
    }
    else {
        switch (attributeId) {
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            assert(typeof(this.valueRank) === "number");
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
            BaseNode.prototype.readAttribute.call(this, attributeId, callback, indexRange, dataEncoding);
            return;
        }
        //xx console.log("attributeId = ",attributeId); console.log((new Variant(options.value)).isValid());
        callback(new DataValue(options));
    }
};

/**
 * @method write
 * @param writeValue {WriteValue}
 * @param writeValue.value.value {Variant}
 * @return {StatusCode}
 */
Variable.prototype.writeValue = function (variant, callback) {

    var statusCode = StatusCodes.BadNotWritable;
    if (this._set_func) {
        if(this._set_func){
            this._set_func(variant,callback);
        }
        else{
            callback(StatusCodes.BadNotWritable);
        }
    } else {
        this.value = variant.value;
        callback(statusCode);
    }
};

/**
 * @method writeAttribute
 * @param attributeId
 * @param dataValue {DataValue}
 * @param callback {function}
 */
Variable.prototype.writeAttribute = function (attributeId, dataValue, callback) {
    assert(dataValue instanceof DataValue);
    switch (attributeId) {
        case AttributeIds.Value:
            this.writeValue(dataValue.value, callback);
        default:
            BaseNode.prototype.writeAttribute.call(this, attributeId, dataValue, callback);
    }
};

function _not_writtable_set_func(){
    return StatusCodes.BadNotWritable;
}
/**
 * bind a variable with a get and set functions
 * @method bindVariable
 * @param options
 * @param options.set {Function} the variable setter function
 * @param options.setAsync {Function} asynchronous write function
 * @param options.get {Function} the variable getter function. the function must return a Variant
 * @param options.getAsync {Function} asynchronous read function
 * @param options.dataType {NodeId} [optional] default: null the nodeId of the dataType
 * @param options.accessLevel  {AccessLevelFlagItem} [optional]
 * @param options.userAccessLevel  {AccessLevelFlagItem} [optional]
 */
Variable.prototype.bindVariable = function (options) {
    var self = this;
    options = options || {};
    if (options.getAsync){
        //throw new Error("test"+options.timestamped_get);
    }
    if (!options.timestamped_get) {
        assert(_.isFunction(options.get) || _.isFunction(options.getAsync),
            "should specify get function");
        self._get_func = function(callback){
            //console.log("test:"+options.getAsync+".."+callback);
            if (options.getAsync){
                options.getAsync(callback);
            }
            else {
                var value = options.get();
                //console.log("val:"+value);
                callback(value);
            }
        };
        self._set_func = function(variant,callback){
            if (options.setAsync){
                options.setAsync(variant, callback);
            }
            else if (options.set){
                options.set(variant);
                callback();
            }
            else {
                _not_writtable_set_func();
                callback();
            }
        };

        self._timestamped_get_func = function(callback) {
            self._get_func(function(r){
                var value = {
                    value: r,
                    sourceTimestamp: new Date(),
                    sourcePicoseconds: 0
                };
                assert(is_Variant_or_StatusCode(value.value));
                callback(value);
            });
        }
        self._timestamped_set_func = function(timestamped_value, callback) {
            self._set_func(timestamped_value.value,callback);
        }
    } else {
        assert(_.isFunction(options.timestamped_get), "");
        assert(!_.isFunction(options.get), "should not specify get when timestamped_get exists ");
        self._timestamped_get_func = function(callback) {
            callback(options.timestamped_get());
        };
        self._timestamped_set_func = function(variant,callback) {
            callback(options.timestamped_set(variant));
        };

        self._get_func = function(callback) {
            callback(self._timestamped_get_func().value);
        }
        self._set_func = function(variant,callback){
            _not_writtable_set_func();
            callback();
        }
    }

    assert(_.isFunction(self._get_func));
    assert(_.isFunction(self._set_func));
    assert(_.isFunction(self._timestamped_get_func));
    assert(_.isFunction(self._timestamped_set_func));

    /*
    Object.defineProperty(self, "timestamped_value", {
        get: self._timestamped_get_func,
        set: self._timestamped_set_func,
        enumerable: true
    });

    Object.defineProperty(self, "value", {
        get: self._get_func,
        set: self._set_func,
        enumerable: true
    });
    */

    if (options.dataType) {
        options.dataType = resolveNodeId(options.dataType);
        self.dataType = options.dataType;
        assert(self.dataType instanceof NodeId);
    }

    if (options.accessLevel) {
        self.accessLevel = makeAccessLevel(options.accessLevel);
    }
    if (options.userAccessLevel) {
        self.userAccessLevel = makeAccessLevel(options.userAccessLevel);
    }

    // check that the function returns a variant
    /*
    var value_check = self.value;

    if (!is_Variant_or_StatusCode(value_check)) {
        console.log(" Bind variable error: ".red, " : the getter must return a Variant or a StatusCode");
        console.log("value_check.constructor.name ",value_check.constructor.name );
        throw new Error(" bindVariable : the value getter function returns a invalid result ( expecting a Variant or a StatusCode !!!") ;
    }
	*/

};

exports.Variable = Variable;
