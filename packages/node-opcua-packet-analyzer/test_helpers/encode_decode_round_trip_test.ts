// tslint:disable:no-console
// @ts-check
import * as chalk from "chalk";
import { BinaryStream } from "node-opcua-binary-stream";
import { hexDump } from "node-opcua-debug";
import { ExpandedNodeId } from "node-opcua-nodeid";
import { BaseUAObject, constructObject, ConstructorFuncWithSchema } from "node-opcua-factory";
import { assert_arrays_are_equal } from "node-opcua-test-helpers";
import * as should from "should";

import { analyze_object_binary_encoding, analyzePacket } from "../source";

export interface IExtensionObject extends BaseUAObject {
    binaryStoreSize(): number;
    encode(stream: BinaryStream): void;
    decode(stream: BinaryStream): void;
    encodingDefaultBinary?: ExpandedNodeId;
    constructor: any;
}
function dump_block_in_debug_mode(buffer: Buffer, id: any, options: any) {
    if (process.env.DEBUG) {
        console.log(hexDump(buffer));
        analyzePacket(buffer, id, 0, 0, options);
    }
}

function isTypedArray(v: any): boolean {
    if (v && v.buffer && v.buffer instanceof ArrayBuffer) {
        return true;
    }
    return false;
}

function isArrayOrTypedArray(v: any): boolean {
    return isTypedArray(v) || v instanceof Array;
}

function compare(objReloaded: any, obj: any) {
    function displayError(p: string, expected: any, actual: any) {
        console.log(chalk.yellow(" ---------------------------------- error in encode_decode_round_trip_test"));
        console.log(chalk.red(" key "), p);
        console.log(chalk.red(" expected "), JSON.stringify(expected));
        console.log(chalk.cyan(" actual   "), JSON.stringify(actual));
    }

    Object.keys(objReloaded).forEach((p: any) => {
        try {
            if (isArrayOrTypedArray(obj[p])) {
                assert_arrays_are_equal(objReloaded[p], obj[p]);
            } else {
                if (objReloaded[p] === undefined || obj[p] === undefined) {
                    return;
                }
                (JSON.stringify(objReloaded[p]) as any).should.eql(JSON.stringify(obj[p]));
            }
        } catch (err) {
            displayError(p, obj[p], objReloaded[p]);
            console.log(obj.toString());
            console.log(objReloaded.toString());
            // re throw exception
            throw err;
        }
    });
}

function redirectToNull(functor: () => void) {
    const old = console.log;

    if (!process.env.DEBUG) {
        // tslint:disable:no-empty
        console.log = (...args: any[]) => {
            /** */
        };
    }

    try {
        functor();
    } finally {
        console.log = old;
    }
}

type encode_decode_round_trip_testCallback = (buffer: Buffer, encoding: any, options: any) => void;

/**
 * @method encode_decode_round_trip_test
 * @param obj  : object to test ( the object must provide a binaryStoreSize,encode,decode method
 * @param [options]
 * @param callback_buffer
 * @return {*}
 */
export function encode_decode_round_trip_test(
    obj: IExtensionObject,
    options?: unknown | encode_decode_round_trip_testCallback,
    callback_buffer?: encode_decode_round_trip_testCallback
): any {
    if (!callback_buffer && typeof options === "function") {
        callback_buffer = options as encode_decode_round_trip_testCallback;
        options = {};
    }

    callback_buffer = callback_buffer || dump_block_in_debug_mode;

    should.exist(obj);

    const size = obj.binaryStoreSize();

    const stream = new BinaryStream(Buffer.alloc(size));

    obj.encode(stream);

    callback_buffer(stream.buffer, obj.encodingDefaultBinary, options);

    stream.rewind();

    // reconstruct a object ( some object may not have a default Binary and should be recreated
    const expandedNodeId = obj.encodingDefaultBinary;
    const objReloaded = expandedNodeId ? constructObject(expandedNodeId) : new obj.constructor();

    objReloaded.decode(stream);

    redirectToNull(() => analyze_object_binary_encoding(obj));
    compare(objReloaded, obj);
    return objReloaded;
}

export function json_encode_decode_round_trip_test(obj: unknown, options: unknown, callbackBuffer?: unknown): void {
    if (!callbackBuffer && typeof options === "function") {
        callbackBuffer = options;
        options = {};
    }
    callbackBuffer = callbackBuffer || dump_block_in_debug_mode;

    should.exist(obj);

    const json = JSON.stringify(obj);

    const objReloaded = JSON.parse(json);

    compare(objReloaded, obj);

    return objReloaded;
}
