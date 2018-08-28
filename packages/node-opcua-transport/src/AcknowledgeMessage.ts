import {
    BaseUAObject,
    check_options_correctness_against_schema, initialize_field,
    parameters,
    buildStructuredType,
    StructuredTypeSchema,
} from "node-opcua-factory";
import { BinaryStream } from "node-opcua-binary-stream";
import { UInt32 , encodeUInt32, decodeUInt32 } from "node-opcua-basic-types";


const schemaAcknowledgeMessage: StructuredTypeSchema = buildStructuredType({
    name: "AcknowledgeMessage",
    baseType: "BaseObjectType",
    fields: [
        {
            name: "protocolVersion",
            fieldType: "UInt32",
            documentation: "The latest version of the OPC UA TCP protocol supported by the Server."
        },
        {name: "receiveBufferSize", fieldType: "UInt32"},
        {name: "sendBufferSize", fieldType: "UInt32"},
        {name: "maxMessageSize", fieldType: "UInt32", documentation: "The maximum size for any request message."},
        {
            name: "maxChunkCount",
            fieldType: "UInt32",
            documentation: "The maximum number of chunks in any request message."
        }
    ]
});

interface AcknowledgeMessageOptions {
    protocolVersion?: UInt32;
    receiveBufferSize?: UInt32;
    sendBufferSize?: UInt32;
    maxMessageSize?: UInt32;
    maxChunkCount?: UInt32;
}
export class AcknowledgeMessage extends BaseUAObject {

    protocolVersion: UInt32;
    receiveBufferSize: UInt32;
    sendBufferSize: UInt32;
    maxMessageSize: UInt32;
    maxChunkCount: UInt32;

    constructor(options?: AcknowledgeMessageOptions) {

        options = options || {};

        super();
        const schema = schemaAcknowledgeMessage;
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }

        this.protocolVersion = initialize_field(schema.fields[0], options.protocolVersion);
        this.receiveBufferSize = initialize_field(schema.fields[1], options.receiveBufferSize);
        this.sendBufferSize = initialize_field(schema.fields[2], options.sendBufferSize);
        this.maxMessageSize = initialize_field(schema.fields[3], options.maxMessageSize);
        this.maxChunkCount = initialize_field(schema.fields[4], options.maxChunkCount);
    }

    encode(stream: BinaryStream): void {

        super.encode(stream);
        encodeUInt32(this.protocolVersion, stream);
        encodeUInt32(this.receiveBufferSize, stream);
        encodeUInt32(this.sendBufferSize, stream);
        encodeUInt32(this.maxMessageSize, stream);
        encodeUInt32(this.maxChunkCount, stream);
    }

    decode(stream: BinaryStream): void {
        // call base class implementation first
        super.decode(stream);
        this.protocolVersion = decodeUInt32(stream);
        this.receiveBufferSize = decodeUInt32(stream);
        this.sendBufferSize = decodeUInt32(stream);
        this.maxMessageSize = decodeUInt32(stream);
        this.maxChunkCount = decodeUInt32(stream);
    }

    static possibleFields: string[] = [
        "protocolVersion",
        "receiveBufferSize",
        "sendBufferSize",
        "maxMessageSize",
        "maxChunkCount"
    ];
    static schema = schemaAcknowledgeMessage;
}
