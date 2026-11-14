/**
 * @module node-opcua-server
 *
 * A response a session worker encoded (encodeMessageBody), as a front's secure channel sends it: its
 * bytes go into the chunks as they are. The worker set what the channel would (the request handle,
 * the diagnostics the request asked for); its header is decoded here for those who look at it.
 */
import { type OutputBinaryStream } from "node-opcua-binary-stream";
import type { ExpandedNodeId } from "node-opcua-nodeid";
import { ResponseHeader } from "node-opcua-types";
export declare class EncodedResponse {
    #private;
    readonly schema: {
        name: string;
        encodingDefaultBinary: ExpandedNodeId;
    };
    readonly responseHeader: ResponseHeader;
    constructor(bytes: Uint8Array, name: string);
    /** the fields, as the worker encoded them; the channel writes the encoding NodeId before them */
    encode(stream: OutputBinaryStream): void;
}
//# sourceMappingURL=encoded_response.d.ts.map