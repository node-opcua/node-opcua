
// --------- This code has been automatically generated !!! Wed Apr 29 2015 20:52:17 GMT+0200 (Paris, Madrid (heure d�t�))
/**
 * @module opcua.address_space.types
 */
var assert = require("node-opcua-assert");
var util = require("util");
var _ = require("underscore");
var schema_helpers = require("node-opcua-factory/src/factories_schema_helpers");
var resolve_schema_field_types = schema_helpers.resolve_schema_field_types;
var initialize_field = schema_helpers.initialize_field;
var check_options_correctness_against_schema = schema_helpers.check_options_correctness_against_schema;
var _defaultTypeMap = require("node-opcua-factory/src/factories_builtin_types")._defaultTypeMap;
var ec = require("node-opcua-basic-types");
var makeExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;
var generate_new_id = require("node-opcua-factory").generate_new_id;
var _enumerations = require("node-opcua-factory/src/factories_enumerations")._private._enumerations;
var schema = require("../../schemas/Variant_schema").Variant_Schema;
var BaseUAObject = require("node-opcua-factory/src/factories_baseobject").BaseUAObject;

//## Define special behavior for Enumeration
var _enum_properties = {
    "dataType": {
        hidden: false,
        enumerable: true,
        configurable: true,
        get: function () {
            return this.__dataType;
        },
        set: function (value) {
            var coercedValue = _enumerations.DataType.typedEnum.get(value);
            if (coercedValue === undefined || coercedValue === null) {
                throw new Error("value cannot be coerced to DataType: " + value);
            }
            this.__dataType = coercedValue;
        }
    },
    "__dataType": {
        hidden: true,
        writable: true,
        enumerable: false
    },
    "arrayType": {
        hidden: false,
        enumerable: true,
        configurable: true,
        get: function () {
            return this.__arrayType;
        },
        set: function (value) {
            var coercedValue = _enumerations.VariantArrayType.typedEnum.get(value);
            if (coercedValue === undefined || coercedValue === null) {
                throw new Error("value cannot be coerced to VariantArrayType: " + value);
            }
            this.__arrayType = coercedValue;
        }
    },
    "__arrayType": {
        hidden: true,
        writable: true,
        enumerable: false
    },
};


/**
 *
 * @class Variant
 * @constructor
 * @extends BaseUAObject
 * @param  options {Object}
 * @param  [ options.dataType = 0] {DataType} the variant type.
 * @param  [ options.arrayType = 0] {VariantArrayType}
 * @param  [ options.value = null] {Any}
 */
function Variant(options) {
    options = options || {};
    check_options_correctness_against_schema(this, schema, options);
    var self = this;
    assert(this instanceof BaseUAObject); //  ' keyword "new" is required for constructor call')
    resolve_schema_field_types(schema);

    //construction hook
    options = schema.construct_hook(options);
    BaseUAObject.call(this, options);

    //define enumeration properties
    Object.defineProperties(this, _enum_properties);

    /**
     * the variant type.
     * @property dataType
     * @type {DataType}
     * @default  0
     */
    self.dataType = initialize_field(schema.fields[0], options.dataType);

    /**
     *
     * @property arrayType
     * @type {VariantArrayType}
     * @default  0
     */
    self.arrayType = initialize_field(schema.fields[1], options.arrayType);

    /**
     *
     * @property value
     * @type {Any}
     * @default  null
     */
    self.value = initialize_field(schema.fields[2], options.value);

    // Object.preventExtensions(self);
}
util.inherits(Variant, BaseUAObject);
schema.id = generate_new_id();
Variant.prototype.encodingDefaultBinary = makeExpandedNodeId(schema.id);
Variant.prototype._schema = schema;

var encode_DataType = _enumerations.DataType.encode;
var decode_DataType = _enumerations.DataType.decode;
var encode_VariantArrayType = _enumerations.VariantArrayType.encode;
var decode_VariantArrayType = _enumerations.VariantArrayType.decode;
var encode_Any = _defaultTypeMap.Any.encode;
var decode_Any = _defaultTypeMap.Any.decode;
Variant.prototype.encode = function (stream, options) {
    schema.encode(this, stream, options);
};
/**
 * decode the object from a binary stream
 * @method decode
 *
 * @param stream {BinaryStream}
 * @param [option] {object}
 */
Variant.prototype.decode = function (stream, options) {
    schema.decode(this, stream, options);
};
Variant.prototype.decode_debug = function (stream, options) {
    schema.decode_debug(this, stream, options);
};
/**
 *
 * verify that all object attributes values are valid according to schema
 * @method isValid
 * @return {Boolean}
 */
Variant.prototype.isValid = function () {
    return schema.isValid(this);
};
Variant.possibleFields = function () {
    return [
        "dataType",
        "arrayType",
        "value"
    ];
}();


exports.Variant = Variant;
