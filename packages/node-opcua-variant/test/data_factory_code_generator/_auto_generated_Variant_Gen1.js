// --------- This code has been automatically generated !!! Sat Mar 21 2015 21:52:41 GMT+0100 (Paris, Madrid)
/**
 * @module node-opcua-address-space.types
 */
const util = require("util");
const { assert } = require("node-opcua-assert");
const schema_helpers = require("node-opcua-factory/src/factories_schema_helpers");
const { check_options_correctness_against_schema, resolve_schema_field_types, initialize_field } = schema_helpers;
const { _defaultTypeMap } = require("node-opcua-factory/src/factories_builtin_types");
const { makeExpandedNodeId } = require("node-opcua-nodeid");
const _enumerations = require("node-opcua-factory/src/factories_enumerations")._private._enumerations;
const { BaseUAObject, generate_new_id } = require("node-opcua-factory");
const schema = require("../../schemas/Variant_schema").Variant_Schema;

/**
 * @class Variant
 * @constructor
 * @extends BaseUAObject
 */
function Variant(options) {
    options = options || {};
    check_options_correctness_against_schema(this, schema, options);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    assert(this instanceof BaseUAObject); //  ' keyword "new" is required for constructor call')
    resolve_schema_field_types(schema);

    //construction hook
    options = schema.construct_hook(options);
    BaseUAObject.call(this, options);

    /**
     * the variant type.
     * @property dataType
     * @type {DataType}
     * @default  0
     */
    //## Define special behavior for Enumeration
    Object.defineProperties(this, {
        dataType: {
            hidden: false,
            enumerable: true,
            configurable: true,
            get: function () {
                return this.__dataType;
            },
            set: function (value) {
                const coercedValue = _enumerations.DataType.typedEnum.get(value);
                if (coercedValue === undefined || coercedValue === null) {
                    throw new Error("value cannot be coerced to DataType: " + value);
                }
                this.__dataType = coercedValue;
            }
        },
        __dataType: {
            hidden: true,
            writable: true,
            enumerable: false
        }
    });
    self.dataType = initialize_field(schema.fields[0], options.dataType);

    /**
     * @property arrayType
     * @type {VariantArrayType}
     * @default  0
     */
    //## Define special behavior for Enumeration
    Object.defineProperties(this, {
        arrayType: {
            hidden: false,
            enumerable: true,
            configurable: true,
            get: function () {
                return this.__arrayType;
            },
            set: function (value) {
                const coercedValue = _enumerations.VariantArrayType.typedEnum.get(value);
                if (coercedValue === undefined || coercedValue === null) {
                    throw new Error("value cannot be coerced to VariantArrayType: " + value);
                }
                this.__arrayType = coercedValue;
            }
        },
        __arrayType: {
            hidden: true,
            writable: true,
            enumerable: false
        }
    });
    self.arrayType = initialize_field(schema.fields[1], options.arrayType);

    /**
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
Variant.prototype.decodeDebug = function (stream, options) {
    schema.decodeDebug(this, stream, options);
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
Variant.possibleFields = (function () {
    return ["dataType", "arrayType", "value"];
})();

exports.Variant = Variant;
