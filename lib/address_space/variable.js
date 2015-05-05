"use strict";
/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;


var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");

var BaseNode = require("lib/address_space/basenode").BaseNode;
var makeAccessLevel = require("lib/datamodel/access_level").makeAccessLevel;
var write_service = require("lib/services/write_service");
var WriteValue = write_service.WriteValue;

function isGoodish(statusCode) {
    return statusCode.value < 0x10000000;
}

function adjust_accessLevel(accessLevel) {
    accessLevel = accessLevel || "CurrentRead | CurrentWrite";
    accessLevel = makeAccessLevel(accessLevel);
    assert(_.isFinite(accessLevel.value));
    return accessLevel;
}

function adjust_userAccessLevel(accessLevel) {
    accessLevel = accessLevel || "CurrentRead | CurrentWrite";
    accessLevel = makeAccessLevel(accessLevel);
    return accessLevel;
}

function adjust_samplingInterval(minimumSamplingInterval) {
    assert(_.isFinite(minimumSamplingInterval));
    return minimumSamplingInterval;
}

function is_Variant(v)    { return v instanceof Variant; }

function is_StatusCode(v) { return v && v.constructor && v.constructor.name === "StatusCode"; }

function is_Variant_or_StatusCode(v) {
    if (is_Variant(v)){
        // /@@assert(v.isValid());
    }
    return is_Variant(v) || is_StatusCode(v) ;
}


var is_valid_dataEncoding = require("lib/misc/data_encoding").is_valid_dataEncoding;
var is_dataEncoding = require("lib/misc/data_encoding").is_dataEncoding;



var UADataType = require("./data_type").UADataType;
function _dataType_toUADataType(__address_space, dataType) {

    assert(__address_space);
    assert(dataType);

    var dataTypeNode = __address_space.findDataType(dataType.key);
    /* istanbul ignore next */
    if (!dataTypeNode) {
        throw new Error(" Cannot find DataType " + dataType.key + " in address Space");
    }
    return dataTypeNode;
}

function validateDataType(__address_space,dataTypeNodeId,variantDataType,nodeId) {

    if (variantDataType === DataType.ExtensionObject ) {
        //
        return true;
    }
    var actual_DataTypeNode   = _dataType_toUADataType(__address_space, variantDataType);
    var expected_DataTypeNode = __address_space.findObject(dataTypeNodeId);

    assert(actual_DataTypeNode   instanceof UADataType);
    assert(expected_DataTypeNode instanceof UADataType);

    // The value supplied for the attribute is not of the same type as the  value.
    var isValidDataType1 = expected_DataTypeNode.isSupertypeOf(actual_DataTypeNode);
    var isValidDataType2 = actual_DataTypeNode.isSupertypeOf(expected_DataTypeNode);
    /* istanbul ignore next */
    if (!isValidDataType1 && !isValidDataType2) {
        console.log(" ---------- Type mismatch ".green ," on ",nodeId.toString());
        console.log(" Expected dataType = ".cyan, expected_DataTypeNode.browseName);
        console.log(" Actual   dataType = ".yellow, actual_DataTypeNode.browseName);
        return false;
    }
    return true;
}


/**
 * A OPCUA Variable Node
 *
 * @class Variable
 * @constructor
 * @extends  BaseNode
 * @param options  {Object}
 * @param options.value
 * @param options.browseName {string}
 * @param options.dataType   {NodeId|String}
 * @param options.valueRank  {Int32}
 * @param options.arrayDimensions {null|Array<Integer>}
 * @param options.accessLevel {AccessLevel}
 * @param options.userAccessLevel {AccessLevel}
 * @param [options.minimumSamplingInterval = -1]
 * @param [options.historizing = false] {Boolean}
 * @param options.parentNodeId {NodeId}
 *
 *  The AccessLevel Attribute is used to indicate how the Value of a Variable can be accessed (read/write) and if it
 *  contains current and/or historic data. The AccessLevel does not take any user access rights into account,
 *  i.e. although the Variable is writable this may be restricted to a certain user / user group.
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

    var self = this;

    BaseNode.apply(this, arguments);

    assert(self.typeDefinition.value === self.resolveNodeId("VariableTypeNode").value);

    self.dataType = self.resolveNodeId(options.dataType);    // DataType (NodeId)
    assert(self.dataType instanceof NodeId);

    self.valueRank = options.valueRank || 0;  // UInt32
    assert(typeof(self.valueRank) === "number");

    self.arrayDimensions = options.arrayDimensions || null;
    assert(_.isNull(self.arrayDimensions) || _.isArray(self.arrayDimensions));

    self.accessLevel =  adjust_accessLevel(options.accessLevel);

    self.userAccessLevel = adjust_userAccessLevel(options.userAccessLevel);

    self.minimumSamplingInterval = adjust_samplingInterval(options.minimumSamplingInterval);

    self.parentNodeId = options.parentNodeId;

    self.historizing = options.historizing;

    self._dataValue = new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown, value:  {} });

    if (options.value) {
        self.bindVariable(options.value);
    }
}
util.inherits(Variable, BaseNode);
Variable.prototype.nodeClass = NodeClass.Variable;


Variable.prototype.isWritable = function() {
    return this.accessLevel.has("CurrentWrite") && this.userAccessLevel.has("CurrentWrite");
};

/**
 *
 * @param dataValue
 * @param result
 * @returns {DataValue}
 */
function clone_with_array_replacement(dataValue,result) {

    assert(result.array);
    return new DataValue({
        statusCode: result.statusCode,
        serverTimestamp: dataValue.serverTimestamp,
        serverPicoseconds: dataValue.serverPicoseconds,
        sourcePicoseconds: dataValue.sourcePicoseconds,
        sourceTimestamp: dataValue.sourceTimestamp,
        value : {
            dataType : dataValue.value.dataType,
            arrayType : dataValue.value.arrayType,
            value: result.array
        }
    });
}

/**
 *
 * @method readValue
 * @param [indexRange] {NumericRange|null}
 * @param [dataEncoding] {String}
 * @return {DataValue}
 *
 *
 * from OPC.UA.Spec 1.02 part 4
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

    var self = this;
    if (!is_valid_dataEncoding(dataEncoding)) {
        return new DataValue({statusCode: StatusCodes.BadDataEncodingInvalid});
    }

    var dataValue = self._dataValue;

    if (isGoodish(dataValue.statusCode)) {

        //xx console.log("xxxxxxx indexRange =".yellow,indexRange ? indexRange.toString():"<null>") ;
        //xx console.log("         dataValue =",dataValue.toString());
        var variant = dataValue.value;
        if (indexRange && dataValue.value.arrayType !== VariantArrayType.Scalar ) {
            var result = indexRange.extract_values(variant.value);
            dataValue = clone_with_array_replacement(dataValue,result);
        }
    }

    /* istanbul ignore next */
    if (dataValue.statusCode === StatusCodes.BadNodeIdUnknown) {
        console.log(" Warning:  ",self.browseName,self.nodeId.toString(), "exists but dataValue has not been defined");
    }
    return dataValue;
};


/**
 * @method readAttribute
 * @param attributeId {AttributeIds} the attributeId to read
 * @param indexRange {NumericRange || null}
 * @param dataEncoding {String}
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
        return this.readValue(indexRange, dataEncoding);
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
        assert(_.isArray( this.arrayDimensions) ||  this.arrayDimensions === null);
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
    return new DataValue(options);
};



Variable.prototype._validate_DataType = function(variantDataType) {

    return validateDataType(this.__address_space,this.dataType,variantDataType,this.nodeId);
};


function check_valid_array(dataType,array) {
    if (_.isArray(array)) {
        return true;
    }
    switch(dataType) {
        case DataType.Double:  return array instanceof Float64Array;
        case DataType.Float:   return array instanceof Float32Array;
        case DataType.Int32:   return array instanceof Int32Array;
        case DataType.Int16:   return array instanceof Int16Array;
        case DataType.SByte:   return array instanceof Int8Array;
        case DataType.UInt32:  return array instanceof Uint32Array;
        case DataType.UInt16:  return array instanceof Uint16Array;
        case DataType.Byte:    return array instanceof Uint8Array;
    }
    return false;
}
/**
 * @method writeValue
 * @param dataValue {DataValue}
 * @param [indexRange] {NumericRange}
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.statusCode {StatusCode}
 * @async
 *
 */
Variable.prototype.writeValue = function (dataValue,indexRange, callback) {

    var self = this;

    // adjust arguments if optional indexRange Parameter is not given
    if (!_.isFunction(callback) && _.isFunction(indexRange)) {
        callback = indexRange;
        indexRange = new NumericRange();
    }
    assert(_.isFunction(callback));
    assert(dataValue instanceof DataValue);

    indexRange = NumericRange.coerce(indexRange);

    // test write permission
    if (!self.isWritable()) {
        return callback(null,StatusCodes.BadNotWritable);
    }

    // adjust special case
    var variant = dataValue.value;
    if (variant.arrayType === VariantArrayType.Scalar &&  variant.dataType=== DataType.ByteString) {
        //xx console.log("xxxx HERERE" , self.dataType.toString() ,DataType.Byte );
        if ( (self.dataType.value === 3) && (self.dataType.namespace === 0) ) { // Byte
            //xx console.log("xxxx Bingo");
            variant.arrayType = VariantArrayType.Array;
            variant.dataType = DataType.Byte;
            // Byste
        }
    }

    // test dataType
    if (!self._validate_DataType(dataValue.value.dataType)) {
        return callback(null, StatusCodes.BadTypeMismatch);
    }

    if (indexRange && !indexRange.isEmpty()) {

        if(!indexRange.isValid()) {
            return callback(null, StatusCodes.BadIndexRangeInvalid);
        }

        var newArr = dataValue.value.value;
        // check that source data is array
        if (dataValue.value.arrayType!= VariantArrayType.Array) {
            return callback(null, StatusCodes.BadTypeMismatch);
        }

        // check that destination data is also array
        assert(check_valid_array(self._dataValue.value.dataType,self._dataValue.value.value));
        var destArr = self._dataValue.value.value;
        var result = indexRange.set_values(destArr,newArr);

        if (result.statusCode !== StatusCodes.Good) {
           return callback(null,result.statusCode);
        }
        dataValue.value.value = result.array;
        return self.writeValue(dataValue,null,callback);
    }

    assert(self._timestamped_set_func);
    self._timestamped_set_func(dataValue,function(err,statusCode,correctedDataValue) {
        if(!err) {
            correctedDataValue = correctedDataValue || dataValue;
            assert(correctedDataValue instanceof DataValue);
            self._dataValue = correctedDataValue;
        }
        callback(err,statusCode);
    });
};

/**
 * @method writeAttribute
 * @param writeValue              {WriteValue}
 * @param writeValue.nodeId       {NodeId}
 * @param writeValue.attributeId  {AttributeId}*
 * @param writeValue.value        {DataValue}
 * @param writeValue.indexRange   {NumericRange}
 * @param callback                {Function}
 * @param callback.err            {Error|null}
 * @param callback.statusCode     {StatusCode}
 * @async
 * @return
 */
Variable.prototype.writeAttribute = function (writeValue, callback) {

    assert(writeValue instanceof WriteValue);
    assert(writeValue.value instanceof DataValue);
    assert(writeValue.value.value instanceof Variant);
    assert(_.isFunction(callback));

    switch (writeValue.attributeId) {
        case AttributeIds.Value:
            this.writeValue(writeValue.value,writeValue.indexRange,callback);
            break;
        default:
            BaseNode.prototype.writeAttribute.call(this, writeValue,callback);
    }
};

function _not_writable_timestamped_set_func(dataValue,callback) {
    assert(dataValue instanceof DataValue);
    callback(null,StatusCodes.BadNotWritable,null);
}

function _default_writable_timestamped_set_func(dataValue,callback) {
    assert(dataValue instanceof DataValue);
    this._dataValue = dataValue;
    this._dataValue.serverTimestamp =  new Date();
    callback(null,StatusCodes.Good);
}

function turn_sync_to_async(f,numberOfArgs) {
    if (f.length <= numberOfArgs){
        return function(data,callback) {
            var r = f(data);
            setImmediate(function() {
                return callback(null,r);
            });
        };
    } else {
        assert(f.length === numberOfArgs+1);
        return f;
    }
}


// variation 1
function _Variable_bind_with_simple_get(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof Variable);
    assert(_.isFunction(options.get), "should  specify get function");
    assert(options.get.length === 0,  "get function should not have arguments");
    assert(!options.timestamped_get,  "should not specify a timestamped_get function when get is specified");
    assert(!self._timestamped_get_func);
    assert(!self._get_func);

    self._get_func = options.get;

    function timestamped_get_func_from__Variable_bind_with_simple_get() {

        var value=  self._get_func();

        /* istanbul ignore next */
        if (!is_Variant_or_StatusCode(value)) {
            console.log(" Bind variable error: ".red, " : the getter must return a Variant or a StatusCode");
            console.log("value_check.constructor.name ",value ? value.constructor.name : "null");
            throw new Error(" bindVariable : the value getter function returns a invalid result ( expecting a Variant or a StatusCode !!!") ;
        }
        if (is_StatusCode(value)) {
            return new DataValue({statusCode: value});

        } else {
            return  new DataValue({
                statusCode: StatusCodes.Good,
                value: value,
                sourceTimestamp: new Date(),
                sourcePicoseconds: 0
            });
        }
    }
    _Variable_bind_with_timestamped_get.call(self,{timestamped_get: timestamped_get_func_from__Variable_bind_with_simple_get});
}

// variation 2
function _Variable_bind_with_timestamped_get(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof Variable);
    assert(_.isFunction(options.timestamped_get));
    assert(!options.get, "should not specify 'get' when 'timestamped_get' exists ");
    assert(!self._timestamped_get_func);

    self._timestamped_get_func = options.timestamped_get;

    var dataValue_verify = self._timestamped_get_func();
    /* istanbul ignore next */
    if (!(dataValue_verify instanceof DataValue)) {
        console.log(" Bind variable error: ".red, " : the timestamped_get function must return a DataValue");
        console.log("value_check.constructor.name ",dataValue_verify ? dataValue_verify.constructor.name : "null");
        throw new Error(" Bind variable error: ".red, " : the timestamped_get function must return a DataValue") ;
    }

    function async_refresh_func(callback) {
        var dataValue = self._timestamped_get_func();
        callback(null,dataValue);
    }
    _Variable_bind_with_async_refresh.call(self,{refreshFunc: async_refresh_func});

}

// variation #3 :
function _Variable_bind_with_async_refresh(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof Variable);

    assert(_.isFunction(options.refreshFunc));
    assert(!options.get,"a getter shall not be specified when refreshFunc is set");
    assert(!options.timestamped_get,"a getter shall not be specified when refreshFunc is set");

    assert(!self.asyncRefresh);
    assert(!self.refreshFunc);

    self.refreshFunc = options.refreshFunc;

    self.asyncRefresh = function(callback) {

        self.refreshFunc.call(self,function(err,dataValue) {
            if(!err && dataValue) {
                self._internal_set_dataValue(dataValue);
            } else {
                self._dataValue.statusCode = StatusCodes.BadNoDataAvailable;
            }
            callback(err,self._dataValue);
        });
    };

    assert(self._dataValue.statusCode=== StatusCodes.BadNodeIdUnknown);
    self._dataValue.statusCode = StatusCodes.UncertainInitialValue;

}


function _Variable_bind_with_simple_set(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof Variable);
    assert(_.isFunction(options.set), "should specify set function");
    assert(!options.timestamped_set, "should not specify a timestamped_set function");

    assert(!self._timestamped_set_func);
    assert(!self._set_func);

    self._set_func = turn_sync_to_async(options.set,1);
    assert(self._set_func.length === 2," set function must have 2 arguments ( variant, callback)");

    self._timestamped_set_func = function(timestamped_value,callback) {
        assert(timestamped_value instanceof DataValue);
        self._set_func(timestamped_value.value,function(err,statusCode){
            if (!err) {
                self._dataValue = timestamped_value;
            }
            callback(err,statusCode,timestamped_value);
        });
    };
}
function _Variable_bind_with_timestamped_set(options) {

    /* jshint validthis: true */
    var self = this;
    assert(self instanceof Variable);
    assert(_.isFunction(options.timestamped_set));
    assert(!options.set, "should not specify set when timestamped_set_func exists ");
    self._timestamped_set_func = options.timestamped_set;
}

Variable.prototype._internal_set_dataValue = function(dataValue) {

    var self = this;
    self._dataValue = dataValue;
    self._dataValue.sourceTimestamp  = self._dataValue.sourceTimestamp    || new Date();
    self._dataValue.sourcePicoseconds = self._dataValue.sourcePicoseconds || 0 ;
    self._dataValue.serverTimestamp  = new Date();
    self._dataValue.serverPicoseconds = 0;
    self._dataValue.statusCode = self._dataValue.statusCode || StatusCodes.Good;
};

/**
 * bind a variable with a get and set functions.
 *
 * @method bindVariable
 * @param options
 * @param [options.dataType=null]   {DataType} the nodeId of the dataType
 * @param [options.accessLevel]     {Number} AccessLevelFlagItem
 * @param [options.userAccessLevel] {Number} AccessLevelFlagItem
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
 *
 * ### Providing read access to the underlying value
 *
 * #### Variation 1
 *
 * In this variation, the user provides a function that returns a Variant with the current value.
 *
 * The sourceTimestamp will be set automatically.
 *
 * The get function is called synchronously.
 *
 * @example
 *
 *
 * ```javascript
 *     ...
 *     var options =  {
 *       get : function() {
 *          return new Variant({...});
 *       },
 *       set : function(variant) {
 *          // store
 *          return StatsCodes.Good;
 *       }
 *    };
 *    ...
 *    engine.bindVariable(nodeId,options):
 *    ...
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
 * var myDataValue = new DataValue({
 *   value: {dataType: DataType.Double , value: 10.0},
 *   sourceTimestamp : new Date(),
 *   sourcePicoseconds: 0
 * });
 * ...
 * var options =  {
 *   timestamped_get : function() { return myDataValue;  }
 * };
 * ...
 * engine.bindVariable(nodeId,options):
 * ...
 * // record a new value
 * myDataValue.value.value = 5.0;
 * myDataValue.sourceTimestamp = new Date();
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
 * * the second argument shall be a DataValuewith the new Variable Value,  a StatusCode, and time stamps.
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
 *      var dataValue = new DataValue({
 *          value: new Variant({...}),
 *          statusCode: StatusCodes.Good,
 *          sourceTimestamp: new Date()
 *      });
 *      callback(null,dataValue);
 *    }
 * };
 * ...
 * engine.bindVariable(nodeId,options):
 * ...
 * ```
 *
 * ### Providing write access to the underlying value
 *
 * #### Variation1 - provide a simple synchronous set function
 *
 *
 * #### Notes
 *   to do : explain return StatusCodes.GoodCompletesAsynchronously;
 *
 */
Variable.prototype.bindVariable = function (options) {

    var self = this;
    options = options || {};

    function bind_getter(options) {

        if (_.isFunction(options.get)) {                                   // variation 1
            _Variable_bind_with_simple_get.call(self,options);

        } else if (_.isFunction(options.timestamped_get)) {                // variation 2
            _Variable_bind_with_timestamped_get.call(self,options);

        } else if (_.isFunction(options.refreshFunc)) {                     // variation 3
            _Variable_bind_with_async_refresh.call(self,options);

        } else {
            assert(!options.set," a getter must be provided if a setter is provided");
            self._internal_set_dataValue(new DataValue({
                value: options,
                statusCode: StatusCodes.Good
            }));
        }
    }
    bind_getter(options);
    //xx console.log(self.browseName,self._dataValue.toString());
    //assert(_.isFunction(self.refreshFunc));

    function bind_setter(options) {

        if (_.isFunction(options.set)) {                                    // variation 1
            _Variable_bind_with_simple_set.call(self,options);

        } else if (_.isFunction(options.timestamped_set)) {                 // variation 2
            assert(_.isFunction(options.timestamped_get,"timestamped_set must be used with timestamped_get "));
            _Variable_bind_with_timestamped_set.call(self,options);

        } else if (_.isFunction(options.timestamped_get)) {
            // timestamped_get is  specified but timestamped_set is not
            // => Value is read-only
            _Variable_bind_with_timestamped_set.call(self,{ timestamped_set : _not_writable_timestamped_set_func });

        } else {
            _Variable_bind_with_timestamped_set.call(self, { timestamped_set : _default_writable_timestamped_set_func});
        }
    }
    bind_setter(options);
    assert(_.isFunction(self._timestamped_set_func));
    assert(self._timestamped_set_func.length===2);
};



/**
 * @method readValueAsync
 * @param callback {Function}
 * @param callback.err   {null|Error}
 * @param callback.dataValue {DataValue|null} the value read
 * @async
 */
Variable.prototype.readValueAsync = function(callback) {

    var self = this;

    self.__waiting_callbacks = self.__waiting_callbacks || [];
    self.__waiting_callbacks.push(callback);

    var _readValueAsync_in_progress = self.__waiting_callbacks.length >=2 ;
    if (_readValueAsync_in_progress) {
        return;
    }
    function readImmediate(callback) {
        callback(null,self._dataValue);
    }
    var func = _.isFunction(self.asyncRefresh) ?  self.asyncRefresh : readImmediate;

    func.call(this,function(err,dataValue){

        assert(dataValue instanceof DataValue);
        // now call all pending callbacks
        var callbacks = self.__waiting_callbacks;
        self.__waiting_callbacks = [];
        callbacks.forEach( function(callback){ callback.call(self,err,dataValue);});
    });
};

exports.Variable = Variable;
