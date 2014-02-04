var opcua = require("./nodeopcua");
var BinaryStream = opcua.BinaryStream;

var ec = require("../lib/encode_decode");
var factories = require("../lib/factories");
var buffer_ellipsis = require("../lib/utils").buffer_ellipsis;
var color = require("colors");
var hexy = require("hexy");
var assert = require("assert");

var spaces = "                                                                                                                   ";


function f(n, width) {
    var s = n.toString();
    return (s + "      ").substr(0, Math.max(s.length, width));
}

function packet_analyzer(buffer, id) {

    var cur_node = {};
    var queue = [];
    var padding = 0;

    var pad = function () {
        return "         ".substr(0, padding);
    };

    var options = {
        tracer: {
            trace: function (operation, name, value, start, end) {

                var str = "";
                var str2 = "";
                if (operation === "start") {

                    cur_node[name] = {};
                    queue.push(cur_node);
                    cur_node = cur_node[name];
                    cur_node.buffer_start = start;
                    str = pad() +  name.toString();
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
                    str = pad() + "." + name + " (length = " + value + ") " + "[";

                    padding += 2;

                } else if (operation === "end_array") {
                    cur_node.buffer_end = end;
                    cur_node = queue.pop();
                    padding -= 2;
                    str = pad() + "]";

                } else if (operation === "member") {
                    // console.log("!!!!!!!!!!!!!!!!!!!!!!!!",start,end);
                    var n = 0;
                    var strBuf = "";
                    n = end - start;
                    var b = buffer.slice(start, end);

                    strBuf = buffer_ellipsis(b);


                    str = (pad() + "." + name + " :" + spaces).substr(0, 35);
                    console.log(str);

                    var hexDump = "";
                    if (value instanceof Buffer) {

                        hexDump = hexy.hexy(value, { width: 32, format: "twos" });
                        value = "<BUFFER>";
                        console.log(hexDump);
                    }
                    str = pad() + ("     " + value).green;

                    str2 = "s:".cyan + f(start, 4) + " e:".cyan + f(end, 4) + " n:".cyan + f(n, 4) + " " + strBuf.yellow;
                    str = (str + spaces).substr(0, 80) + str2;

                }
                console.log(str);
            }
        }
    };

    // read nodeId

    var stream = new BinaryStream(buffer);

    var objMessage = undefined;
    if (!id) {
        id = ec.decodeExpandedNodeId(stream);
    } else if (typeof id === "object" && id._description) {
        objMessage = id;
    }

    objMessage = objMessage || factories.constructObject(id);

    options.name = "message";
    objMessage.decode(stream, options);

    //  console.log(JSON.stringify(objMessage,null," "));

}



var chooseSecurityHeader = require("./secure_channel_service").chooseSecurityHeader;
var SequenceHeader = require("./secure_channel_service").SequenceHeader;


/**
 * convert the messageChunk header to a string
 *
 * @param messageChunk {BinaryStream}
 * @returns {string}
 */
function messageHeaderToString(messageChunk) {

    var stream = new BinaryStream(messageChunk);

    var messageHeader = opcua.readMessageHeader(stream);
    assert(messageHeader.msgType !== "HEL");

    if (messageHeader.msgType === "ERR") {

        return messageHeader.msgType + " " +
            messageHeader.isFinal +
            " length   = " + messageHeader.length;
    }
    var securityHeader = chooseSecurityHeader(messageHeader.msgType);

    var sequenceHeader = new SequenceHeader();
    assert(stream.length == 8);

    var secureChannelId = stream.readUInt32();
    securityHeader.decode(stream);
    sequenceHeader.decode(stream);

    var slice = messageChunk.slice(0, stream.length);

    return messageHeader.msgType + " " +
        messageHeader.isFinal +
        " length   = " + messageHeader.length +
        " channel  = " + secureChannelId +
        " seqNum   = " + sequenceHeader.sequenceNumber +
        " req ID   = " + sequenceHeader.requestId +
        " policy   = " + securityHeader.securityPolicyUri +
        "\n\n" + hexy.hexy(slice, {width: 32 , format: "twos"});
    //" hex  " + slice.toString("hex");


    // return _toString(securityHeader) + "\n" + _toString(sequenceHeader);
}

exports.packet_analyzer = packet_analyzer;
exports.messageHeaderToString = messageHeaderToString;
