"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var ec = require("lib/misc/encode_decode");
var factories = require("lib/misc/factories_factories");
var buffer_ellipsis = require("lib/misc/utils").buffer_ellipsis;
var hexDump = require("lib/misc/utils").hexDump;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");
var Enum = require("lib/misc/enum");

var spaces = "                                                                                                                                                                             ";


function f(n, width) {
    var s = n.toString();
    return (s + "      ").substr(0, Math.max(s.length, width));
}

function display_encoding_mask(padding, encoding_mask, encoding_info) {
    assert(encoding_info instanceof Enum);
    var bits = [];
    encoding_info.enums.forEach(function (enumValue) {
        var mask = enumValue.value;
        var bit = Math.log(mask) / Math.log(2);
        bits = ['.', '.', '.', '.', '.', '.', '.', '.', '.'];
        bits[bit] = ((encoding_mask & mask) === mask) ? "Y" : "n";

        console.log(padding + " ", bits.join(""), " <- has " + enumValue.key);
    });
    // DataValueEncodingByte
}

function hex_block(start, end, buffer) {
    var n = end - start;
    var strBuf = buffer_ellipsis(buffer);
    return "s:".cyan + f(start, 4) + " e:".cyan + f(end, 4) + " n:".cyan + f(n, 4) + " " + strBuf.yellow;
}


function make_tracer(buffer, padding, offset) {

    padding = padding || 0;
    offset = offset || 0;

    var pad = function () {
        return "                                                       ".substr(0, padding);
    };

    function display(str, hex_info) {
        hex_info = hex_info || "";

        // account for ESC codes for colors
        var nbColorAttributes = _.filter(str, function (c) {
            return c === '\u001b';
        }).length;
        var extra = nbColorAttributes * 5;
        console.log((pad() + str + spaces).substr(0, 132 + extra) + "|" + hex_info);
    }

    function display_encodeable(value, buffer, start, end) {
        var ext_buf = buffer.slice(start, end);
        var stream = new BinaryStream(ext_buf);
        var nodeId = ec.decodeNodeId(stream);
        var encodingMask = ec.decodeByte(stream); // 1 bin 2: xml
        var length = ec.decodeUInt32(stream);

        display("     ExpandedNodId =".green + " " + nodeId);
        display("     encoding mask =".green + " " + encodingMask);
        display("            length =".green + " " + length);
        packet_analyzer(ext_buf.slice(stream.length), value.encodingDefaultBinary, padding + 2, start + stream.length);

    }

    var options = {

        tracer: {

            dump: function (title, value) {
                display(title + "  " + value.toString().green);
            },

            encoding_byte: function (encoding_mask, valueEnum, start, end) {
                var b = buffer.slice(start, end);
                display("  012345678", hex_block(start, end, b));
                display_encoding_mask(pad(), encoding_mask, valueEnum);
            },

            trace: function (operation, name, value, start, end, fieldType) {

                var b = buffer.slice(start, end);
                var str = "";

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

                        var _hexDump = "";
                        if (value instanceof Buffer) {
                            _hexDump = hexDump(value);
                            console.log(_hexDump);
                            value = "<BUFFER>";
                        }
                        display((" " + value).green, hex_block(start, end, b));

                        if (value && value.encode) {
                            if (fieldType === "ExtensionObject") {
                                display_encodeable(value, buffer, start, end);
                            } else {
                                display(value.toString().green);
                            }
                        }
                        break;
                }
            }
        }
    };

    return options;
}

/**
 * @method packet_analyzer
 * @param {Buffer} buffer
 * @param id
 * @param {Integer} padding
 * @param {Integer} offset
 * @param {Object} custom_options
 */
function packet_analyzer(buffer, id, padding, offset, custom_options) {


    var stream = new BinaryStream(buffer);

    var objMessage;
    if (!id) {

        id = ec.decodeExpandedNodeId(stream);

    } else if (typeof id === "object" && id._schema) {
        objMessage = id;
    }

    try {
        objMessage = objMessage || factories.constructObject(id);
    }
    catch (err) {
        console.log(id);
        console.log(err);
        console.log("Cannot read decodeExpandedNodeId  on stream " + stream._buffer.toString("hex"));
    }

    var options = make_tracer(buffer, padding, offset);
    options.name = "message";

    options = _.extend(options, custom_options);
    try {
        objMessage.decode_debug(stream, options);
    }
    catch (err) {
        console.log(" Error in ", err);
        console.log(" Error in ", err.stack);
        console.log(" objMessage ", util.inspect(objMessage, {color: true}));
    }
}


function analyze_object_binary_encoding(obj) {

    assert(obj);

    var size = obj.binaryStoreSize();
    console.log("-------------------------------------------------");
    console.log(" size = ", size);
    var stream = new BinaryStream(new Buffer(size));
    obj.encode(stream);
    stream.rewind();
    console.log("-------------------------------------------------");
    if (stream._buffer.length < 1000) {
        console.log(hexDump(stream._buffer));
    }
    packet_analyzer(stream._buffer, obj.encodingDefaultBinary);

}
exports.analyze_object_binary_encoding = analyze_object_binary_encoding;

exports.packet_analyzer = packet_analyzer;


