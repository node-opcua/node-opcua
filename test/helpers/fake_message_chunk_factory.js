

// todo : move to helpers

var MessageChunkManager = require("../../lib/misc/message_chunk_manager").MessageChunkManager;

/**
 * @method iterate_on_signed_message_chunks
 * @param callback {Function}
 * @param callback.err  {Error}
 * @param callback.chunks  {Array<Buffer>}
 *
 */


var makeMessageChunkSignatureForTest = require("../helpers/signature_helpers").makeMessageChunkSignatureForTest;


function iterate_on_signed_message_chunks(buffer,callback) {

    var body_size = 512;
    var chunk_size = body_size - 12 - 128;

    var options = {
        footerSize: 128,
        signingFunc: makeMessageChunkSignatureForTest
    };
    var msgChunkManager = new MessageChunkManager(body_size, "MSG", 0xDEADBEEF, options);

    var chunks = [];

    function collect_chunk(chunk) {
        var copy_chunk = new Buffer(chunk.length);
        chunk.copy(copy_chunk, 0, 0, chunk.length);

        // append the copy to our chunk collection
        chunks.push(copy_chunk);
    }

    msgChunkManager.on("chunk", function (chunk, final) {
        collect_chunk(chunk);
        callback(null,chunk);
        if (final) {
        }
    });

    msgChunkManager.write(buffer, buffer.length);
    // write this single buffer
    msgChunkManager.end();
}
exports.iterate_on_signed_message_chunks = iterate_on_signed_message_chunks;

