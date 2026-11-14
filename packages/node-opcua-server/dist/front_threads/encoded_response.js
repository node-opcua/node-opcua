/**
 * @module node-opcua-server
 *
 * A response a session worker encoded (encodeMessageBody), as a front's secure channel sends it: its
 * bytes go into the chunks as they are. The worker set what the channel would (the request handle,
 * the diagnostics the request asked for); its header is decoded here for those who look at it.
 */
import { decodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { ResponseHeader } from "node-opcua-types";
export class EncodedResponse {
    schema;
    responseHeader;
    #bytes;
    #start;
    constructor(bytes, name) {
        const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
        const encoding = decodeExpandedNodeId(stream);
        this.#start = stream.length;
        this.responseHeader = new ResponseHeader();
        this.responseHeader.decode(stream);
        this.schema = { name, encodingDefaultBinary: encoding };
        this.#bytes = bytes;
    }
    /** the fields, as the worker encoded them; the channel writes the encoding NodeId before them */
    encode(stream) {
        const bytes = this.#bytes;
        stream.writeArrayBuffer(bytes.buffer, bytes.byteOffset + this.#start, bytes.byteLength - this.#start);
    }
}
//# sourceMappingURL=encoded_response.js.map