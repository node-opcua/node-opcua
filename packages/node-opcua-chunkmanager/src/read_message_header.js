"use strict";
const assert = require("node-opcua-assert").assert;
const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
function readMessageHeader(stream) {

    assert(stream instanceof BinaryStream);

    const msgType = String.fromCharCode(stream.readUInt8()) +
      String.fromCharCode(stream.readUInt8()) +
      String.fromCharCode(stream.readUInt8());

    const isFinal = String.fromCharCode(stream.readUInt8());

    const length = stream.readUInt32();

    return {msgType: msgType, isFinal: isFinal, length: length};
}

exports.readMessageHeader = readMessageHeader;

