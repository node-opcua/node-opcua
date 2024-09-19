import { assert } from "node-opcua-assert";
import { AsymmetricAlgorithmSecurityHeader, SecureMessageChunkManager, SecurityPolicy, SequenceNumberGenerator, SymmetricAlgorithmSecurityHeader } from "../source";
import { Mode } from "node-opcua-chunkmanager";

/**

 *
 * @param messageBody
 * @param msgType
 * @param chunkSize
 * @return {Array}
 *
 * wrap a message body into one or more messageChunks
 * (  use this method to build fake data blocks in tests)
 */
export function decompose_message_body_in_chunks(messageBody: Buffer, msgType: string, chunkSize: number): Array<any> {

    assert(chunkSize > 24, "expecting chunkSize");
    assert(msgType.length === 3, " invalid msgType " + msgType);
    assert(messageBody instanceof Buffer && messageBody.length > 0, " invalid buffer");

    const sequenceNumberGenerator = new SequenceNumberGenerator();

    const channelId = 10;
    const options = {
        channelId,
        chunkSize,
        cipherBlockSize: 0,
        plainBlockSize: 0,
        requestId: 36,
        sequenceHeaderSize: 0,
        signatureLength: 0,
    };

    const securityHeader = msgType == "OPN"
        ? new AsymmetricAlgorithmSecurityHeader({ securityPolicyUri: SecurityPolicy.None })
        : new SymmetricAlgorithmSecurityHeader();

    const mode = Mode.None;
    const msgChunkManager = new SecureMessageChunkManager(mode, msgType, channelId, options, securityHeader, sequenceNumberGenerator);

    const chunks: Buffer[] = [];
    msgChunkManager.on("chunk", (chunk: Buffer | null) => {
        if (chunk) {
            assert(chunk.length > 0);
            chunks.push(chunk);
        }
    });
    msgChunkManager.write(messageBody);
    msgChunkManager.end();
    assert(chunks.length > 0, "decompose_message_body_in_chunks: must produce at least one chunk");
    return chunks;
}
