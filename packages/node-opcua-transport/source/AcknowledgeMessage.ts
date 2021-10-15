/**
 * @module node-opcua-transport
 */
import { decodeUInt32, encodeUInt32, UInt32 } from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    initialize_field,
    parameters,
    StructuredTypeSchema
} from "node-opcua-factory";

const schemaAcknowledgeMessage: StructuredTypeSchema = buildStructuredType({
    name: "AcknowledgeMessage",

    baseType: "BaseObjectType",

    fields: [
        {
            name: "protocolVersion",

            fieldType: "UInt32",

            documentation: "The latest version of the OPC UA TCP protocol supported by the Server."
        },
        { name: "receiveBufferSize", fieldType: "UInt32" },
        { name: "sendBufferSize", fieldType: "UInt32" },
        { name: "maxMessageSize", fieldType: "UInt32", documentation: "The maximum size for any request message." },
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
    public static possibleFields: string[] = [
        "protocolVersion",
        "receiveBufferSize",
        "sendBufferSize",
        "maxMessageSize",
        "maxChunkCount"
    ];
    public static schema = schemaAcknowledgeMessage;

    public protocolVersion: UInt32;
    public receiveBufferSize: UInt32;
    public sendBufferSize: UInt32;
    public maxMessageSize: UInt32;
    public maxChunkCount: UInt32;

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

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeUInt32(this.protocolVersion, stream);
        encodeUInt32(this.receiveBufferSize, stream);
        encodeUInt32(this.sendBufferSize, stream);
        encodeUInt32(this.maxMessageSize, stream);
        encodeUInt32(this.maxChunkCount, stream);
    }

    public decode(stream: BinaryStream): void {
        // call base class implementation first
        super.decode(stream);
        this.protocolVersion = decodeUInt32(stream);
        this.receiveBufferSize = decodeUInt32(stream);
        this.sendBufferSize = decodeUInt32(stream);
        this.maxMessageSize = decodeUInt32(stream);
        this.maxChunkCount = decodeUInt32(stream);
    }

    public toString(): string {
        let str = "";
        str += "protocolVersion   = " + this.protocolVersion + "\n";
        str += "receiveBufferSize = " + this.receiveBufferSize + "\n";
        str += "sendBufferSize    = " + this.sendBufferSize + "\n";
        str += "maxMessageSize    = " + this.maxMessageSize + "\n";
        str += "maxChunkCount     = " + this.maxChunkCount + "\n";
        return str;
    }
}
