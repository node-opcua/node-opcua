"use strict";

var assert = require("node-opcua-assert");
var _ = require("underscore");

var registerBuiltInType = require("./factories_builtin_types").registerType;


function _self_encode(Type) {
    assert(_.isFunction(Type));
    return function (value, stream) {
        if (!value || !value.encode) {
            value = new Type(value);
        }
        value.encode(stream);
    };
}
function _self_decode(Type) {
    assert(_.isFunction(Type));

    return function (stream) {
        var value = new Type();
        value.decode(stream);
        return value;
    };
}

exports.registerSpecialVariantEncoder = function (ConstructorFunc) {

    assert(_.isFunction(ConstructorFunc));

    var name = ConstructorFunc.prototype._schema.name;

    registerBuiltInType({
        name: name,
        encode: _self_encode(ConstructorFunc),
        decode: _self_decode(ConstructorFunc),
        defaultValue: null
    });

};

