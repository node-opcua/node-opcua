/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { Int64 } from "node-opcua-basic-types";
import { coerceLocalizedText } from "node-opcua-data-model";
import { EnumValueType } from "node-opcua-types";

export function coerceEnumValues(enumValues: any): EnumValueType[] {
    if (Array.isArray(enumValues)) {
        //
        return enumValues.map((en: any) => {
            assert(en.hasOwnProperty("value"));
            assert(en.hasOwnProperty("displayName"));
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
