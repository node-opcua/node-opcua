"use strict";
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);
var factories = require("lib/misc/factories");
var assert = require("better-assert");
var _ = require("underscore");
var QualifiedName = require("_generated_/_auto_generated_QualifiedName").QualifiedName;
exports.QualifiedName = QualifiedName;

exports.QualifiedName.prototype.toString = function () {
    if (this.namespaceIndex) {
        return this.namespaceIndex + ":" + this.name;
    }
    return this.name;
};

exports.QualifiedName.prototype.isEmpty = function () {
    return !this.name || this.name.length === 0;
};

/**
 * @method stringToQualifiedName
 * @param value {String}
 * @return {{namespaceIndex: Number, name: String}}
 *
 * @example
 *
 *  stringToQualifiedName("Hello")   => {namespaceIndex: 0, name: "Hello"}
 *  stringToQualifiedName("3:Hello") => {namespaceIndex: 3, name: "Hello"}
 */
function stringToQualifiedName(value) {

    var split_array = value.split(":");
    var namespaceIndex = 0;
    if (split_array.length === 2) {
        namespaceIndex = parseInt(split_array[0]);
        value = split_array[1];
    }
    return new QualifiedName({namespaceIndex: namespaceIndex, name: value});
}
exports.stringToQualifiedName = stringToQualifiedName;

function coerceQualifyName(value) {

    if (!value) {
        return null;
    } else if (value instanceof QualifiedName) {
        return value;
    } else if (_.isString(value)) {
        return stringToQualifiedName(value);
    } else {
        assert(value.hasOwnProperty("namespaceIndex"));
        assert(value.hasOwnProperty("name"));
        return new exports.QualifiedName(value);
    }
}
exports.coerceQualifyName = coerceQualifyName;

