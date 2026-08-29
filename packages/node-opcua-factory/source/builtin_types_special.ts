/**
 * @module node-opcua-factory
 */

import { assert } from "node-opcua-assert";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";

import { registerType } from "./builtin_types.js";
import type { ConstructorFunc } from "./types.js";

// biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
function _self_encode(constructor: ConstructorFunc) {
    assert(typeof constructor === "function");
    return (valueIn: unknown, stream: OutputBinaryStream) => {
        const value = (
            (valueIn as { encode?: unknown })?.encode ? valueIn : new constructor(valueIn as Record<string, unknown>)
        ) as {
            encode(stream: OutputBinaryStream): void;
        };
        value.encode(stream);
    };
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
function _self_decode(constructor: ConstructorFunc) {
    assert(typeof constructor === "function");
    return (stream: BinaryStream) => {
        const value = new constructor();
        value.decode(stream);
        return value;
    };
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
function _self_coerce(constructor: ConstructorFunc) {
    assert(typeof constructor === "function");
    return (value: unknown) => {
        const obj = new constructor(value as Record<string, unknown>);
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
