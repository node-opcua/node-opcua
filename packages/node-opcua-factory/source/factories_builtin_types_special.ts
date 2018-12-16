/**
 * @module node-opcua-factory
 */
import assert from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import * as  _ from "underscore";

import { registerType } from "./factories_builtin_types";
import { ConstructorFunc } from "./factories_factories";

function _self_encode(constructor: any) {
    assert(_.isFunction(constructor));
    return (value: any, stream: BinaryStream) => {
        if (!value || !value.encode) {
            value = new constructor(value);
        }
        value.encode(stream);
    };
}

function _self_decode(constructor: any) {
    assert(_.isFunction(constructor));
    return (stream: BinaryStream) => {
        const value = new constructor();
        value.decode(stream);
        return value;
    };
}

function _self_coerce(constructor: any) {
    assert(_.isFunction(constructor));
    return (value: any) => {
        const obj = new constructor(value);
        return obj;
    };
}

export function registerSpecialVariantEncoder(constructor: ConstructorFunc) {

    assert(_.isFunction(constructor));

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
