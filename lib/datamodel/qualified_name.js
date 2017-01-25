/**
 * @module opcua.datamodel
 */
import { registerBasicType } from "lib/misc/factories";
import assert from "better-assert";
import _ from "underscore";
import { QualifiedName } from "_generated_/_auto_generated_QualifiedName";
export { QualifiedName };

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
export { stringToQualifiedName };

function coerceQualifyName(value) {
  if (!value) {
    return null;
  } else if (value instanceof QualifiedName) {
    return value;
  } else if (_.isString(value)) {
    return stringToQualifiedName(value);
  } 
  assert(value.hasOwnProperty("namespaceIndex"));
  assert(value.hasOwnProperty("name"));
  return new exports.QualifiedName(value);
}
export { coerceQualifyName };

