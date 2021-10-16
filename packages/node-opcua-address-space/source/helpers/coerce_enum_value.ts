/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { Int64 } from "node-opcua-basic-types";
import { coerceLocalizedText } from "node-opcua-data-model";
import { EnumValueType } from "node-opcua-types";
import { EnumValueTypeOptionsLike } from "../address_space_ts";

export function coerceEnumValues(enumValues: EnumValueTypeOptionsLike[] | { [key: string]: number | Int64 }): EnumValueType[] {
    if (Array.isArray(enumValues)) {
        //
        return enumValues.map((en: any) => {
            assert(Object.prototype.hasOwnProperty.call(en, "value"));
            assert(Object.prototype.hasOwnProperty.call(en, "displayName"));
            return new EnumValueType({
                displayName: coerceLocalizedText(en.displayName),
                value: en.value
            });
        });
    } else {
        return coerceEnumValues(
            Object.entries(enumValues as { [key: string]: Int64 }).map((entrie: [string, Int64]) => {
                const [key, value] = entrie;
                return new EnumValueType({
                    description: coerceLocalizedText(key),
                    displayName: coerceLocalizedText(key),
                    value
                });
            })
        );
    }
}
