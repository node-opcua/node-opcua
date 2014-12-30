"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");

var Enum = require("enum");

var _enumerations = {};

var TypeSchema = require("lib/misc/factories_builtin_types").TypeSchema;



function _encode_enumeration(member,stream) {
    stream.writeInteger(member.value);
}


/**
 * @method registerEnumeration
 * @param schema
 * @param schema.name { string}
 * @param schema.enumValues {key:Name, value:value}
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

    schema.encode = _encode_enumeration;

    schema.decode = function _decode_enumeration(stream) {
        return typedEnum.get(stream.readInteger());
    };
    schema.defaultValue = typedEnum.enums[0];
    _enumerations[name] = new TypeSchema(schema);

    return typedEnum;
}


exports.registerEnumeration = registerEnumeration;
exports._private = { _enumerations: _enumerations };
