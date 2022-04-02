import { inspect } from "util";
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";

import { decodeByte, decodeExpandedNodeId, decodeNodeId, decodeUInt32 } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { hexDump } from "node-opcua-debug";
import { BaseUAObject, constructObject } from "node-opcua-factory";
import { buffer_ellipsis } from "node-opcua-utils";

const spaces =
    "                                                                                                                                                                             ";

function f(n: number, width: number): string {
    const s = n.toString();
    return (s + "      ").substring(0, Math.max(s.length, width));
}

function display_encoding_mask(padding: string, encodingMask: any, encodingInfo: any) {
    for (const v in encodingInfo) {
        if (!Object.prototype.hasOwnProperty.call(encodingInfo, v)) {
            continue;
        }
        const enumKey = encodingInfo[v];
        if (typeof enumKey === "number") {
            continue;
        }

        const mask = encodingInfo[enumKey];
        const bit = Math.log(mask) / Math.log(2);

        const bits = [".", ".", ".", ".", ".", ".", ".", ".", "."];
        bits[bit] = (encodingMask & mask) === mask ? "Y" : "n";

        console.log(padding + " ", bits.join(""), " <- has " + enumKey + " 0x" + mask.toString(16));
    }
    // DataValueEncodingByte
}

function hex_block(start: number, end: number, buffer: Buffer) {
    const n = end - start;
    const strBuf = buffer_ellipsis(buffer);
    return (
        chalk.cyan("s:") + f(start, 4) + chalk.cyan(" e:") + f(end, 4) + chalk.cyan(" n:") + f(n, 4) + " " + chalk.yellow(strBuf)
    );
}

interface Tracer {
    name?: string;
    tracer: {
        dump: (title: string, value: any) => void;
        encoding_byte: (encodingMask: any, valueEnum: any, start: number, end: number) => void;
        trace: (operation: any, name: any, value: any, start: number, end: number, fieldType: string) => void;
    };
}
function make_tracer(buffer: Buffer, padding: number, offset?: number): Tracer {
    padding = !padding ? 0 : padding;
    offset = offset || 0;

    const pad = () => "                                                       ".substring(0, padding);

    function _display(str: string, hexInfo?: string) {
        hexInfo = hexInfo || "";
        // account for ESC codes for colors
        const nbColorAttributes = [...str.split("")].filter((c) => c === "\u001b").length;
        const extra = nbColorAttributes * 5;
        console.log((pad() + str + spaces).substring(0, 132 + extra) + "|" + hexInfo);
    }
    function display(str: string, hexInfo?: string) {
        const lines = str.split("\n");
        for (const line of lines) {
            _display(line, hexInfo);
        }
    }

    function display_encodeable(value: any, buffer1: Buffer, start: number, end: number) {
        const bufferExtract = buffer1.slice(start, end);
        const stream = new BinaryStream(bufferExtract);
        const nodeId = decodeNodeId(stream);
        const encodingMask = decodeByte(stream); // 1 bin 2: xml
        const length = decodeUInt32(stream);

        display(chalk.green("     ExpandedNodId =") + " " + nodeId);
        display(chalk.green("     encoding mask =") + " " + encodingMask);
        display(chalk.green("            length =") + " " + length);
        analyzePacket(bufferExtract.slice(stream.length), value.encodingDefaultBinary, padding + 2, start + stream.length);
    }

    return {
        tracer: {
            dump: (title: string, value: any) => display(title + "  " + chalk.green(value.toString())),

            encoding_byte: (encodingMask: any, valueEnum: any, start: number, end: number) => {
                assert(valueEnum);
                const b = buffer.slice(start, end);
                display("  012345678", hex_block(start, end, b));
                display_encoding_mask(pad(), encodingMask, valueEnum);
            },

            trace: (operation: any, name: any, value: any, start: number, end: number, fieldType: string) => {
                const b = buffer.slice(start, end);
                let _hexDump = "";

                switch (operation) {
                    case "start":
                        padding += 2;
                        display(name.toString());
                        break;

                    case "end":
                        padding -= 2;
                        break;

                    case "start_array":
                        display("." + name + " (length = " + value + ") " + "[", hex_block(start, end, b));
                        padding += 2;
                        break;

                    case "end_array":
                        padding -= 2;
                        display("] // " + name);
                        break;

                    case "start_element":
                        display(" #" + value + " {");
                        padding += 2;
                        break;

                    case "end_element":
                        padding -= 2;
                        display(" } // # " + value);
                        break;

                    case "member":
                        display("." + name + " : " + fieldType);

                        _hexDump = "";
                        if (value instanceof Buffer) {
                            _hexDump = hexDump(value);
                            console.log(_hexDump);
                            value = "<BUFFER>";
                        }

                        if (value && value.encode) {
                            if (fieldType === "ExtensionObject") {
                                display_encodeable(value, buffer, start, end);
                            } else {
                                const str = value.toString() || "<empty>";
                                display(str);
                            }
                        } else {
                            display(" " + value, hex_block(start, end, b));
                        }
                        break;
                }
            }
        }
    };
}

interface AnalyzePacketOptions {}

export interface ObjectMessage {
    encode(stream: BinaryStream): void;
    decode(stream: BinaryStream): void;
    decodeDebug(stream: BinaryStream, options: any): void;
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
    let id;
    let objMessage;
    try {
        id = decodeExpandedNodeId(stream);
        objMessage = constructObject(id);
    } catch (err) {
        console.log(id);
        console.log(err);
        console.log("Cannot read decodeExpandedNodeId  on stream " + stream.buffer.toString("hex"));
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
) {
    let options = make_tracer(buffer, padding, offset);
    options.name = "message";
    if (customOptions) options = { ...options, ...customOptions };
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

export function analyze_object_binary_encoding(obj: BaseUAObject): void {
    assert(obj);

    const size = obj.binaryStoreSize();
    console.log("-------------------------------------------------");
    console.log(" size = ", size);
    const stream = new BinaryStream(size);
    obj.encode(stream);

    stream.rewind();
    console.log("-------------------------------------------------");
    if (stream.buffer.length < 256) {
        console.log(hexDump(stream.buffer));
        console.log("-------------------------------------------------");
    }

    const reloadedObject = new (obj.constructor as any)();
    analyzePacket(stream.buffer, reloadedObject, 0);
}
