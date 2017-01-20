import {next_available_id} from "lib/misc/factories";
const AcknowledgeMessage_Schema = {
    name: "AcknowledgeMessage",
    id: next_available_id(),
    fields: [
        { name: "protocolVersion"   , fieldType: "UInt32" , documentation: "The latest version of the OPC UA TCP protocol supported by the Server." },
        { name: "receiveBufferSize" , fieldType: "UInt32"  },
        { name: "sendBufferSize"    , fieldType: "UInt32" },
        { name: "maxMessageSize"    , fieldType: "UInt32" , documentation: "The maximum size for any request message."},
        { name: "maxChunkCount"     , fieldType: "UInt32" , documentation: "The maximum number of chunks in any request message." }
    ]
};

export {AcknowledgeMessage_Schema};
