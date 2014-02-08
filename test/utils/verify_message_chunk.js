var MessageBuilder = require("../../lib/message_builder").MessageBuilder;
var packet_analyzer = require("../../lib/packet_analyzer").packet_analyzer;
var messageHeaderToString = require("../../lib/packet_analyzer").messageHeaderToString;

function verify_multi_chunk_message(messageChunks) {

    var messageBuild = new MessageBuilder();
    messageBuild.on("full_message_body", function (full_message_body) {

        packet_analyzer(full_message_body);
    });

    messageChunks.forEach(function (messageChunk) {
        console.log(messageHeaderToString(messageChunk));
        messageBuild.feed(messageChunk);
    });
}

function verify_single_chunk_message(messageChunk) {
    verify_multi_chunk_message([messageChunk]);
}

exports.verify_multi_chunk_message = verify_multi_chunk_message;
exports.verify_single_chunk_message = verify_single_chunk_message;