"use strict";

const getRandomInt = require("./utils").getRandomInt;
const _ = require("underscore");

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const isValidGuid = require("node-opcua-guid").isValidGuid;
const emptyGuid = require("node-opcua-guid").emptyGuid;

function toHex(i, nb) {
    return ("000000000000000" + i.toString(16)).substr(-nb);
}

exports.emptyGuid = emptyGuid;
exports.isValidGuid = isValidGuid;

exports.randomGuid = function() {
    const b = new BinaryStream(20);
    for (let i = 0; i < 20; i++) {
        b.writeUInt8(getRandomInt(0, 255));
    }
    b.rewind();
    const value = exports.decodeGuid(b);
    return value;
};

exports.encodeGuid = function(guid, stream) {
    if (!isValidGuid(guid)) {
        throw new Error(" Invalid GUID : '" + JSON.stringify(guid) + "'");
    }
    //           1         2         3
    // 012345678901234567890123456789012345
    // |        |    |    | |  | | | | | |
    // 12345678-1234-1234-ABCD-0123456789AB
    // 00000000-0000-0000-0000-000000000000";
    function write_UInt32(starts) {
        let start;
        let i;
        const n = starts.length;
        for (i = 0; i < n; i++) {
            start = starts[i];
            stream.writeUInt32(parseInt(guid.substr(start, 8), 16));
        }
    }

    function write_UInt16(starts) {
        let start;
        let i;
        const n = starts.length;
        for (i = 0; i < n; i++) {
            start = starts[i];
            stream.writeUInt16(parseInt(guid.substr(start, 4), 16));
        }
    }

    function write_UInt8(starts) {
        let start;
        let i;
        const n = starts.length;
        for (i = 0; i < n; i++) {
            start = starts[i];
            stream.writeUInt8(parseInt(guid.substr(start, 2), 16));
        }
    }

    write_UInt32([0]);
    write_UInt16([9, 14]);
    write_UInt8([19, 21, 24, 26, 28, 30, 32, 34]);
};

exports.decodeGuid = function(stream) {
    function read_UInt32() {
        return toHex(stream.readUInt32(), 8);
    }

    function read_UInt16() {
        return toHex(stream.readUInt16(), 4);
    }

    function read_UInt8() {
        return toHex(stream.readUInt8(), 2);
    }

    function read_many(func, nb) {
        let result = "";
        for (let i = 0; i < nb; i++) {
            result += func();
        }
        return result;
    }

    const data1 = read_UInt32();

    const data2 = read_UInt16();

    const data3 = read_UInt16();

    const data4_5 = read_many(read_UInt8, 2);

    const data6_B = read_many(read_UInt8, 6);

    const guid = data1 + "-" + data2 + "-" + data3 + "-" + data4_5 + "-" + data6_B;

    return guid.toUpperCase();
};
