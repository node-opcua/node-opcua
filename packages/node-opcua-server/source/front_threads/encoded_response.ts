/**
 * @module node-opcua-server
 *
 * A response a session worker encoded (encodeMessageBody), as a front's secure channel sends it: its
 * bytes go into the chunks as they are. The worker set what the channel would (the request handle,
 * the diagnostics the request asked for); its header is decoded here for those who look at it.
 */

import { decodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream, type OutputBinaryStream } from "node-opcua-binary-stream";
import type { ExpandedNodeId } from "node-opcua-nodeid";
import { ResponseHeader } from "node-opcua-types";

export class EncodedResponse {
    public readonly schema: { name: string; encodingDefaultBinary: ExpandedNodeId };
    public readonly responseHeader: ResponseHeader;
    readonly #bytes: Uint8Array;
    readonly #start: number;

    constructor(bytes: Uint8Array, name: string) {
        const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
        const encoding = decodeExpandedNodeId(stream);
        this.#start = stream.length;
        this.responseHeader = new ResponseHeader();
        this.responseHeader.decode(stream);
        this.schema = { name, encodingDefaultBinary: encoding };
        this.#bytes = bytes;
    }

    /** the fields, as the worker encoded them; the channel writes the encoding NodeId before them */
    public encode(stream: OutputBinaryStream): void {
        const bytes = this.#bytes;
        stream.writeArrayBuffer(bytes.buffer as ArrayBuffer, bytes.byteOffset + this.#start, bytes.byteLength - this.#start);
    }
}
