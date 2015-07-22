require("requirish")._(module);

function decompose_message_in_chunks(message, msgType, chunkSize) {
    var decompose_message_body_in_chunks = require("lib/services/secure_channel_service").decompose_message_body_in_chunks;
    assert(msgType.length === 3);
    chunkSize = chunkSize || 32;
    var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
    var buffer = new Buffer(message.binaryStoreSize());
    message.encode(new BinaryStream(buffer));
    return decompose_message_body_in_chunks(buffer, msgType, chunkSize);
}
exports.decompose_message_in_chunks = decompose_message_in_chunks;