/**
 * @module opcua.datamodel
 */
import assert from "better-assert";
import { LocalizedText } from "_generated_/_auto_generated_LocalizedText";

function coerceLocalizedText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return new LocalizedText({ locale: null, text: value });
  }
  if (value instanceof LocalizedText) {
    return value;
  }
  assert(value.hasOwnProperty("locale"));
  assert(value.hasOwnProperty("text"));
  return new LocalizedText(value);
}
LocalizedText.coerce = coerceLocalizedText;
export { 
  coerceLocalizedText,
  LocalizedText };

