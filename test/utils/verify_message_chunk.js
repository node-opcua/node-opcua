var MessageBuilder = require("../../lib/message_builder").MessageBuilder;
var packet_analyzer = require("../../lib/packet_analyzer").packet_analyzer;
var messageHeaderToString = require("../../lib/packet_analyzer").messageHeaderToString;
var sprintf = require("sprintf");
/**
 *
 * @param packets
 */
function verify_multi_chunk_message(packets) {

    var messageBuild = new MessageBuilder();
    messageBuild.on("full_message_body", function (full_message_body) {
        console.log("full_message_body received:");
        packet_analyzer(full_message_body);
    });
    messageBuild.on("start_chunk", function (info,data) {
        console.log(" starting new chunk ",info.messageHeader);
    });

    messageBuild.on("chunk", function (messageChunk) {
        console.log(messageHeaderToString(messageChunk));
    });

    var l = 0;
    packets.forEach(function (packet) {
        if (packet instanceof Array) {
            packet = new Buffer(packet);
        }
        l+=packet.length;
        console.log(sprintf(" adding packet size : %5d l=%d", packet.length,l));
        messageBuild.feed(packet);
    });
}

function verify_single_chunk_message(packet) {
    verify_multi_chunk_message([packet]);
}

exports.verify_multi_chunk_message = verify_multi_chunk_message;
exports.verify_single_chunk_message = verify_single_chunk_message;