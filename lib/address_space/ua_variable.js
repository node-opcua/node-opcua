"use strict";
/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var SessionContext = require("lib/server/session_context").SessionContext;

var DataValue = require("lib/datamodel/datavalue").DataValue;
var extractRange = require("lib/datamodel/datavalue").extractRange;

var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var historizing_service = require("lib/services/historizing_service");
var AttributeIds = read_service.AttributeIds;

var assert = require("better-assert");
var util = require("util");
var utils = require("lib/misc/utils");

var _ = require("underscore");

var BaseNode = require("lib/address_space/base_node").BaseNode;
var makeAccessLevel = require("lib/datamodel/access_level").makeAccessLevel;
var write_service = require("lib/services/write_service");
var WriteValue = write_service.WriteValue;

var HistoryReadResult = historizing_service.HistoryReadResult;

var utils =  require("lib/misc/utils");
var debugLog = utils.make_debugLog(__filename);
var doDebug = utils.checkDebugFlag(__filename);

function isGoodish(statusCode) {
    return statusCode.value < 0x10000000;
}

function adjust_accessLevel(accessLevel) {

    accessLevel = utils.isNullOrUndefined(accessLevel) ?  "CurrentRead | CurrentWrite" : accessLevel;
    accessLevel = makeAccessLevel(accessLevel);
    assert(_.isFinite(accessLevel.value));
    return accessLevel;
}

function adjust_userAccessLevel(accessLevel) {
    accessLevel = utils.isNullOrUndefined(accessLevel) ?  "CurrentRead | CurrentWrite" : accessLevel;
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
    return v && v.constructor &&
        (
            v.constructor.name === "ConstantStatusCode" ||
            v.constructor.name === "StatusCode" ||
            v.constructor.name === "ModifiableStatusCode"
        ) ;
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
function _dataType_toUADataType(addressSpace, dataType) {

    assert(addressSpace);
    assert(dataType && dataType.hasOwnProperty("key"));

    var dataTypeNode = addressSpace.findDataType(dataType.key);
    /* istanbul ignore next */
    if (!dataTypeNode) {
        throw new Error(" Cannot find DataType " + dataType.key + " in address Space");
    }
    return dataTypeNode;
}

var findBuiltInType = require("lib/misc/factories_builtin_types").findBuiltInType;

/*=
 *
 * @param addressSpace
 * @param dataTypeNodeId : the nodeId matching the dataType of the destination variable.
 * @param variantDataType: the dataType of the variant to write to the destination variable
 * @param nodeId
 * @return {boolean} true if the variant dataType is compatible with the Variable DataType
 */
function validateDataType(addressSpace, dataTypeNodeId, variantDataType, nodeId) {

    if (variantDataType === DataType.ExtensionObject) {
        return true;
    }
    var builtInType, builtInUADataType;

    var destUADataType = addressSpace.findNode(dataTypeNodeId);
    assert(destUADataType instanceof UADataType);

    if (destUADataType.isAbstract) {
        builtInUADataType = destUADataType;
    } else {
        builtInType = findBuiltInType(destUADataType.browseName).name;
        builtInUADataType = addressSpace.findDataType(builtInType);
    }
    assert(builtInUADataType instanceof UADataType);


    // The value supplied for the attribute is not of the same type as the  value.
    var variantUADataType = _dataType_toUADataType(addressSpace, variantDataType);
    assert(variantUADataType instanceof UADataType);

    var dest_isSuperTypeOf_variant = variantUADataType.isSupertypeOf(builtInUADataType);



    /* istanbul ignore next */
    if (doDebug) {
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

    return (dest_isSuperTypeOf_variant);

}

var sameVariant = require("lib/datamodel/variant_tools").sameVariant;

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
     * This Attribute indicates whether the Value Attribute of the Variable is an array and how many dimensions
     * the array has.
     * It may have the following values:
     *  n > 1:                      the Value is an array with the specified number of dimensions.
     *  OneDimension (1):           The value is an array with one dimension.
     *  OneOrMoreDimensions (0):    The value is an array with one or more dimensions.
     *  Scalar (?1):                The value is not an array.
     *  Any (?2):                   The value can be a scalar or an array with any number of dimensions.
     *  ScalarOrOneDimension (?3):  The value can be a scalar or a one dimensional array.
     *  NOTE All DataTypes are considered to be scalar, even if they have array-like semantics
     *  like ByteString and String.
     */
    self.valueRank = options.valueRank || 0;  // UInt32
    assert(typeof self.valueRank === "number");

    /**
     * This Attribute specifies the length of each dimension for an array value. T
     * @property arrayDimensions
     * @type {number[]} UInt32
     * The Attribute is intended to describe the capability of the Variable, not the current size.
     * The number of elements shall be equal to the value of the ValueRank Attribute. Shall be null
     * if ValueRank ? 0.
     * A value of 0 for an individual dimension indicates that the dimension has a variable length.
     * For example, if a Variable is defined by the following C array:
     * Int32 myArray[346];
     *     then this Variable�s DataType would point to an Int32, the Variable�s ValueRank has the
     *     value 1 and the ArrayDimensions is an array with one entry having the value 346.
     *     Note that the maximum length of an array transferred on the wire is 2147483647 (max Int32)
     *     and a multidimentional array is encoded as a one dimensional array.
     */
    self.arrayDimensions = options.arrayDimensions || null;
    assert(_.isNull(self.arrayDimensions) || _.isArray(self.arrayDimensions));

    /**
     * @property accessLevel
     * @type {number}
     */
    self.accessLevel = adjust_accessLevel(options.accessLevel);

    /**
     * @property userAccessLevel
     * @type {number}
     *
     */
    self.userAccessLevel = adjust_userAccessLevel(options.userAccessLevel);

    /**
     * The MinimumSamplingInterval Attribute indicates how �current� the Value of the Variable will
     * be kept.
     * @property minimumSamplingInterval
     * @type {number} [Optional]
     *  It specifies (in milliseconds) how fast the Server can reasonably sample the value
     * for changes (see Part 4 for a detailed description of sampling interval).
     * A MinimumSamplingInterval of 0 indicates that the Server is to monitor the item continuously.
     * A MinimumSamplingInterval of -1 means indeterminate.
     */
    self.minimumSamplingInterval = adjust_samplingInterval(options.minimumSamplingInterval);

    self.parentNodeId = options.parentNodeId;

    /**
     * The Historizing Attribute indicates whether the Server is actively collecting data for the
     * history of the Variable.
     * @property historizing
     * @type {Boolean}
     *  This differs from the AccessLevel Attribute which identifies if the
     * Variable has any historical data. A value of TRUE indicates that the Server is actively c
     * ollecting data. A value of FALSE indicates the Server is not actively collecting data.
     * Default value is FALSE.
     */
    self.historizing = !!options.historizing; // coerced to boolean

    self._dataValue = new DataValue({statusCode: StatusCodes.BadWaitingForInitialData, value: {}});

    if (options.value) {
        self.bindVariable(options.value);
    }

    if (options.permissions) {
        self.setPermissions(options.permissions);
    }
    this.setMaxListeners(5000);

    self.semantic_version = 0;

    self.permission = null;
}
util.inherits(UAVariable, BaseNode);
UAVariable.prototype.nodeClass = NodeClass.Variable;


/**
 *
 *
 * @param context
 * @returns {boolean}
 */
UAVariable.prototype.isReadable = function (context) {
    assert(context instanceof SessionContext);
    return this.accessLevel.has("CurrentRead");
};

UAVariable.prototype.isUserReadable = function (context) {
    var self = this;
    assert(context instanceof SessionContext);
    if (context.checkPermission) {
        assert(context.checkPermission instanceof Function);
        return context.checkPermission(self, "CurrentRead");
    }
    return this.userAccessLevel.has("CurrentRead");
};

/**
 *
 *
 * @param context
 * @returns {boolean}
 */
UAVariable.prototype.isWritable = function (context) {
    assert(context instanceof SessionContext);
    return this.accessLevel.has("CurrentWrite");
};
UAVariable.prototype.isUserWritable = function (context) {
    var self = this;
    assert(context instanceof SessionContext);
    if (context.checkPermission) {
        assert(context.checkPermission instanceof Function);
        return context.checkPermission(self, "CurrentWrite");
    }
    return this.userAccessLevel.has("CurrentWrite");
};


/**
 *
 * @method readValue
 * @param [context] {SessionContext}
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
UAVariable.prototype.readValue = function (context, indexRange, dataEncoding) {

    if (!context) {
        context = SessionContext.defaultContext;
    }
    var self = this;

    if (!self.isReadable(context)) {
        return new DataValue({statusCode: StatusCodes.BadNotReadable});
    }
    if (!self.isUserReadable(context)) {
        return new DataValue({statusCode: StatusCodes.BadUserAccessDenied});
    }
    if (!is_valid_dataEncoding(dataEncoding)) {
        return new DataValue({statusCode: StatusCodes.BadDataEncodingInvalid});
    }

    if (self._timestamped_get_func) {
        assert(self._timestamped_get_func.length === 0);
        self._dataValue = self._timestamped_get_func();
    }

    var dataValue = self._dataValue;

    if (isGoodish(dataValue.statusCode)) {

        dataValue = extractRange(dataValue, indexRange);
    }

    /* istanbul ignore next */
    if (dataValue.statusCode === StatusCodes.BadWaitingForInitialData) {
        debugLog(" Warning:  UAVariable#readValue ".red +  self.browseName.toString().cyan+ " ("+ self.nodeId.toString().yellow + ") exists but dataValue has not been defined");
    }
    return dataValue;
};


UAVariable.prototype._getEnumValues = function() {

    var self = this;
    // DataType must be one of Enumeration
    var dataTypeNode = self.addressSpace.findDataType(self.dataType);

    var enumerationNode = self.addressSpace.findDataType("Enumeration");
    assert(dataTypeNode.isSupertypeOf(enumerationNode));

    return dataTypeNode._getDefinition();
};



UAVariable.prototype.readEnumValue = function() {

    var self = this;
    var indexes = self._getEnumValues();
    var value = self.readValue().value.value;
    return { value: value, name: indexes.valueIndex[value].name };
};

/***
 * @method writeEnumValue
 * @param value {String|Number}
 */
UAVariable.prototype.writeEnumValue = function(value) {

    var self = this;
    var indexes = self._getEnumValues();

    if (_.isString(value)) {

        if (!indexes.nameIndex.hasOwnProperty(value)) {
            throw new Error("UAVariable#writeEnumValue: cannot find value "+ value);
        }
        var valueIndex  = indexes.nameIndex[value].value;
        value =valueIndex;
    }
    if(_.isFinite(value)) {

        if (!indexes.valueIndex[value]) {
            throw new Error("UAVariable#writeEnumValue : value out of range",value);
        }
        self.setValueFromSource({ dataType: DataType.Int32, value: value});
    } else {
        throw new Error("UAVariable#writeEnumValue:  value type mismatch");
    }
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

UAVariable.prototype._readAccessLevel = function (context) {
    assert(context instanceof SessionContext);
    var options = {
        value: {dataType: DataType.Byte, value: this.accessLevel.value},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

UAVariable.prototype._readUserAccessLevel = function (context) {
    assert(context instanceof SessionContext);
    var options = {
        value: {dataType: DataType.Byte, value: this.userAccessLevel.value},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

UAVariable.prototype._readMinimumSamplingInterval = function () {
    // expect a Duration => Double
    var options = {};
    if (this.minimumSamplingInterval === undefined) {
        options.statusCode = StatusCodes.BadAttributeIdInvalid;
    } else {
        options.value = {dataType: DataType.Double, value: this.minimumSamplingInterval};
        options.statusCode = StatusCodes.Good;
    }
    return new DataValue(options);
};

UAVariable.prototype._readHistorizing = function () {
    assert(typeof(this.historizing) === "boolean");
    var options = {
        value: {dataType: DataType.Boolean, value: !!this.historizing},
        statusCode: StatusCodes.Good
    };
    return new DataValue(options);
};

/**
 * @method readAttribute
 * @param  context      {SessionContext}
 * @param  attributeId {AttributeIds} the attributeId to read
 * @param  indexRange {NumericRange || null}
 * @param  dataEncoding {String}
 * @return {DataValue}
 */
UAVariable.prototype.readAttribute = function (context, attributeId, indexRange, dataEncoding) {

    if (!context) {
        context = SessionContext.defaultContext;
    }
    assert(context instanceof SessionContext);

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
            return this.readValue(context, indexRange, dataEncoding);

        case AttributeIds.DataType:
            return this._readDataType();

        case AttributeIds.ValueRank:
            return this._readValueRank();

        case AttributeIds.ArrayDimensions:
            return this._readArrayDimensions();

        case AttributeIds.AccessLevel:
            return this._readAccessLevel(context);

        case AttributeIds.UserAccessLevel:
            return this._readUserAccessLevel(context);

        case AttributeIds.MinimumSamplingInterval:
            return this._readMinimumSamplingInterval();

        case AttributeIds.Historizing:
            return this._readHistorizing();

        default:
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }

};

/**
 * @method historyRead
 * @param context {SessionContext}
 * @param historyReadDetails {HistoryReadDetails}
 * @param indexRange {NumericRange || null}
 * @param dataEncoding {String}
 * @param continuationPoint {ByteString}
 * @param callback {Function}
 * @param callback.err
 * @param callback.result {HistoryReadResult}
 */
UAVariable.prototype.historyRead = function (context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {

    assert(context instanceof SessionContext);
    assert(callback instanceof Function);

    if (typeof this["_historyRead"] != "function") {
        return callback(null, new HistoryReadResult({statusCode: StatusCodes.BadNotReadable}));
    }

    if (continuationPoint) {
        console.warn(" Continuation point not supported in HistoryRead");
    }
    this._historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback);
};


UAVariable.prototype._validate_DataType = function (variantDataType) {

    return validateDataType(this.addressSpace, this.dataType, variantDataType, this.nodeId);
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
 * @param variant  {Variant}
 * @param [statusCode  {StatusCode} == StatusCodes.Good]
 * @param [sourceTimestamp= Now]
 */
UAVariable.prototype.setValueFromSource = function (variant, statusCode , sourceTimestamp) {
    var self = this;

    // istanbul ignore next
    if (variant.hasOwnProperty("value")) {
        if (!variant.dataType) {
            throw new Error("Variant must provide a valid dataType" + variant.toString());
        }
    }
    variant =Variant.coerce(variant);

    var now = sourceTimestamp ||  new Date();


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

UAVariable.prototype.isValueInRange = function (value) {

    assert(value instanceof Variant);
    var self = this;
    // test dataType
    if (!self._validate_DataType(value.dataType)) {
        return  StatusCodes.BadTypeMismatch;
    }

    // AnalogDataItem
    if (self.instrumentRange) {
        if (!validate_value_range(self.instrumentRange.readValue().value.value, value)) {
            return StatusCodes.BadOutOfRange;
        }
    }

    // MultiStateDiscreteType
    if (self.enumStrings) {
        var arrayEnumStrings = self.enumStrings.readValue().value.value;
        // MultiStateDiscreteType
        assert(value.dataType === DataType.UInt32);
        if(value.value >= arrayEnumStrings.length) {
            return StatusCodes.BadOutOfRange;
        }
    }

    // MultiStateValueDiscreteType
    if (self.enumValues && self.enumValues._index) {

        var e = self.enumValues._index[value.value];
        if (!e) {
            return StatusCodes.BadOutOfRange;
        }
    }

    return StatusCodes.Good;
};


function _apply_default_timestamps(dataValue)
{
    assert(dataValue instanceof DataValue);

    if (!dataValue.sourceTimestamp) {
        dataValue.sourceTimestamp = new Date();
        dataValue.sourcePicoseconds = 0;
    }
    if (!dataValue.serverTimestamp) {
        dataValue.serverTimestamp = new Date();
        dataValue.serverPicoseconds = 0;
    }
}

/**
 * @method writeValue
 * @param context {SessionContext}
 * @param dataValue {DataValue}
 * @param [indexRange] {NumericRange}
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.statusCode {StatusCode}
 * @async
 *
 */
UAVariable.prototype.writeValue = function (context, dataValue, indexRange, callback) {

    if (!context) {
        context = SessionContext.defaultContext;
    }
    assert(context instanceof SessionContext);
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
    if (!self.isWritable(context)) {
        return callback(null, StatusCodes.BadNotWritable);
    }
    if (!self.isUserWritable(context)) {
        return callback(null, StatusCodes.BadUserAccessDenied);
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

    var statusCode = self.isValueInRange(dataValue.value);
    if (statusCode !== StatusCodes.Good) {
        return callback(null,statusCode);
    }

    if(!self._timestamped_set_func) {
        console.log(" warning "+self.nodeId.toString() +" has no _timestamped_set_func");
        return callback(null,StatusCodes.BadNotWritable);
    }

    assert(self._timestamped_set_func);
    self._timestamped_set_func(dataValue, indexRange, function (err, statusCode, correctedDataValue) {

        if (!err) {

            correctedDataValue = correctedDataValue || dataValue;
            assert(correctedDataValue instanceof DataValue);
            //xx assert(correctedDataValue.serverTimestamp);

            if (indexRange && !indexRange.isEmpty()) {

                if (!indexRange.isValid()) {
                    return callback(null, StatusCodes.BadIndexRangeInvalid);
                }

                var newArr = correctedDataValue.value.value;
                // check that source data is an array
                if (correctedDataValue.value.arrayType !== VariantArrayType.Array) {
                    return callback(null, StatusCodes.BadTypeMismatch);
                }

                // check that destination data is also an array
                assert(check_valid_array(self._dataValue.value.dataType, self._dataValue.value.value));
                var destArr = self._dataValue.value.value;
                var result = indexRange.set_values(destArr, newArr);

                if (result.statusCode !== StatusCodes.Good) {
                    return callback(null, result.statusCode);
                }
                correctedDataValue.value.value = result.array;

                // scrap original array so we detect range
                self._dataValue.value.value = null;
            }
            self._internal_set_dataValue(correctedDataValue, indexRange);
            //xx self._dataValue = correctedDataValue;
        }
        callback(err, statusCode);
    });
};
/**
 * @method writeAttribute
 * @param context                 {SessionContext}
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
UAVariable.prototype.writeAttribute = function (context, writeValue, callback) {

    assert(context instanceof SessionContext);
    assert(writeValue instanceof WriteValue);
    assert(writeValue.value instanceof DataValue);
    assert(writeValue.value.value instanceof Variant);
    assert(_.isFunction(callback));

    // Spec 1.0.2 Part 4 page 58
    // If the SourceTimestamp or the ServerTimestamp is specified, the Server shall
    // use these values.

    //xx _apply_default_timestamps(writeValue.value);

    switch (writeValue.attributeId) {
            case AttributeIds.Value:
                this.writeValue(context, writeValue.value, writeValue.indexRange, callback);
            break;
        default:
            BaseNode.prototype.writeAttribute.call(this, context, writeValue, callback);
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

var MonitoredItem = require("lib/server/monitored_item").MonitoredItem;


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

    function coerceDataValue(dataValue) {
        if (dataValue instanceof DataValue) {
            return dataValue;
        }
        return new DataValue(dataValue);
    }

    self.asyncRefresh = function (callback) {

        self.refreshFunc.call(self, function (err, dataValue) {
            if (err || !dataValue) {
                dataValue = {statusCode: StatusCodes.BadNoDataAvailable};
            }
            dataValue = coerceDataValue(dataValue);
            self._internal_set_dataValue(dataValue, null);
            callback(err, self._dataValue);
        });
    };

    //assert(self._dataValue.statusCode === StatusCodes.BadNodeIdUnknown);
    self._dataValue.statusCode = StatusCodes.UncertainInitialValue;

    if (self.minimumSamplingInterval === 0 ) {
        // when a getter /timestamped_getter or async_getter is provided
        // samplingInterval cannot be 0, as the item value must be scanned to be updated.
        self.minimumSamplingInterval = MonitoredItem.minimumSamplingInterval;
        debugLog("adapting minimumSamplingInterval on " + self.browseName.toString() + " to " +  self.minimumSamplingInterval);
    }

}

// variation 2
function _Variable_bind_with_timestamped_get(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof UAVariable);
    assert(_.isFunction(options.timestamped_get));
    assert(!options.get, "should not specify 'get' when 'timestamped_get' exists ");
    assert(!self._timestamped_get_func);

    function async_refresh_func(callback) {
        var dataValue = self._timestamped_get_func();
        callback(null, dataValue);
    }

    if(options.timestamped_get.length === 0) {
        // sync version
        self._timestamped_get_func = options.timestamped_get;

        var dataValue_verify = self._timestamped_get_func();
        /* istanbul ignore next */
        if (!(dataValue_verify instanceof DataValue)) {
            console.log(" Bind variable error: ".red, " : the timestamped_get function must return a DataValue");
            console.log("value_check.constructor.name ", dataValue_verify ? dataValue_verify.constructor.name : "null");
            throw new Error(" Bind variable error: ".red, " : the timestamped_get function must return a DataValue");
        }
        _Variable_bind_with_async_refresh.call(self, {refreshFunc: async_refresh_func});

    } else   if(options.timestamped_get.length === 1) {


        _Variable_bind_with_async_refresh.call(self, {refreshFunc: options.timestamped_get});

    } else {
        throw new Error("timestamped_get has a invalid number of argument , should be 0 or 1  ");
    }

}


// variation 1
function _Variable_bind_with_simple_get(options) {
    /* jshint validthis: true */
    var self = this;
    assert(self instanceof UAVariable);
    assert(_.isFunction(options.get), "should specify get function");
    assert(options.get.length === 0,  "get function should not have arguments");
    assert(!options.timestamped_get,  "should not specify a timestamped_get function when get is specified");
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
            if (!self._dataValue || self._dataValue.statusCode !== StatusCodes.Good|| !sameVariant(self._dataValue.value,value) ) {
                self.setValueFromSource(value,StatusCodes.Good);
            } else {
                //XXXY console.log("YYYYYYYYYYYYYYYYYYYYYYYYYY".red,self.browseName.toString());
            }
            return self._dataValue;
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
        return options.timestamped_set.call(self, dataValue, callback);
    };
}


var sameDataValue = require("lib/datamodel/datavalue").sameDataValue;

function bind_setter(self,options) {

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

function bind_getter(self,options) {


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

UAVariable.prototype._internal_set_dataValue = function (dataValue, indexRange) {

    var self = this;
    assert(dataValue,"expecting a dataValue");
    assert(dataValue instanceof DataValue,"expecting dataValue to be a DataValue");

    var old_dataValue = self._dataValue;

    self._dataValue = dataValue;
    self._dataValue.statusCode = self._dataValue.statusCode || StatusCodes.Good;

    // repair missing timestamps
    if (!dataValue.serverTimestamp) {
        self._dataValue.serverTimestamp = old_dataValue.serverTimestamp;
        self._dataValue.serverPicoseconds = old_dataValue.serverPicoseconds;
    }
    if (!dataValue.sourceTimestamp) {
        self._dataValue.sourceTimestamp = old_dataValue.sourceTimestamp;
        self._dataValue.sourcePicoseconds = old_dataValue.sourcePicoseconds;
    }

    // if (dataValue.value.arrayType ===VariantArrayType.Array) {
    //     console.log("xxxx UAVariable emit value_changed ??".bgRed, old_dataValue.value.toString(),dataValue.value.toString());
    // }
    if (!sameDataValue(old_dataValue, dataValue)) {
        //xx console.log("UAVariable emit value_changed");
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
 * @param [options.historyRead]     {Function}
 *
 *  properties:
 *    - value: a Variant or a status code
 *    - sourceTimestamp
 *    - sourcePicoseconds
 * @param [options.timestamped_set] {Function}
 * @param [options.refreshFunc] {Function} the variable asynchronous getter function.
 * @param [overwrite {Boolean} = false] set overwrite to true to overwrite existing binding
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
 *          // store the variant somewhere
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
 * * the second argument shall be a DataValue with the new UAVariable Value,  a StatusCode, and time stamps.
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
 * variable.bindVariable(nodeId,options):
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

UAVariable.prototype.setPermissions = function (permissions) {
    this._permissions = permissions;
};

UAVariable.prototype.bindVariable = function (options, overwrite) {

    var self = this;

    if (overwrite) {
        self._timestamped_set_func = null;
        self._timestamped_get_func = null;
        self._get_func = null;
        self._set_func = null;
        self.asyncRefresh = null;
        self.refreshFunc = null;
        self._historyRead = null;
    }
    options = options || {};

    assert(!_.isFunction(self._timestamped_set_func),"UAVariable already bounded");
    assert(!_.isFunction(self._timestamped_get_func),"UAVariable already bounded");
    bind_getter(self,options);
    bind_setter(self,options);
    if (options.historyRead) {
        assert(!_.isFunction(self._historyRead));
        assert(_.isFunction(options.historyRead));

        self._historyRead = options.historyRead;
        assert(self._historyRead.length === 6);
    }
    assert(_.isFunction(self._timestamped_set_func));
    assert(self._timestamped_set_func.length === 3);
};


/**
 * @method readValueAsync
 * @param context {SessionContext}
 * @param callback {Function}
 * @param callback.err   {null|Error}
 * @param callback.dataValue {DataValue|null} the value read
 * @async
 */
UAVariable.prototype.readValueAsync = function (context, callback) {

    var self = this;

    assert(context instanceof SessionContext);
    assert(callback instanceof Function);

    self.__waiting_callbacks = self.__waiting_callbacks || [];
    self.__waiting_callbacks.push(callback);

    var _readValueAsync_in_progress = self.__waiting_callbacks.length >= 2;
    if (_readValueAsync_in_progress) {
        return;
    }


    function readImmediate(callback) {
        assert(self._dataValue instanceof DataValue);
        var dataValue = this.readValue();
        callback(null, dataValue);
    }

    var func = null;
    if (!self.isReadable(context)) {
        func = function(callback) {
            var dataValue = new DataValue({statusCode: StatusCodes.BadNotReadable});
            callback(null, dataValue);
        }
    } else if (!self.isUserReadable(context)) {
        func = function (callback) {
            var dataValue = new DataValue({statusCode: StatusCodes.BadUserAccessDenied});
            callback(null, dataValue);
        }
    } else {
        func = _.isFunction(self.asyncRefresh) ? self.asyncRefresh : readImmediate;
    }

    function satisfy_callbacks(err, dataValue) {
        // now call all pending callbacks
        var callbacks = self.__waiting_callbacks;
        self.__waiting_callbacks = [];
        var i=0,n=callbacks.length,callback;
        for (;i<n;i++) {
            callback = callbacks[i];
            callback.call(self, err, dataValue);
        }
    }

    try {
        func.call(this, satisfy_callbacks);
    }
    catch (err) {
        // istanbul ignore next
        console.log("func readValueAsync has failed ".red);
        console.log(" stack",err.stack);
        satisfy_callbacks(err);
    }
};

UAVariable.prototype.getWriteMask = function () {
    return BaseNode.prototype.getWriteMask.call(this);
};

UAVariable.prototype.getUserWriteMask = function () {
    return BaseNode.prototype.getUserWriteMask.call(this);
};


UAVariable.prototype.clone = function (options, optionalfilter,extraInfo) {

    var self = this;
    options = options || {};
    options = _.extend(_.clone(options),{
        eventNotifier:           self.eventNotifier,
        symbolicName:            self.symbolicName,
        //xx value:                self.value,
        dataType:                self.dataType,
        valueRank:               self.valueRank,
        arrayDimensions:         self.arrayDimensions,
        accessLevel:             self.accessLevel,
        userAccessLevel:         self.userAccessLevel,
        minimumSamplingInterval: self.minimumSamplingInterval,
        historizing:             self.historizing
    });
    var newVariable = self._clone(UAVariable, options, optionalfilter, extraInfo);

    newVariable.bindVariable();
    assert(_.isFunction(newVariable._timestamped_set_func));

    assert(newVariable.dataType === self.dataType);
    newVariable._dataValue = self._dataValue.clone();
    return newVariable;

};


function _bindComponent(variable,addressSpace,prop, name,dataTypeId, valueRank) {

    assert(dataTypeId instanceof NodeId);
    // install a getter function to retrieve the underlying object

    var isArray = ( valueRank === 1);

    var dataType = addressSpace.findCorrespondingBasicDataType(dataTypeId);

    //DataType.ExtensionObject
    prop.bindVariable({

        timestamped_get: function () {

            var dv = variable.readValue();

            this._dataValue.statusCode = dv.statusCode;

            this._dataValue.serverTimestamp =   dv.serverTimestamp;
            this._dataValue.serverPicoseconds = dv.serverPicoseconds;

            this._dataValue.sourceTimestamp = dv.sourceTimestamp;
            this._dataValue.sourcePicoseconds = dv.sourcePicoseconds;

            if (isArray) {

                //console.log("xxxxxxxxxxxxxxxxxxxxxxx ".yellow,dv.value.value[name]);
                //console.log("xxxxxxxxxxxxxxxxxxxxxxx ".yellow,dataType.toString());
                assert( !dv.value.value[name] || _.isArray(dv.value.value[name]));
                this._dataValue.value = new Variant({
                    arrayType: VariantArrayType.Array,
                    value: dv.value.value[name] || [],
                    dataType: dataType

                });

            } else {
                this._dataValue.value = new Variant({
                    arrayType: VariantArrayType.Scalar,
                    value: dv.value.value[name],
                    dataType: dataType
                });

            }

            //xx this._dataValue.value.value = dv.value.value[name];
            //xx console.log( "there ",this._dataValue.toString());
            return this._dataValue;
        },

        set: function(variant) {
            assert(variant instanceof Variant);
            var dv = variable.readValue();
            assert(dv.value.value.hasOwnProperty(name));

            dv.value.value[name] = variant.value;
            return StatusCodes.Good;
        }

    }, true);

    prop.setValueFromSource = function(variant,statusCode, sourceTimestamp) {
        var dv = variable.readValue();
        if (!statusCode || statusCode === StatusCodes.Good) {
            assert(dv.value.value.hasOwnProperty(name));
            dv.value.value[name] = variant.value;
        }
    };

    // to do
    prop.bindExtensionObject();

}

var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;
function w(str,n) { return (str+"                                                              ").substr(0,n);}

UAVariable.prototype.bindExtensionObject = function() {

    var self = this;
    var addressSpace = self.addressSpace;

    var structure = addressSpace.findDataType("Structure");


    if (!structure) {
        // the addressSpace is limited and doesn't provide extension object
        // bindExtensionObject cannot be performed and shall finish here.
        return;
    }
    assert(structure && structure.browseName.toString() === "Structure"," expecting DataType Structure to be in AddressSpace");

    var components = self.getComponents();
    var dt = addressSpace.findNode(self.dataType);

    // istanbul ignore next
    if (!dt)  {
        throw new Error("cannot find dataType "+ self.dataType.toString());
    }

    if(dt.isSupertypeOf(structure)) {

        // ------------------------------------------------------
        // make sure we have a structure
        // ------------------------------------------------------
        var s = self.readValue();

        if (s.value && s.value.dataType === DataType.Null) {
            //xx console.log("xxxxx s=".bgRed, s.toString());
            // create a structure and bind it
            var theValue = new Variant({
                dataType: DataType.ExtensionObject,
                value: addressSpace.constructExtensionObject(self.dataType)
            });

            self.setValueFromSource(theValue,StatusCodes.Good);

        } else {
            // verify that variant has the correct type
            assert(s.value.dataType === DataType.ExtensionObject);
            assert(s.value.value.constructor.name === addressSpace.constructExtensionObject(self.dataType).constructor.name);
        }

        // ------------------------------------------------------
        // now bind each member
        // ------------------------------------------------------
        dt.definition.forEach(function(field) {

            var component = components.filter(function(f){
                return f.browseName.name.toString() === field.name;
            });
            var name = lowerFirstLetter(field.name.toString());

            if (component.length === 1) {

                if (doDebug) {
                    var x = addressSpace.findNode(field.dataType).browseName.toString();
                    var basicType = addressSpace.findCorrespondingBasicDataType(field.dataType);
                    console.log("xxx".cyan," dataType",
                            w(field.dataType.toString(),8),
                            w(field.name,35),
                           "valueRank", w(field.valueRank,3).cyan,
                           w(x,25).green,
                           "basicType = ",w(basicType.toString(),20).yellow,field.dataType.toString() );
                }

                _bindComponent(self,addressSpace,component[0], name, field.dataType,field.valueRank );
            } else {

                assert(component.length===0);
                // create a variable
                // Note we may use ns=1;s=parentName/0:PropertyName

                var newProp = addressSpace.addVariable({
                    browseName: field.name.toString(),
                    dataType: field.dataType,
                    componentOf: self
                });
                _bindComponent(self,addressSpace,newProp, name, field.dataType,field.valueRank );

            }
        });
    }
};


UAVariable.prototype.__defineGetter__("dataTypeObj",function() {
    var self = this;
    var addressSpace = self.addressSpace;
    var d = addressSpace.findNode(self.dataType);
    return d;
});


UAVariable.prototype.handle_semantic_changed = function () {

    var variable = this;
    variable.semantic_version = variable.semantic_version +1;
    variable.emit("semantic_changed");

};


exports.UAVariable = UAVariable;
