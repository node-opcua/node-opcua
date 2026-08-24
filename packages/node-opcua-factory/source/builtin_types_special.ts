/**
 * @module node-opcua-factory
 */

import { assert } from "node-opcua-assert";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";

import { registerType } from "./builtin_types";
import type { ConstructorFunc } from "./types";

// biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
function _self_encode(constructor: any) {
    assert(typeof constructor === "function");
    return (value: any, stream: OutputBinaryStream) => {
        if (!value || !value.encode) {
            value = new constructor(value);
        }
        value.encode(stream);
    };
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
function _self_decode(constructor: any) {
    assert(typeof constructor === "function");
    return (stream: BinaryStream) => {
        const value = new constructor();
        value.decode(stream);
        return value;
    };
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
function _self_coerce(constructor: any) {
    assert(typeof constructor === "function");
    return (value: any) => {
        const obj = new constructor(value);
        return obj;
    };
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
export function registerSpecialVariantEncoder(constructor: ConstructorFunc): void {
    assert(typeof constructor === "function");

    const name = constructor.prototype.schema.name;

    registerType({
        name,
        subType: name,

        encode: _self_encode(constructor),

        decode: _self_decode(constructor),

        coerce: _self_coerce(constructor),

        defaultValue: () => new constructor()
    });
}
