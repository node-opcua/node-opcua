"use strict";

function replaceBufferWithHexDump(obj) {
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            if (obj[p] instanceof Buffer) {
                obj[p] = "<BUFFER>" + obj[p].toString("hex") + "</BUFFER>";
            } else if (typeof obj[p] === "object") {
                replaceBufferWithHexDump(obj[p]);
            }
        }
    }
    return obj;
}



exports.replaceBufferWithHexDump = replaceBufferWithHexDump;

