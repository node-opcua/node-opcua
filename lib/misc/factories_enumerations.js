"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");

var Enum = require("lib/misc/enum");

var _enumerations = {};

var TypeSchema = require("lib/misc/factories_builtin_types").TypeSchema;


function _encode_enumeration(member, stream) {
    stream.writeInteger(member.value);
}


/**
 * @method registerEnumeration
 * @param schema
 * @param schema.name { string}
 * @param schema.enumValues {key:Name, value:valuess}
 * @param schema.encode
 * @param schema.decode
 * @param schema.typedEnum
 * @param schema.defaultValue 
 * @return {Enum}
 */
function registerEnumeration(schema) {

    assert(schema.hasOwnProperty("name"));
    assert(schema.hasOwnProperty("enumValues"));

    var name = schema.name;
    // create a new Enum
    var typedEnum = new Enum(schema.enumValues);
    if (_enumerations.hasOwnProperty(name)) {
        throw new Error("factories.registerEnumeration : Enumeration " + schema.name + " has been already inserted");
    }
    schema.typedEnum = typedEnum;

    assert(!schema.encode || _.isFunction(schema.encode));
    assert(!schema.decode || _.isFunction(schema.decode));
    schema.encode = schema.encode || _encode_enumeration;
    schema.decode = schema.decode || function _decode_enumeration(stream) {
           var value = stream.readInteger();
            var e = typedEnum.get(value);
            // istanbul ignore next
            if( !e) {
                throw new Error("cannot  coerce value=" + value + " to "+ typedEnum.constructor.name);
            }
            return  e;
        };
    assert(_.isFunction(schema.encode));
    assert(_.isFunction(schema.decode));

    schema.defaultValue = typedEnum.enums[0];

    var typeSchema = new TypeSchema(schema);
    _enumerations[name] = typeSchema;

    //typeSchema.coerce = function(value) {
    //    var  coercedValue = typedEnum.get(value);
    //    if ( coercedValue === undefined || coercedValue === null) {
    //        throw new Error("value cannot be coerced to DataType: " + value);
    //    }
    //    console.log(" coercedValue = ",value,coercedValue);
    //    return coercedValue;
    //};

    //typeSchema.validate = function(value) {
    //    return !!value.key && !!value.value
    //};

    return typedEnum;
}
exports.registerEnumeration = registerEnumeration;

exports.hasEnumeration = function(enumerationName) {
    return !!_enumerations[enumerationName];
};

exports.getEnumeration = function(enumerationName) {
    assert(exports.hasEnumeration(enumerationName));
    return _enumerations[enumerationName];
};

exports._private = {_enumerations: _enumerations};
