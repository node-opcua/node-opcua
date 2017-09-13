"use strict";
/**
 * @module opcua.miscellaneous
 */


var assert = require("node-opcua-assert");
var _ = require("underscore");

var Enum = require("node-opcua-enum");

var _enumerations = {};

var TypeSchema = require("../src/factories_builtin_types").TypeSchema;

function _encode_enumeration(member, stream) {
    stream.writeInteger(member.value);
}

/**
 * @method registerEnumeration
 * @param schema
 * @param schema.name { string}
 * @param schema.enumValues [{key:Name, value:values}]
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
