/**
 * @module opcua.datamodel
 */
require("requirish")._(module);

import { registerBasicType, registerBuiltInType } from "lib/misc/factories";
import { QualifiedName } from "lib/datamodel/qualified_name";
import { LocalizedText } from "lib/datamodel/localized_text";
import { DiagnosticInfo } from "lib/datamodel/diagnostic_info";
import ec from "lib/misc/encode_decode";
import assert from "better-assert";
import _ from "underscore";
import { DataType } from "schemas/DataType_enum";
import { VariantArrayType } from "schemas/VariantArrayType_enum";
import { Variant }  from "_generated_/_auto_generated_Variant";
import { isValidVariant } from "schemas/Variant_schema";


function _self_encode(Type) {
  assert(_.isFunction(Type));
  return (value, stream) => {
    if (!value || !value.encode) {
      value = new Type(value);
    }
    value.encode(stream);
  };
}
function _self_decode(Type) {
  assert(_.isFunction(Type));

  return (stream) => {
    const value = new Type();
    value.decode(stream);
    return value;
  };
}


function _coerceVariant(variantLike) {
  const value =  (variantLike instanceof Variant) ? variantLike : new Variant(variantLike);
  assert(value instanceof Variant);
  return value;
}
Variant.coerce = _coerceVariant;


function registerSpecialVariantEncoder(ConstructorFunc) {
  assert(_.isFunction(ConstructorFunc));

  const name = ConstructorFunc.prototype._schema.name;

  registerBuiltInType({
    name,
    encode: _self_encode(ConstructorFunc),
    decode: _self_decode(ConstructorFunc),
    defaultValue: null
  });
}

registerSpecialVariantEncoder(QualifiedName);
registerSpecialVariantEncoder(LocalizedText);
registerSpecialVariantEncoder(Variant);
registerSpecialVariantEncoder(DiagnosticInfo);

export { 
  registerSpecialVariantEncoder,
  DataType, 
  VariantArrayType, 
  Variant, 
  isValidVariant };
