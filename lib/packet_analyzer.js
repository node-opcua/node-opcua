var opcua = require("./nodeopcua");
var BinaryStream = require("./binaryStream").BinaryStream;

var ec = require("../lib/encode_decode");
var factories = require("../lib/factories");
var buffer_ellipsis = require("../lib/utils").buffer_ellipsis;
var color = require("colors");
var hexDump = require("../lib/utils").hexDump;
var assert = require("assert");
var util = require("util");

var spaces = "                                                                                                                             ";


function f(n, width) {
    var s = n.toString();
    return (s + "      ").substr(0, Math.max(s.length, width));
}

function packet_analyzer(buffer, id, padding , offset) {

    var cur_node = {};
    var queue = [];
    padding =  padding || 0 ;
    offset = offset || 0;

    var pad = function () {
        return "         ".substr(0, padding);
    };

    var options = {
        tracer: {
            trace: function (operation, name, value, start, end, fieldType) {

                var strBuf = "";
                var n = end - start;
                var b = buffer.slice(start, end);
                strBuf = buffer_ellipsis(b);

                var str = "";
                var str2 = "";
                if (operation === "start") {

                    cur_node[name] = {};
                    queue.push(cur_node);
                    cur_node = cur_node[name];
                    cur_node.buffer_start = start;
                    str = pad() +  name.toString();
                    console.log(str);
                    padding += 2;

                } else if (operation === "end") {
                    cur_node.buffer_end = end;
                    cur_node = queue.pop();
                    padding -= 2;

                } else if (operation === "start_array") {
                    cur_node[name] = {};
                    queue.push(cur_node);
                    cur_node = cur_node[name];
                    cur_node.buffer_start = start;
                    str = pad() + "." + name + " (length = " + value + ") " + "[" ;
                    str2 = "s:".cyan + f(start, 4) + " e:".cyan + f(end, 4) + " n:".cyan + f(n, 4) + " " + strBuf.yellow;
                    str = (str + spaces).substr(0, 80) + str2;
                    console.log(str);
                    padding += 2;

                } else if (operation === "end_array") {
                    cur_node.buffer_end = end;
                    cur_node = queue.pop();
                    padding -= 2;
                    str = pad() + "]";
                    console.log(str);

                } else if (operation === "member") {
                    // console.log("!!!!!!!!!!!!!!!!!!!!!!!!",start,end);

                    str = (pad() + "." + name + " : " + fieldType + spaces).substr(0, 35);
                    console.log(str);

                    var _hexDump = "";
                    if (value instanceof Buffer) {

                        _hexDump = hexDump(value);
                        value = "<BUFFER>";
                        console.log(_hexDump);
                    }
                    str = pad() + ("     " + value).green;

                    str2 = "s:".cyan + f(start+offset, 4) + " e:".cyan + f(end+offset, 4) + " n:".cyan + f(n, 4) + " " + strBuf.yellow;
                    str = (str + spaces).substr(0, 80) + str2;
                    console.log(str);

                    if (value && value.encode) {
                        var ext_buf =buffer.slice(start,end);
                        var stream = new BinaryStream(ext_buf);
                        var nodeId = ec.decodeNodeId(stream);
                        var encodingMask = ec.decodeByte(stream); // 1 bin 2: xml
                        var length = ec.decodeUInt32(stream);

                        str = pad() + ("     ExpandedNodId" ).green + " " + nodeId;
                        console.log(str);
                        str = pad() + ("     encoding mask" ).green + " " + encodingMask;
                        console.log(str);
                        str = pad() + ("     length"        ).green + " " + length;
                        console.log(str);
                        assert(fieldType == "ExtensionObject");
                        var o = start + stream.length
                        packet_analyzer(ext_buf.slice(stream.length),value.encodingDefaultBinary,padding+5,start+stream.length );
                    } else {
                    }

                }
            }
        }
    };

    // read nodeId

    var stream = new BinaryStream(buffer);

    var objMessage = undefined;
    if (!id) {
        id = ec.decodeExpandedNodeId(stream);
    } else if (typeof id === "object" && id._schema) {
        objMessage = id;
    }

    try {
        objMessage = objMessage || factories.constructObject(id);
    }
    catch(err) {
        console.log(id);
        console.log(err);
        console.log("Cannot read decodeExpandedNodeId  on stream " + stream._buffer.toString("hex"));
    }

    options.name = "message";
    try  {
        objMessage.decode(stream, options);

    }
    catch(err) {
        console.log(" Error in ", err);
        console.log(" Error in ", err.stack);
        console.log(" objMessage " , util.inspect(objMessage, {color:true}));
    }
    //  console.log(JSON.stringify(objMessage,null," "));

}
var chooseSecurityHeader = require("./secure_channel_service").chooseSecurityHeader;
var SequenceHeader = require("./secure_channel_service").SequenceHeader;
var AsymmetricAlgorithmSecurityHeader = require("./secure_channel_service").AsymmetricAlgorithmSecurityHeader;

/**
 * convert the messageChunk header to a string
 *
 * @param messageChunk {BinaryStream}
 * @returns {string}
 */
function messageHeaderToString(messageChunk) {

    var stream = new BinaryStream(messageChunk);

    var messageHeader = opcua.readMessageHeader(stream);
    if (messageHeader.msgType === "ERR" || messageHeader.msgType === "HEL") {
        return messageHeader.msgType + " " + messageHeader.isFinal + " length   = " + messageHeader.length;
    }
    var securityHeader = chooseSecurityHeader(messageHeader.msgType);

    var sequenceHeader = new SequenceHeader();
    assert(stream.length == 8);

    var secureChannelId = stream.readUInt32();
    securityHeader.decode(stream);
    sequenceHeader.decode(stream);

    var slice = messageChunk.slice(0, stream.length);


    if (securityHeader instanceof AsymmetricAlgorithmSecurityHeader) {
        return messageHeader.msgType + " " +
            messageHeader.isFinal +
            " length   = " + messageHeader.length +
            " channel  = " + secureChannelId +
            " seqNum   = " + sequenceHeader.sequenceNumber +
            " req ID   = " + sequenceHeader.requestId +
            " security   = " +JSON.stringify(securityHeader) +
            "\n\n" + hexDump(slice);

    } else {
        return messageHeader.msgType + " " +
            messageHeader.isFinal +
            " length   = " + messageHeader.length +
            " channel  = " + secureChannelId +
            " seqNum   = " + sequenceHeader.sequenceNumber +
            " req ID   = " + sequenceHeader.requestId +
            " security   = " + JSON.stringify(securityHeader) +
            "\n\n" + hexDump(slice);

    }
}

/*
function analyze_object_binary_encoding(obj) {

    var stream = new BinaryStream(obj.binaryStoreSize());
    obj.encode(stream);
    stream.rewind();
    packet_analyzer(stream._buffer,obj.encodingDefaultBinary);

}
 exports.analyze_object_binary_encoding =  analyze_object_binary_encoding;
 */

exports.packet_analyzer = packet_analyzer;
exports.messageHeaderToString = messageHeaderToString;
exports.single_message_chunk_analyser = single_message_chunk_analyser;


