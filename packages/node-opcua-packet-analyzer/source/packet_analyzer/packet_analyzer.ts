import { inspect } from "node:util";
import chalk from "chalk";
import { assert } from "node-opcua-assert";

import { decodeByte, decodeExpandedNodeId, decodeNodeId, decodeUInt32 } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { hexDump } from "node-opcua-debug";
import { type ConstructorFunc, getStandardDataTypeFactory, type IBaseUAObject } from "node-opcua-factory";
import type { ExpandedNodeId } from "node-opcua-nodeid";
import { buffer_ellipsis } from "node-opcua-utils";

const displayWidth = 132;
const separator = "-".repeat(49);

function padNumber(n: number, width: number): string {
    return n.toString().padEnd(width);
}

/** Encoding info maps enum key names ↔ bitmask values */
type EncodingInfo = Record<string, number | string>;

function display_encoding_mask(padding: string, encodingMask: number, encodingInfo: EncodingInfo): void {
    for (const v in encodingInfo) {
        if (!Object.hasOwn(encodingInfo, v)) {
            continue;
        }
        const enumKey = encodingInfo[v];
        if (typeof enumKey === "number") {
            continue;
        }

        const mask = encodingInfo[enumKey] as number;
        const bit = Math.log(mask) / Math.log(2);

        const bits = Array<string>(9).fill(".");
        bits[bit] = (encodingMask & mask) === mask ? "Y" : "n";

        console.log(`${padding}  ${bits.join("")}` + ` <- has ${enumKey} 0x${mask.toString(16)}`);
    }
}

function hex_block(start: number, end: number, buffer: Buffer): string {
    const n = end - start;
    const strBuf = buffer_ellipsis(buffer);
    return (
        chalk.cyan("s:") +
        padNumber(start, 4) +
        chalk.cyan(" e:") +
        padNumber(end, 4) +
        chalk.cyan(" n:") +
        padNumber(n, 4) +
        " " +
        chalk.yellow(strBuf)
    );
}

type TraceOperation = "start" | "end" | "start_array" | "end_array" | "start_element" | "end_element" | "member";

interface TracerMethods {
    dump: (title: string, value: unknown) => void;
    encoding_byte: (encodingMask: number, valueEnum: EncodingInfo, start: number, end: number) => void;
    trace: (operation: TraceOperation, name: string, value: unknown, start: number, end: number, fieldType: string) => void;
}

interface Tracer {
    name?: string;
    tracer: TracerMethods;
}

interface Encodeable {
    encodingDefaultBinary: unknown;
    encode?: (stream: BinaryStream) => void;
}

function isEncodeable(val: unknown): val is Encodeable {
    return val != null && typeof (val as Encodeable).encode === "function";
}

function make_tracer(buffer: Buffer, padding: number, offset?: number): Tracer {
    padding ??= 0;
    offset ??= 0;

    const pad = (): string => "".padEnd(padding);

    function _display(str: string, hexInfo?: string): void {
        hexInfo ??= "";
        // account for ESC codes for colors
        const nbColorAttributes = str.split("").filter((c) => c === "\u001b").length;
        const extra = nbColorAttributes * 5;
        const line = (pad() + str).padEnd(displayWidth + extra);
        console.log(`${line}|${hexInfo}`);
    }

    function display(str: string, hexInfo?: string): void {
        for (const line of str.split("\n")) {
            _display(line, hexInfo);
        }
    }

    function display_encodeable(value: Encodeable, buffer1: Buffer, start: number, end: number): void {
        const bufferExtract = buffer1.subarray(start, end);
        const stream = new BinaryStream(bufferExtract);
        const nodeId = decodeNodeId(stream);
        const encodingMask = decodeByte(stream);
        const length = decodeUInt32(stream);

        display(`${chalk.green("     ExpandedNodId =")} ${nodeId}`);
        display(`${chalk.green("     encoding mask =")} ${encodingMask}`);
        display(`${chalk.green("            length =")} ${length}`);
        analyzePacket(
            bufferExtract.subarray(stream.length),
            value.encodingDefaultBinary as ObjectMessage,
            padding + 2,
            start + stream.length
        );
    }

    return {
        tracer: {
            dump: (title: string, value: unknown): void => display(`${title}  ${chalk.green(String(value))}`),

            encoding_byte: (encodingMask: number, valueEnum: EncodingInfo, start: number, end: number): void => {
                assert(valueEnum);
                const b = buffer.subarray(start, end);
                display("  012345678", hex_block(start, end, b));
                display_encoding_mask(pad(), encodingMask, valueEnum);
            },

            trace: (
                operation: TraceOperation,
                name: string,
                value: unknown,
                start: number,
                end: number,
                fieldType: string
            ): void => {
                const b = buffer.subarray(start, end);

                switch (operation) {
                    case "start":
                        padding += 2;
                        display(name);
                        break;

                    case "end":
                        padding -= 2;
                        break;

                    case "start_array":
                        display(`.${name} (length = ${value}) [`, hex_block(start, end, b));
                        padding += 2;
                        break;

                    case "end_array":
                        padding -= 2;
                        display(`] // ${name}`);
                        break;

                    case "start_element":
                        display(` #${value} {`);
                        padding += 2;
                        break;

                    case "end_element":
                        padding -= 2;
                        display(` } // # ${value}`);
                        break;

                    case "member": {
                        display(`.${name} : ${fieldType}`);

                        if (value instanceof Buffer) {
                            console.log(hexDump(value));
                            value = "<BUFFER>";
                        }

                        if (isEncodeable(value)) {
                            if (fieldType === "ExtensionObject") {
                                display_encodeable(value, buffer, start, end);
                            } else {
                                display(String(value) || "<empty>");
                            }
                        } else {
                            display(` ${value}`, hex_block(start, end, b));
                        }
                        break;
                    }
                }
            }
        }
    };
}

export interface AnalyzePacketOptions {
    [key: string]: unknown;
}

export interface ObjectMessage {
    encode(stream: BinaryStream): void;
    decode(stream: BinaryStream): void;
    decodeDebug(stream: BinaryStream, options: Tracer): void;
}

export function analyzePacket(
    buffer: Buffer,
    objMessage: ObjectMessage,
    padding: number,
    offset?: number,
    customOptions?: AnalyzePacketOptions
): void {
    const stream = new BinaryStream(buffer);
    _internalAnalyzePacket(buffer, stream, objMessage, padding, customOptions, offset);
}

export function analyseExtensionObject(
    buffer: Buffer,
    padding: number,
    offset: number,
    customOptions?: AnalyzePacketOptions
): void {
    const stream = new BinaryStream(buffer);
    let id: ExpandedNodeId | undefined;
    let objMessage: ObjectMessage | undefined;
    try {
        id = decodeExpandedNodeId(stream);
        objMessage = getStandardDataTypeFactory().constructObject(id) as unknown as ObjectMessage;
    } catch (err) {
        console.log(id);
        console.log(err);
        console.log("Cannot read decodeExpandedNodeId on stream " + stream.buffer.toString("hex"));
    }
    _internalAnalyzePacket(buffer, stream, objMessage, padding, customOptions, offset);
}

function _internalAnalyzePacket(
    buffer: Buffer,
    stream: BinaryStream,
    objMessage: ObjectMessage | undefined,
    padding: number,
    customOptions?: AnalyzePacketOptions,
    offset?: number
): void {
    let options = make_tracer(buffer, padding, offset);
    options.name = "message";
    if (customOptions) {
        options = { ...options, ...customOptions };
    }
    try {
        if (objMessage) {
            objMessage.decodeDebug(stream, options);
        } else {
            console.log(" Invalid object", objMessage);
        }
    } catch (err) {
        console.log(" Error in ", err);
        if (err instanceof Error) {
            console.log(" Error in ", err.stack);
        }
        console.log(" objMessage ", inspect(objMessage, { colors: true }));
    }
}

export function analyze_object_binary_encoding(obj: IBaseUAObject): void {
    assert(obj);

    const size = obj.binaryStoreSize();
    console.log(separator);
    console.log(" size = ", size);
    const stream = new BinaryStream(size);
    obj.encode(stream);

    stream.rewind();
    console.log(separator);
    if (stream.buffer.length < 256) {
        console.log(hexDump(stream.buffer));
        console.log(separator);
    }

    const Ctor = obj.constructor as ConstructorFunc;
    const reloadedObject = new Ctor();
    analyzePacket(stream.buffer, reloadedObject as unknown as ObjectMessage, 0);
}
