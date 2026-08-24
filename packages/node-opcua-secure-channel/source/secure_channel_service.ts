/**
 * @module node-opcua-secure-channel
 */
// A SecureChannel is a long-running logical connection between a single Client and a single Server.
// This channel maintains a set of keys known only to the Client and Server, which are used to
// authenticate and encrypt Messages sent across the network. The ClientSecureChannelLayer Services allow
// the Client and Server to securely negotiate the keys to use.

export {
    AsymmetricAlgorithmSecurityHeader,
    CloseSecureChannelRequest,
    CloseSecureChannelResponse,
    OpenSecureChannelRequest,
    OpenSecureChannelResponse,
    ServiceFault,
    SymmetricAlgorithmSecurityHeader
} from "node-opcua-service-secure-channel";
export {
    AcknowledgeMessage,
    HelloMessage
} from "node-opcua-transport";

export { MessageChunker } from "./message_chunker";
