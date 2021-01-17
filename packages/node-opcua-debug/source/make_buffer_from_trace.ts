/**
 * @module node-opcua-debug
 */
import { makeBuffer } from "node-opcua-buffer-utils";

export function inlineText(f: any): string {
    let k = f
        .toString()
        .replace(/^[^\/]+\/\*!?/, "")
        .replace(/\*\/[^\/]+$/, "");
    k = k
        .split("\n")
        .map((t: string) => t.trim())
        .join("\n");
    return k;
}

function hexString(str: string): string {
    let hexline: string = "";
    let lines = str.split("\n");
    if (lines.length === 0) {
        return hexline;
    }
    while (lines.length && lines[0]!.length === 0) {
        lines = lines.splice(1);
    }
    // find prefix
    const prefixLength = lines[0]!.match(/[0-9a-fA-F:]*\ +/)![0].length;

    for (let line of lines) {
        line = line.trim();
        if (line.length > 80) {
            line = line.substr(10, 98).trim();
            hexline = hexline ? hexline + " " + line : line;
        } else if (line.length > 60) {
            line = line.substr(7, 48).trim();
            hexline = hexline ? hexline + " " + line : line;
        } else if (line.length > prefixLength) {
            line = line.substr(prefixLength, prefixLength + 48).trim();
            hexline = hexline ? hexline + " " + line : line;
        }
    }
    return hexline;
}

// tslint:disable:ban-types
export function makeBufferFromTrace(func: string | Function): Buffer {
    if (typeof func === "string") {
        return makeBuffer(hexString(func as string));
    }
    return makeBuffer(hexString(inlineText(func)));
}
