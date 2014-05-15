
function decompose_message_in_chunks(message,msgType,chunk_size) {
    var decompose_message_body_in_chunks = require("./../../lib/services/secure_channel_service").decompose_message_body_in_chunks;
    assert(msgType.length ==3 );
    chunk_size = chunk_size || 32;
    var BinaryStream  = require("./../../lib/misc/binaryStream").BinaryStream;
    var buffer = new Buffer(message.binaryStoreSize());
    message.encode(new BinaryStream(buffer));
    return decompose_message_body_in_chunks(buffer,msgType,chunk_size);
}
exports.decompose_message_in_chunks = decompose_message_in_chunks;