/**
 * @module opcua.miscellaneous
 */

import assert from "better-assert";
import _ from "underscore";
import Enum from "lib/misc/enum";
import { TypeSchema } from "lib/misc/factories_builtin_types";

const _enumerations = {};

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

  const name = schema.name;
    // create a new Enum
  const typedEnum = new Enum(schema.enumValues);
  if (_enumerations.hasOwnProperty(name)) {
    throw new Error(`factories.registerEnumeration : Enumeration ${schema.name} has been already inserted`);
  }
  schema.typedEnum = typedEnum;

  assert(!schema.encode || _.isFunction(schema.encode));
  assert(!schema.decode || _.isFunction(schema.decode));
  schema.encode = schema.encode || _encode_enumeration;
  schema.decode = schema.decode || function _decode_enumeration(stream) {
    const value = stream.readInteger();
    const e = typedEnum.get(value);
            // istanbul ignore next
    if (!e) {
      throw new Error(`cannot  coerce value=${value} to ${typedEnum.constructor.name}`);
    }
    return  e;
  };
  assert(_.isFunction(schema.encode));
  assert(_.isFunction(schema.decode));

  schema.defaultValue = typedEnum.enums[0];

  const typeSchema = new TypeSchema(schema);
  _enumerations[name] = typeSchema;

    // typeSchema.coerce = function(value) {
    //    var  coercedValue = typedEnum.get(value);
    //    if ( coercedValue === undefined || coercedValue === null) {
    //        throw new Error("value cannot be coerced to DataType: " + value);
    //    }
    //    console.log(" coercedValue = ",value,coercedValue);
    //    return coercedValue;
    // };

    // typeSchema.validate = function(value) {
    //    return !!value.key && !!value.value
    // };

  return typedEnum;
}

function hasEnumeration(enumerationName) {
  return !!_enumerations[enumerationName];
}

function getEnumeration(enumerationName) {
  assert(hasEnumeration(enumerationName));
  return _enumerations[enumerationName];
}

const _private = { _enumerations };

export {
  _private,
  registerEnumeration,
  hasEnumeration,
  getEnumeration
};
