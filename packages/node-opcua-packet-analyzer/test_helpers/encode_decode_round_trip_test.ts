// tslint:disable:no-console
// @ts-check
import chalk from "chalk";
import { BinaryStream } from "node-opcua-binary-stream";
import { hexDump } from "node-opcua-debug";
import { type ConstructorFunc, getStandardDataTypeFactory, type IBaseUAObject } from "node-opcua-factory";
import type { ExpandedNodeId } from "node-opcua-nodeid";
import { assert_arrays_are_equal } from "node-opcua-test-helpers";
import should from "should";

import { analyze_object_binary_encoding, analyzePacket, type ObjectMessage } from "../source";

export interface IExtensionObject extends IBaseUAObject {
    encodingDefaultBinary?: ExpandedNodeId;
}

type TypedArrayLike = { buffer: ArrayBuffer } | null | undefined;

function isTypedArray(v?: TypedArrayLike): v is { buffer: ArrayBuffer } {
    if (v?.buffer && v.buffer instanceof ArrayBuffer) {
        return true;
    }
    return false;
}

function isArrayOrTypedArray(v: unknown): v is Array<unknown> | { buffer: ArrayBuffer } {
    return isTypedArray(v as TypedArrayLike) || Array.isArray(v);
}

type BufferInspectionCallback = (buffer: Buffer, encoding: ExpandedNodeId | undefined, options: Record<string, unknown>) => void;

function dump_block_in_debug_mode(buffer: Buffer, id: ExpandedNodeId | undefined, options: Record<string, unknown>): void {
    if (process.env.DEBUG) {
        console.log(hexDump(buffer));
        analyzePacket(buffer, id as unknown as ObjectMessage, 0, 0, options);
    }
}

function compare(objReloaded: Record<string, unknown>, obj: Record<string, unknown>): void {
    function displayError(p: string, expected: unknown, actual: unknown): void {
        console.log(chalk.yellow(" ---------------------------------- error" + " in encode_decode_round_trip_test"));
        console.log(chalk.red(" key "), p);
        console.log(chalk.red(" expected "), JSON.stringify(expected));
        console.log(chalk.cyan(" actual   "), JSON.stringify(actual));
    }

    Object.keys(objReloaded).forEach((p: string) => {
        try {
            if (isArrayOrTypedArray(obj[p])) {
                assert_arrays_are_equal(objReloaded[p] as ArrayLike<unknown>, obj[p] as ArrayLike<unknown>);
            } else {
                if (objReloaded[p] === undefined || obj[p] === undefined) {
                    return;
                }
                JSON.stringify(objReloaded[p]).should.eql(JSON.stringify(obj[p]));
            }
        } catch (err) {
            displayError(p, obj[p], objReloaded[p]);
            console.log(String(obj));
            console.log(String(objReloaded));
            // re throw exception
            throw err;
        }
    });
}

function redirectToNull(functor: () => void): void {
    const old = console.log;

    if (!process.env.DEBUG) {
        // tslint:disable:no-empty
        console.log = (..._args: unknown[]) => {
            /** */
        };
    }

    try {
        functor();
    } finally {
        console.log = old;
    }
}

/**
 * @param obj - object to test (the object must provide
 *   binaryStoreSize, encode, decode methods)
 * @param options - optional options or callback
 * @param callback_buffer - optional callback to inspect
 *   the encoded buffer
 * @returns the reloaded object after decode
 */
export function encode_decode_round_trip_test(
    obj: IExtensionObject,
    options?: Record<string, unknown> | BufferInspectionCallback,
    callback_buffer?: BufferInspectionCallback
): IBaseUAObject {
    if (!callback_buffer && typeof options === "function") {
        callback_buffer = options as BufferInspectionCallback;
        options = {};
    }

    callback_buffer = callback_buffer || dump_block_in_debug_mode;

    should.exist(obj);

    const size = obj.binaryStoreSize();

    const stream = new BinaryStream(Buffer.alloc(size));

    obj.encode(stream);

    callback_buffer(stream.buffer, obj.encodingDefaultBinary, (options ?? {}) as Record<string, unknown>);

    stream.rewind();

    // reconstruct an object (some objects may not have a
    // default Binary encoding and should be recreated)
    const expandedNodeId = obj.encodingDefaultBinary;
    const objReloaded = expandedNodeId
        ? getStandardDataTypeFactory().constructObject(expandedNodeId)
        : new (obj.constructor as ConstructorFunc)();

    objReloaded.decode(stream);

    redirectToNull(() => analyze_object_binary_encoding(obj));
    compare(objReloaded as unknown as Record<string, unknown>, obj as unknown as Record<string, unknown>);
    return objReloaded;
}

export function json_encode_decode_round_trip_test(
    obj: Record<string, unknown>,
    options?: Record<string, unknown> | BufferInspectionCallback,
    callbackBuffer?: BufferInspectionCallback
): Record<string, unknown> {
    if (!callbackBuffer && typeof options === "function") {
        callbackBuffer = options as BufferInspectionCallback;
        options = {};
    }
    callbackBuffer = callbackBuffer || dump_block_in_debug_mode;

    should.exist(obj);

    const json = JSON.stringify(obj);

    const objReloaded = JSON.parse(json) as Record<string, unknown>;

    compare(objReloaded, obj);

    return objReloaded;
}
