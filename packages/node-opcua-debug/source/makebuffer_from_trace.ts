import { makeBuffer } from "node-opcua-buffer-utils";

//xx const deprecated_trim = function (str:string):string {
//xx     return str.replace(/^\s+|\s+$/g, "");
//xx };

export function inlineText(f:any):string {
    let k = f.toString().
        replace(/^[^\/]+\/\*!?/, '').
        replace(/\*\/[^\/]+$/, '');
    k = k.split("\n").map((t:string)=> t.trim()).join("\n");
    return k;
}

function hexString(str:string):string {

    let hexline:string = "";
    const lines = str.split("\n");
    for (let line of lines) {
        line = line.trim();
        if (line.length > 80) {
            line = line.substr(10, 98).trim();
            hexline = hexline ? hexline + " " + line : line;
        } else if (line.length > 60) {
            line = line.substr(7, 48).trim();
            hexline = hexline ? hexline + " " + line : line;
        }
    }
    return hexline;
}

export function makebuffer_from_trace(func:any):Buffer {
    return makeBuffer(hexString(inlineText(func)));
}
