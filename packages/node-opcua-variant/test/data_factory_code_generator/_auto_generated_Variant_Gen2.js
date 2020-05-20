
// --------- This code has been automatically generated !!! Wed Apr 29 2015 20:52:17 GMT+0200 (Paris, Madrid (heure d�t�))
/**
 * @module node-opcua-address-space.types
 */
const assert = require("node-opcua-assert").assert;
const util = require("util");
const _ = require("underscore");
const resolve_schema_field_types = require("node-opcua-factory").resolve_schema_field_types;
const initialize_field = require("node-opcua-factory").initialize_field;
const check_options_correctness_against_schema = require("node-opcua-factory").check_options_correctness_against_schema;

const makeExpandedNodeId = require("node-opcua-nodeid").makeExpandedNodeId;
const generate_new_id = require("node-opcua-factory").generate_new_id;
const _enumerations = require("node-opcua-factory/src/factories_enumerations")._private._enumerations;
const schema = require("../../schemas/Variant_schema").Variant_Schema;
const BaseUAObject = require("node-opcua-factory").BaseUAObject;

//## Define special behavior for Enumeration
const _enum_properties = {
    "dataType": {
        hidden: false,
        enumerable: true,
        configurable: true,
        get: function() {
            return this.__dataType;
        },
        set: function(value) {
            const coercedValue = _enumerations.DataType.typedEnum.get(value);
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
        get: function() {
            return this.__arrayType;
        },
        set: function(value) {
            const coercedValue = _enumerations.VariantArrayType.typedEnum.get(value);
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
    const self = this;
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

const encode_DataType = _enumerations.DataType.encode;
const decode_DataType = _enumerations.DataType.decode;
const encode_VariantArrayType = _enumerations.VariantArrayType.encode;
const decode_VariantArrayType = _enumerations.VariantArrayType.decode;
const encode_Any = _defaultTypeMap.Any.encode;
const decode_Any = _defaultTypeMap.Any.decode;
Variant.prototype.encode = function(stream, options) {
    schema.encode(this, stream, options);
};
/**
 * decode the object from a binary stream
 * @method decode
 *
 * @param stream {BinaryStream}
 * @param [option] {object}
 */
Variant.prototype.decode = function(stream, options) {
    schema.decode(this, stream, options);
};
Variant.prototype.decodeDebug = function(stream, options) {
    schema.decodeDebug(this, stream, options);
};
/**
 *
 * verify that all object attributes values are valid according to schema
 * @method isValid
 * @return {Boolean}
 */
Variant.prototype.isValid = function() {
    return schema.isValid(this);
};
Variant.possibleFields = function() {
    return [
        "dataType",
        "arrayType",
        "value"
    ];
}();


exports.Variant = Variant;
