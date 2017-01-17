/**
 * @module opcua.datamodel
 */
require("requirish")._(module);
const factories = require("lib/misc/factories");
const assert = require("better-assert");
const _ = require("underscore");
const QualifiedName = require("_generated_/_auto_generated_QualifiedName").QualifiedName;
exports.QualifiedName = QualifiedName;

exports.QualifiedName.prototype.toString = function () {
  if (this.namespaceIndex) {
    return `${this.namespaceIndex}:${this.name}`;
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
  const split_array = value.split(":");
  let namespaceIndex = 0;
  if (split_array.length === 2) {
    namespaceIndex = parseInt(split_array[0]);
    value = split_array[1];
  }
  return new QualifiedName({ namespaceIndex, name: value });
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

