import { UInt32 } from "node-opcua-basic-types";

export interface IHelloAckLimits {
    receiveBufferSize: UInt32;
    sendBufferSize: UInt32;
    maxMessageSize: UInt32;
    maxChunkCount: UInt32;
}
