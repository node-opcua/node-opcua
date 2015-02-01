/*JSLint
 global  -require
 */
/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var s = require("lib/datamodel/structures");


var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;
var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("lib/misc/utils").dumpIf;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var BaseNode = require("lib/address_space/basenode").BaseNode;
var ReferenceType = require("lib/address_space/referenceType").ReferenceType;
var AccessLevelFlag = require("lib/datamodel/access_level").AccessLevelFlag;
var makeAccessLevel = require("lib/datamodel/access_level").makeAccessLevel;

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

    this.arrayDimensions = options.arrayDimensions || [];
    assert(_.isArray( this.arrayDimensions));
    new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Array , value : this.arrayDimensions });

    this.accessLevel = options.accessLevel;

    this.userAccessLevel = options.userAccessLevel;

    this.minimumSamplingInterval = options.minimumSamplingInterval;

    this.parentNodeId = options.parentNodeId;

    this.historizing = options.historizing;

    assert(this.dataType instanceof NodeId);
    assert(_.isFinite(this.minimumSamplingInterval));
    //assert(_.isFinite(this.arrayDimensions));
    assert(_.isNull(this.arrayDimensions) || _.isArray(this.arrayDimensions));
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
 * @return {DataValue}
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

Variable.prototype.readValue = function (indexRange, dataEncoding) {

    var options = {};
    if (!is_valid_dataEncoding(dataEncoding)) {
        options.statusCode = StatusCodes.BadDataEncodingInvalid;
        return new DataValue(options);
    }
    try {

        if (this.timestamped_value) {

            var timestamped_value = this.timestamped_value;

            options.sourceTimestamp   = timestamped_value.sourceTimestamp;
            options.sourcePicoseconds = timestamped_value.sourcePicoseconds || 0;
            options.value             = timestamped_value.value;
            assert(is_Variant_or_StatusCode(options.value), "expecting value to be a variant");

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
    } catch (err) {
        console.log(" exception raised while extracting variant from variable".red.bold);
        console.log(" browseName ".red.bold, this.browseName);
        console.log(" nodeId     ".red.bold, this.nodeId.toString());
        console.log(err);
        console.log("stack\n".yellow,err.stack);
        options.value = null;
        options.statusCode = StatusCodes.BadInternalError;
    }
    return options;
};


/**
 * @method readAttribute
 * @param attributeId {AttributeIds} the attributeId to read
 * @param indexRange
 * @param dataEncoding
 * @return {DataValue}
 */
Variable.prototype.readAttribute = function (attributeId, indexRange, dataEncoding) {

    var options = {};

    if (attributeId !== AttributeIds.Value) {
        if (indexRange && indexRange.isDefined()) {
            options.statusCode = StatusCodes.BadIndexRangeNoData;
            return new DataValue(options);
        }
        if (is_dataEncoding(dataEncoding)) {
            options.statusCode = StatusCodes.BadDataEncodingInvalid;
            return new DataValue(options);
        }
    }

    switch (attributeId) {
    case AttributeIds.Value:
        options = this.readValue(indexRange, dataEncoding);
        break;
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
        assert(_.isArray( this.arrayDimensions));
        options.value = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Array , value : this.arrayDimensions });
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
            options.value = { dataType: DataType.Int32, value: this.minimumSamplingInterval };
            options.statusCode = StatusCodes.Good;
        }
        break;
    case AttributeIds.Historizing:
        options.value = { dataType: DataType.Boolean, value: this.historizing };
        options.statusCode = StatusCodes.Good;
        break;
    default:
        return BaseNode.prototype.readAttribute.call(this, attributeId);
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
Variable.prototype.writeValue = function (variant) {

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
Variable.prototype.writeAttribute = function (attributeId, dataValue) {

    assert(dataValue instanceof DataValue);
    switch (attributeId) {
        case AttributeIds.Value:
            return this.writeValue(dataValue.value);
        default:
            return BaseNode.prototype.writeAttribute.call(this, attributeId, dataValue);
    }
};

function _not_writtable_set_func(){
    return StatusCodes.BadNotWritable;
}



// variation 2
function _Variable_bind_with_timestamped_get(options) {

    var self = this;
    assert(self instanceof Variable);

    assert(_.isFunction(options.timestamped_get));
    assert(!options.get,          "should not specify get when timestamped_get exists ");
    //xx assert(!options.refreshFunc,  "should not specify a refreshFunc function");

    assert(!self._timestamped_get_func);
    assert(!self._timestamped_set_func);
    assert(!self._get_func);
    assert(!self._set_func);

    self._timestamped_get_func = options.timestamped_get;
    self._timestamped_set_func = options.timestamped_set || function(){};

    self._get_func = function() {
        return self._timestamped_get_func().value;
    };
    self._set_func = _not_writtable_set_func;
}

// variation 1
function _Variable_bind_with_simple_get(options) {
    var self = this;
    assert(self instanceof Variable);

    assert(_.isFunction(options.get), "should  specify get function");
    assert(!options.timestamped_get,  "should not specify a timestamped_get function");

    assert(!self._timestamped_get_func);
    assert(!self._timestamped_set_func);
    assert(!self._get_func);
    assert(!self._set_func);


    self._get_func = options.get;
    self._set_func = options.set || _not_writtable_set_func;

    self._timestamped_get_func = function() {
        var value = {
            value: self._get_func(),
            sourceTimestamp: new Date(),
            sourcePicoseconds: 0
        };
        assert(is_Variant_or_StatusCode(value.value));
        return value;
    }
    self._timestamped_set_func = function(timestamped_value) {
        self._set_func(timestamped_value.value);
    }

}

// variation #3 :
function _Variable_bind_with_async_refresh(options) {

    var self = this;
    assert(self instanceof Variable);

    assert(_.isFunction(options.refreshFunc));
    assert(!options.get,"a getter shall not be specified when refreshFunc is set");
    assert(!options.timestamped_get,"a getter shall not be specified when refreshFunc is set");

    assert(!self.asyncRefresh);
    assert(!self.refreshFunc);
    assert(!self.timestamped_value);

    self.refreshFunc = options.refreshFunc;

    self._timestamped_value = {
        value: StatusCodes.BadNoDataAvailable,
        sourceTimestamp: null,
        sourcePicoseconds: 0
    };

    self.asyncRefresh = function(callback) {

        self.refreshFunc.call(self,function(err,variant,sourceTimestamp,sourcePicoseconds) {

            assert(is_Variant_or_StatusCode(variant),"expecting variant or statusCode");
            if(!err) {
                //xx console.log("xxxxxx recording cache value");
                // record this value
                self._timestamped_value.value = variant;
                self._timestamped_value.sourceTimestamp = sourceTimestamp || new Date();
                self._timestamped_value.sourcePicoseconds = ( sourcePicoseconds === null)?0:sourcePicoseconds;
            }
            callback(err,self._timestamped_value);
        });
    };

    options.timestamped_get = function() {
        return self._timestamped_value;
    };

    _Variable_bind_with_timestamped_get.call(self,options);
}


/**
 * bind a variable with a get and set functions.
 * @method bindVariable
 * @param options
 * @param [options.dataType=null]   {DataType} the nodeId of the dataType
 * @param [options.accessLevel]     {AccessLevelFlagItem}
 * @param [options.userAccessLevel] {AccessLevelFlagItem}
 * @param [options.set]             {Function} the variable setter function
 * @param [options.get]             {Function} the variable getter function. the function must return a Variant or a status code
 * @param [options.timestamped_get] {Function} the getter function. this function must return a object with the following
 *  properties:
 *    - value: a Variant or a status code
 *    - sourceTimestamp
 *    - sourcePicoseconds
 * @param [options.timestamped_set] {Function}
 * @param [options.refreshFunc] {Function} the variable asynchronous getter function.
 * @return void
 *
 * #### Variation 1
 *
 * In this variation, the user provides a function that returns a Variant with the current value.
 *
 *  The sourceTimestamp will be set automatically.
 *
 * The get function is called synchronously.
 *
 * @example
 *
 *
 * ```javascript
 * ...
 * var options =  {
 *  get : function() {
 *   return Variant({...});
 *  },
 *  set : function(variant) {
 *   // store
 *   return StatsCodes.Good;
 *  }
 * };
 * ...
 * engine.bindVariable(nodeId,options):
 * ...
 * ```
 *
 *
 * #### Variation 2:
 *
 * This variation can be used when the user wants to specify a specific '''sourceTimestamp''' associate
 * with the current value of the Variable.
 *
 * The provided ```timestamped_get``` function should return an object with three properties:
 * * value: containing the variant value or a error StatusCode,
 * * sourceTimestamp
 * * sourcePicoseconds
 *
 * ```javascript
 * ...
 * var value_with_timestamp = {
 *   value: new Variant({dataType: DataType.Double , value: 10.0}),
 *   sourceTimestamp : new Date(),
 *   sourcePicoseconds: 0
 * };
 * ...
 * var options =  {
 *   timestamped_get : function() { return value_with_timestamp;  }
 * };
 * ...
 * engine.bindVariable(nodeId,options):
 * ...
 * // record a new value
 * value_with_timestamp.value.value = 5.0;
 * value_with_timestamp.sourceTimestamp = new Date();
 * ...
 * ```
 *
 *
 * #### Variation 3:
 *
 * This variation can be used when the value associated with the variables requires a asynchronous function call to be
 * extracted. In this case, the user should provide an async method ```refreshFunc```.
 *
 *
 * The ```refreshFunc``` shall do whatever is necessary to fetch the most up to date version of the variable value, and
 * call the ```callback``` function when the data is ready.
 *
 *
 * The ```callback``` function follow the standard callback function signature:
 * * the first argument shall be **null** or **Error**, depending of the outcome of the fetch operation,
 * * the second argument shall be a variant with the new Variable Value or a StatusCode if the operation has failed.
 *
 *
 * Optionally, it is possible to pass a sourceTimestamp and a sourcePicoseconds value as a third and fourth arguments
 * of the callback. When sourceTimestamp and sourcePicoseconds are missing, the system will set their default value
 * to the current time..
 *
 *
 * ```javascript
 * ...
 * var options =  {
 *    refreshFunc : function(callback) {
 *      ... do_some_async_stuff_to_get_the_new_variable_value
 *      var variant = new Variant(...);
 *      callback(null,variant[,sourceTimestamp[,sourcePicoseconds]]);
 *    }
 * };
 * ...
 * engine.bindVariable(nodeId,options):
 * ...
 * ```
 *
 */
Variable.prototype.bindVariable = function (options) {

    var self = this;
    options = options || {};

    if (_.isFunction(options.get)) {
        // variation 1
        _Variable_bind_with_simple_get.call(self,options);

    } else if (_.isFunction(options.timestamped_get)) {
        // variation 2
        _Variable_bind_with_timestamped_get.call(self,options);

    } else if (_.isFunction(options.refreshFunc)) {
        // variation 3
        _Variable_bind_with_async_refresh.call(self,options);
    }

    assert(_.isFunction(self._get_func));
    assert(_.isFunction(self._set_func));
    assert(_.isFunction(self._timestamped_get_func));
    assert(_.isFunction(self._timestamped_set_func));

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
    var value_check = self.value;

    if (!is_Variant_or_StatusCode(value_check)) {
        console.log(" Bind variable error: ".red, " : the getter must return a Variant or a StatusCode");
        console.log("value_check.constructor.name ",value_check.constructor.name );
        throw new Error(" bindVariable : the value getter function returns a invalid result ( expecting a Variant or a StatusCode !!!") ;
    }
};



/**
 * @method readValueAsync
 * @param callback {Function}
 * @param callback.err   {null|Error}
 * @param callback.value {Variant|null} the value read
 */
Variable.prototype.readValueAsync = function(callback) {

    var self = this;
    var func = _.isFunction(self.asyncRefresh) ?  self.asyncRefresh : setImmediate;

    func(function(err,timestamped_value){
        callback(err,timestamped_value);
    });
};

exports.Variable = Variable;
