"use strict";
/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;


var DataValue = require("lib/datamodel/datavalue").DataValue;
var extractRange = require("lib/datamodel/datavalue").extractRange;

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

var BaseNode = require("lib/address_space/base_node").BaseNode;
var makeAccessLevel = require("lib/datamodel/access_level").makeAccessLevel;
var write_service = require("lib/services/write_service");
var WriteValue = write_service.WriteValue;

var doDebug = false;

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

function is_Variant(v) {
    return v instanceof Variant;
}

function is_StatusCode(v) {
    return v && v.constructor && v.constructor.name === "StatusCode";
}

function is_Variant_or_StatusCode(v) {
    if (is_Variant(v)) {
        // /@@assert(v.isValid());
    }
    return is_Variant(v) || is_StatusCode(v);
}


var is_valid_dataEncoding = require("lib/misc/data_encoding").is_valid_dataEncoding;
var is_dataEncoding = require("lib/misc/data_encoding").is_dataEncoding;


var UADataType = require("./ua_data_type").UADataType;
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

var findBuiltInType = require("lib/misc/factories_builtin_types").findBuiltInType;

/*==
 *
 *
 * @param __address_space
 * @param dataTypeNodeId : the nodeId matching the dataType of the destination variable.
 * @param variantDataType: the dataType of the variant to write to the destination variable
 * @param nodeId
 * @return {boolean} true if the variant datatype is compatible with the Variable DataType
 */
function validateDataType(__address_space, dataTypeNodeId, variantDataType, nodeId) {

    if (variantDataType === DataType.ExtensionObject) {
        return true;
    }
    var builtInType, builtInUADataType;

    var destUADataType = __address_space.findObject(dataTypeNodeId);
    assert(destUADataType instanceof UADataType);

    if (destUADataType.isAbstract) {
        builtInUADataType = destUADataType;
    } else {
        builtInType = findBuiltInType(destUADataType.browseName).name;
        builtInUADataType = __address_space.findDataType(builtInType);
    }
    assert(builtInUADataType instanceof UADataType);


    // The value supplied for the attribute is not of the same type as the  value.
    var variantUADataType = _dataType_toUADataType(__address_space, variantDataType);
    assert(variantUADataType instanceof UADataType);

    var dest_isSuperTypeOf_variant = variantUADataType.isSupertypeOf(builtInUADataType);

    function debugValidateDataType() {
        if (dest_isSuperTypeOf_variant) {
            /* istanbul ignore next*/
            console.log(" ---------- Type match !!! ".green, " on ", nodeId.toString());
        } else {
            /* istanbul ignore next*/
            console.log(" ---------- Type mismatch ".red, " on ", nodeId.toString());
        }
        console.log(" Variable data Type is    = ".cyan, destUADataType.browseName.toString());
        console.log(" which matches basic Type = ".cyan, builtInUADataType.browseName.toString());
        console.log("        Actual   dataType = ".yellow, variantUADataType.browseName.toString());

    }

    /* istanbul ignore next */
    if (doDebug) {
        debugValidateDataType();
    }

    return (dest_isSuperTypeOf_variant);

}


/**
 * A OPCUA Variable Node
 *
 * @class UAVariable
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

function UAVariable(options) {

    var self = this;

    BaseNode.apply(this, arguments);

    // assert(self.typeDefinition.value === self.resolveNodeId("VariableTypeNode").value);

    /**
     * @property dataType
     * @type {NodeId}
     */
    self.dataType = self.resolveNodeId(options.dataType);    // DataType (NodeId)
    assert(self.dataType instanceof NodeId);

    /**
     * @property valueRank
     * @type {number} UInt32
     */
    self.valueRank = options.valueRank || 0;  // UInt32
    assert(typeof self.valueRank === "number");

    self.arrayDimensions = options.arrayDimensions || null;
    assert(_.isNull(self.arrayDimensions) || _.isArray(self.arrayDimensions));

    self.accessLevel = adjust_accessLevel(options.accessLevel);

    self.userAccessLevel = adjust_userAccessLevel(options.userAccessLevel);

    self.minimumSamplingInterval = adjust_samplingInterval(options.minimumSamplingInterval);

    self.parentNodeId = options.parentNodeId;

    self.historizing = options.historizing;

    self._dataValue = new DataValue({statusCode: StatusCodes.BadNodeIdUnknown, value: {}});

    if (options.value) {
        self.bindVariable(options.value);
    }
}
util.inherits(UAVariable, BaseNode);
UAVariable.prototype.nodeClass = NodeClass.Variable;


UAVariable.prototype.isWritable = function () {
    return this.accessLevel.has("CurrentWrite") && this.userAccessLevel.has("CurrentWrite");
};


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
 * Table 51 Read Operation Level Result Codes
 *
 *  Symbolic Id                 Description
 *
 *  BadNodeIdInvalid            The syntax of the node id is not valid.
 *  BadNodeIdUnknown            The node id refers to a node that does not exist in the server address space.
 *  BadAttributeIdInvalid       Bad_AttributeIdInvalid The attribute is not supported for the specified node.
 *  BadIndexRangeInvalid        The syntax of the index range parameter is invalid.
 *  BadIndexRangeNoData         No data exists within the range of indexes specified.
 *  BadDataEncodingInvalid      The data encoding is invalid.
 *                              This result is used if no dataEncoding can be applied because an Attribute other than
 *                              Value was requested or the DataType of the Value Attribute is not a subtype of the
 *                              Structure DataType.
 *  BadDataEncodingUnsupported  The server does not support the requested data encoding for the node.
 *                              This result is used if a dataEncoding can be applied but the passed data encoding is not
 *                              known to the Server.
 *  BadNotReadable              The access level does not allow reading or subscribing to the Node.
 *  BadUserAccessDenied         User does not have permission to perform the requested operation. (table 165)
 */
UAVariable.prototype.readValue = function (indexRange, dataEncoding) {

    var self = this;
    if (!is_valid_dataEncoding(dataEncoding)) {
        return new DataValue({statusCode: StatusCodes.BadDataEncodingInvalid});
    }

    var dataValue = self._dataValue;

    if (isGoodish(dataValue.statusCode)) {

        dataValue = extractRange(dataValue, indexRange);
    }

    /* istanbul ignore next */
    if (dataValue.statusCode === StatusCodes.BadNodeIdUnknown) {
        console.log(" Warning:  ", self.browseName, self.nodeId.toString(), "exists but dataValue has not been defined");
    }
    return dataValue;
};

UAVariable.prototype._readDataType = function () {
    assert(this.dataType instanceof NodeId);
    var options = {
        value: {dataType: DataType.NodeId, value: this.dataType},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

UAVariable.prototype._readValueRank = function () {
    assert(typeof this.valueRank === "number");
    var options = {
        value: {dataType: DataType.Int32, value: this.valueRank},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

UAVariable.prototype._readArrayDimensions = function () {
    assert(_.isArray(this.arrayDimensions) || this.arrayDimensions === null);
    var options = {
        value: {dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: this.arrayDimensions},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

UAVariable.prototype._readAccessLevel = function () {
    var options = {
        value: {dataType: DataType.Byte, value: this.accessLevel.value},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

UAVariable.prototype._readUserAccessLevel = function () {
    var options = {
        value: {dataType: DataType.Byte, value: this.userAccessLevel.value},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

UAVariable.prototype._readMinimumSamplingInterval = function () {
    var options = {};
    if (this.minimumSamplingInterval === undefined) {
        options.statusCode = StatusCodes.BadAttributeIdInvalid;
    } else {
        options.value = {dataType: DataType.Int32, value: this.minimumSamplingInterval};
        options.statusCode = StatusCodes.Good;
    }
    return new DataValue(options);
};

UAVariable.prototype._readHistorizing = function () {
    var options = {
        value: {dataType: DataType.Boolean, value: this.historizing},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

/**
 * @method readAttribute
 * @param attributeId {AttributeIds} the attributeId to read
 * @param indexRange {NumericRange || null}
 * @param dataEncoding {String}
 * @return {DataValue}
 */
UAVariable.prototype.readAttribute = function (attributeId, indexRange, dataEncoding) {

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

        case AttributeIds.DataType:
            return this._readDataType();

        case AttributeIds.ValueRank:
            return this._readValueRank();

        case AttributeIds.ArrayDimensions:
            return this._readArrayDimensions();

        case AttributeIds.AccessLevel:
            return this._readAccessLevel();

        case AttributeIds.UserAccessLevel:
            return this._readUserAccessLevel();

        case AttributeIds.MinimumSamplingInterval:
            return this._readMinimumSamplingInterval();

        case AttributeIds.Historizing:
            return this._readHistorizing();

        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
    }

};


UAVariable.prototype._validate_DataType = function (variantDataType) {

    return validateDataType(this.__address_space, this.dataType, variantDataType, this.nodeId);
};


function check_valid_array(dataType, array) {
    if (_.isArray(array)) {
        return true;
    }
    switch (dataType) {
        case DataType.Double:
            return array instanceof Float64Array;
        case DataType.Float:
            return array instanceof Float32Array;
        case DataType.Int32:
            return array instanceof Int32Array;
        case DataType.Int16:
            return array instanceof Int16Array;
        case DataType.SByte:
            return array instanceof Int8Array;
        case DataType.UInt32:
            return array instanceof Uint32Array;
        case DataType.UInt16:
            return array instanceof Uint16Array;
        case DataType.Byte:
            return array instanceof Uint8Array || array instanceof Buffer;
    }
    return false;
}


/**
 * setValueFromSource is used to let the device sets the variable values
 * this method also records the current time as sourceTimestamp and serverTimestamp.
 * the method broadcasts an "value_changed" event
 * @method setValueFromSource
 * @param variant
 * @param statusCode
 */
UAVariable.prototype.setValueFromSource = function (variant, statusCode) {
    variant = (variant instanceof Variant) ? variant : new Variant(variant);
    assert(variant instanceof Variant);
    var self = this;
    var now = new Date();
    var dataValue = new DataValue({
        sourceTimestamp: now,
        sourcePicoseconds: 0,
        serverTimestamp: now,
        serverPicoseconds: 0,
        statusCode: statusCode || StatusCodes.Good
    });
    dataValue.value = variant;
    self._internal_set_dataValue(dataValue, null);
};

var Range = require("lib/data_access/Range").Range;
function validate_value_range(range, variant) {
    assert(range instanceof Range);
    assert(variant instanceof Variant);
    if (variant.value < range.low || variant.value > range.high) {
        return false;
    }
    return true;
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
UAVariable.prototype.writeValue = function (dataValue, indexRange, callback) {

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
        return callback(null, StatusCodes.BadNotWritable);
    }

    // adjust special case
    // convert Variant( Scalar|ByteString) =>  Variant(Array|ByteArray)
    var variant = dataValue.value;
    if (variant.arrayType === VariantArrayType.Scalar && variant.dataType === DataType.ByteString) {
        if ((self.dataType.value === 3) && (self.dataType.namespace === 0)) { // Byte
            variant.arrayType = VariantArrayType.Array;
            variant.dataType = DataType.Byte;
        }
    }

    // test dataType
    if (!self._validate_DataType(dataValue.value.dataType)) {
        return callback(null, StatusCodes.BadTypeMismatch);
    }

    if (self.$instrumentRange) {
        if (!validate_value_range(self.$instrumentRange, dataValue.value)) {
            return callback(null, StatusCodes.BadOutOfRange);
        }
    }

    assert(self._timestamped_set_func);
    self._timestamped_set_func(dataValue, indexRange, function (err, statusCode, correctedDataValue) {

        if (!err) {

            correctedDataValue = correctedDataValue || dataValue;
            assert(correctedDataValue instanceof DataValue);

            if (indexRange && !indexRange.isEmpty()) {

                if (!indexRange.isValid()) {
                    return callback(null, StatusCodes.BadIndexRangeInvalid);
                }

                var newArr = dataValue.value.value;
                // check that source data is an array
                if (dataValue.value.arrayType !== VariantArrayType.Array) {
                    return callback(null, StatusCodes.BadTypeMismatch);
                }

                // check that destination data is also an array
                assert(check_valid_array(self._dataValue.value.dataType, self._dataValue.value.value));
                var destArr = self._dataValue.value.value;
                var result = indexRange.set_values(destArr, newArr);

                if (result.statusCode !== StatusCodes.Good) {
                    return callback(null, result.statusCode);
                }
                dataValue.value.value = result.array;
            }
            self._internal_set_dataValue(correctedDataValue, indexRange);
            //xx self._dataValue = correctedDataValue;
        }
        callback(err, statusCode);
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
 */
UAVariable.prototype.writeAttribute = function (writeValue, callback) {

    assert(writeValue instanceof WriteValue);
    assert(writeValue.value instanceof DataValue);
    assert(writeValue.value.value instanceof Variant);
    assert(_.isFunction(callback));

    // Spec 1.0.2 Part 4 page 58
    // If the SourceTimestamp or the ServerTimestamp is specified, the Server shall
    // use these values.
    if (!writeValue.value.sourceTimestamp) {
        writeValue.value.sourceTimestamp = new Date();
        writeValue.value.sourcePicoseconds = 0;
    }
    if (!writeValue.value.serverTimestamp) {
        writeValue.value.serverTimestamp = new Date();
        writeValue.value.serverPicosecons = 0;
    }

    switch (writeValue.attributeId) {
        case AttributeIds.Value:
            this.writeValue(writeValue.value, writeValue.indexRange, callback);
            break;
        default:
            BaseNode.prototype.writeAttribute.call(this, writeValue, callback);
    }
};

function _not_writable_timestamped_set_func(dataValue, callback) {
    assert(dataValue instanceof DataValue);
    callback(null, StatusCodes.BadNotWritable, null);
}

function _default_writable_timestamped_set_func(dataValue, callback) {
    /* jshint validthis: true */
    assert(dataValue instanceof DataValue);
    callback(null, StatusCodes.Good, dataValue);
}

function turn_sync_to_async(f, numberOfArgs) {
    if (f.length <= numberOfArgs) {
        return function (data, callback) {
            var r = f(data);
            setImmediate(function () {
                return callback(null, r);
            });
        };
    } else {
        assert(f.length === numberOfArgs + 1);
        return f;
    }
}


// variation #3 :
function _Variable_bind_with_async_refresh(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof UAVariable);

    assert(_.isFunction(options.refreshFunc));
    assert(!options.get, "a getter shall not be specified when refreshFunc is set");
    assert(!options.timestamped_get, "a getter shall not be specified when refreshFunc is set");

    assert(!self.asyncRefresh);
    assert(!self.refreshFunc);

    self.refreshFunc = options.refreshFunc;

    self.asyncRefresh = function (callback) {

        self.refreshFunc.call(self, function (err, dataValue) {
            if (err || !dataValue) {
                dataValue = {statusCode: StatusCodes.BadNoDataAvailable};
            }
            self._internal_set_dataValue(dataValue, null);
            callback(err, self._dataValue);
        });
    };

    assert(self._dataValue.statusCode === StatusCodes.BadNodeIdUnknown);
    self._dataValue.statusCode = StatusCodes.UncertainInitialValue;

}

// variation 2
function _Variable_bind_with_timestamped_get(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof UAVariable);
    assert(_.isFunction(options.timestamped_get));
    assert(!options.get, "should not specify 'get' when 'timestamped_get' exists ");
    assert(!self._timestamped_get_func);

    self._timestamped_get_func = options.timestamped_get;

    var dataValue_verify = self._timestamped_get_func();
    /* istanbul ignore next */
    if (!(dataValue_verify instanceof DataValue)) {
        console.log(" Bind variable error: ".red, " : the timestamped_get function must return a DataValue");
        console.log("value_check.constructor.name ", dataValue_verify ? dataValue_verify.constructor.name : "null");
        throw new Error(" Bind variable error: ".red, " : the timestamped_get function must return a DataValue");
    }

    function async_refresh_func(callback) {
        var dataValue = self._timestamped_get_func();
        callback(null, dataValue);
    }

    _Variable_bind_with_async_refresh.call(self, {refreshFunc: async_refresh_func});

}


// variation 1
function _Variable_bind_with_simple_get(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof UAVariable);
    assert(_.isFunction(options.get), "should  specify get function");
    assert(options.get.length === 0, "get function should not have arguments");
    assert(!options.timestamped_get, "should not specify a timestamped_get function when get is specified");
    assert(!self._timestamped_get_func);
    assert(!self._get_func);

    self._get_func = options.get;

    function timestamped_get_func_from__Variable_bind_with_simple_get() {

        var value = self._get_func();

        /* istanbul ignore next */
        if (!is_Variant_or_StatusCode(value)) {
            console.log(" Bind variable error: ".red, " : the getter must return a Variant or a StatusCode");
            console.log("value_check.constructor.name ", value ? value.constructor.name : "null");
            throw new Error(" bindVariable : the value getter function returns a invalid result ( expecting a Variant or a StatusCode !!!");
        }
        if (is_StatusCode(value)) {
            return new DataValue({statusCode: value});

        } else {
            return new DataValue({
                statusCode: StatusCodes.Good,
                value: value,
                serverTimestamp: new Date(),
                serverPicoseconds: 0,
                sourceTimestamp: new Date(),
                sourcePicoseconds: 0
            });
        }
    }

    _Variable_bind_with_timestamped_get.call(self, {timestamped_get: timestamped_get_func_from__Variable_bind_with_simple_get});
}

function _Variable_bind_with_simple_set(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof UAVariable);
    assert(_.isFunction(options.set), "should specify set function");
    assert(!options.timestamped_set, "should not specify a timestamped_set function");

    assert(!self._timestamped_set_func);
    assert(!self._set_func);

    self._set_func = turn_sync_to_async(options.set, 1);
    assert(self._set_func.length === 2, " set function must have 2 arguments ( variant, callback)");

    self._timestamped_set_func = function (timestamped_value, indexRange, callback) {
        assert(timestamped_value instanceof DataValue);
        self._set_func(timestamped_value.value, function (err, statusCode) {
            callback(err, statusCode, timestamped_value);
        });
    };
}
function _Variable_bind_with_timestamped_set(options) {

    /* jshint validthis: true */
    var self = this;
    assert(self instanceof UAVariable);
    assert(_.isFunction(options.timestamped_set));
    assert(!options.set, "should not specify set when timestamped_set_func exists ");
    self._timestamped_set_func = function (dataValue, indexRange, callback) {
        //xx assert(!indexRange,"indexRange Not Implemented");
        return options.timestamped_set(dataValue, callback);
    };
}


function sourceTimestampHasChanged(dataValue1, dataValue2) {

    return (dataValue1.sourceTimestamp !== dataValue2.sourceTimestamp ||
    dataValue1.sourcePicoseconds !== dataValue2.sourcePicoseconds);
}

UAVariable.prototype._internal_set_dataValue = function (dataValue, indexRange) {

    var self = this;

    var old_dataValue = self._dataValue;

    self._dataValue = dataValue;
    self._dataValue.statusCode = self._dataValue.statusCode || StatusCodes.Good;

    if (sourceTimestampHasChanged(old_dataValue, dataValue)) {
        self.emit("value_changed", self._dataValue, indexRange);
    }
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
 *          return StatusCodes.Good;
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
 * This variation can be used when the user wants to specify a specific '''sourceTimestamp''' associated
 * with the current value of the UAVariable.
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
 * * the second argument shall be a DataValuewith the new UAVariable Value,  a StatusCode, and time stamps.
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
UAVariable.prototype.bindVariable = function (options) {

    var self = this;
    options = options || {};

    function bind_getter(options) {

        if (_.isFunction(options.get)) {                                   // variation 1
            _Variable_bind_with_simple_get.call(self, options);

        } else if (_.isFunction(options.timestamped_get)) {                // variation 2
            _Variable_bind_with_timestamped_get.call(self, options);

        } else if (_.isFunction(options.refreshFunc)) {                     // variation 3
            _Variable_bind_with_async_refresh.call(self, options);

        } else {
            assert(!options.set, "getter is missing : a getter must be provided if a setter is provided");
            //xx bind_variant.call(self,options);
            self.setValueFromSource(options);
        }
    }

    bind_getter(options);
    //xx console.log(self.browseName,self._dataValue.toString());
    //assert(_.isFunction(self.refreshFunc));

    function bind_setter(options) {

        if (_.isFunction(options.set)) {                                    // variation 1
            _Variable_bind_with_simple_set.call(self, options);

        } else if (_.isFunction(options.timestamped_set)) {                 // variation 2
            assert(_.isFunction(options.timestamped_get, "timestamped_set must be used with timestamped_get "));
            _Variable_bind_with_timestamped_set.call(self, options);

        } else if (_.isFunction(options.timestamped_get)) {
            // timestamped_get is  specified but timestamped_set is not
            // => Value is read-only
            _Variable_bind_with_timestamped_set.call(self, {timestamped_set: _not_writable_timestamped_set_func});

        } else {
            _Variable_bind_with_timestamped_set.call(self, {timestamped_set: _default_writable_timestamped_set_func});
        }
    }

    bind_setter(options);
    assert(_.isFunction(self._timestamped_set_func));
    assert(self._timestamped_set_func.length === 3);
};


/**
 * @method readValueAsync
 * @param callback {Function}
 * @param callback.err   {null|Error}
 * @param callback.dataValue {DataValue|null} the value read
 * @async
 */
UAVariable.prototype.readValueAsync = function (callback) {

    var self = this;

    self.__waiting_callbacks = self.__waiting_callbacks || [];
    self.__waiting_callbacks.push(callback);

    var _readValueAsync_in_progress = self.__waiting_callbacks.length >= 2;
    if (_readValueAsync_in_progress) {
        return;
    }
    function readImmediate(callback) {
        assert(self._dataValue instanceof DataValue);
        callback(null, self._dataValue);
    }

    var func = _.isFunction(self.asyncRefresh) ? self.asyncRefresh : readImmediate;

    function satisify_callbacks(err, dataValue) {
        // now call all pending callbacks
        var callbacks = self.__waiting_callbacks;
        self.__waiting_callbacks = [];
        callbacks.forEach(function (callback) {
            callback.call(self, err, dataValue);
        });
    }

    try {
        func.call(this, satisify_callbacks);
    }
    catch (err) {
        // istanbul ignore next
        console.log("func has failed ".red);
        satisify_callbacks(err);
    }
};

UAVariable.prototype.getWriteMask = function () {
    return BaseNode.prototype.getWriteMask.call(this);
};

UAVariable.prototype.getUserWriteMask = function () {
    return BaseNode.prototype.getUserWriteMask.call(this);
};

UAVariable.prototype.clone = function () {

    var self = this;
    var options = {
        eventNotifier: self.eventNotifier,
        symbolicName: self.symbolicName,
        value: self.value,
        dataType: self.dataType,
        valueRank: self.valueRank,
        arrayDimensions: self.arrayDimensions,
        accessLevel: self.accessLevel,
        userAccessLevel: self.userAccessLevel,
        minimumSamplingInterval: self.minimumSamplingInterval,
        historizing: self.historizing
    };
    var newVariable = self._clone(UAVariable, options);

    assert(newVariable.dataType === self.dataType);
    newVariable._dataValue = self._dataValue.clone();
    return newVariable;

};
exports.UAVariable = UAVariable;
