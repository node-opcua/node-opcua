"use strict";
var assert = require("node-opcua-assert");
var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
function readMessageHeader(stream) {

    assert(stream instanceof BinaryStream);

    var msgType = String.fromCharCode(stream.readUInt8()) +
      String.fromCharCode(stream.readUInt8()) +
      String.fromCharCode(stream.readUInt8());

    var isFinal = String.fromCharCode(stream.readUInt8());

    var length = stream.readUInt32();

    return {msgType: msgType, isFinal: isFinal, length: length};
}

exports.readMessageHeader = readMessageHeader;

