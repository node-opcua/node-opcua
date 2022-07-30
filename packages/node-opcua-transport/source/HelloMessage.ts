/**
 * @module node-opcua-transport
 */
import { decodeUAString, decodeUInt32, encodeUAString, encodeUInt32, UAString, UInt32 } from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    initialize_field,
    parameters,
    StructuredTypeSchema
} from "node-opcua-factory";

const schemaHelloMessage: StructuredTypeSchema = buildStructuredType({
    name: "HelloMessage",

    baseType: "BaseUAObject",

    fields: [
        {
            name: "protocolVersion",

            fieldType: "UInt32",

            documentation: "The latest version of the OPC UA TCP protocol supported by the Client"
        },
        {
            name: "receiveBufferSize",

            fieldType: "UInt32",

            documentation: "The largest message that the sender can receive."
        },
        {
            name: "sendBufferSize",

            fieldType: "UInt32",

            documentation: "The largest message that the sender will send."
        },
        { name: "maxMessageSize", fieldType: "UInt32", documentation: "The maximum size for any response message." },
        {
            name: "maxChunkCount",

            fieldType: "UInt32",

            documentation: "The maximum number of chunks in any response message"
        },
        {
            name: "endpointUrl",

            fieldType: "String",

            documentation: "The URL of the Endpoint which the Client wished to connect to."
        }
    ]
});

export interface HelloMessageOptions {
    protocolVersion?: UInt32;
    receiveBufferSize?: UInt32;
    sendBufferSize?: UInt32;
    maxMessageSize?: UInt32;
    maxChunkCount?: UInt32;
    endpointUrl?: UAString;
}

export class HelloMessage extends BaseUAObject {
    public static possibleFields: string[] = [
        "protocolVersion",
        "receiveBufferSize",
        "sendBufferSize",
        "maxMessageSize",
        "maxChunkCount",
        "endpointUrl"
    ];
    public protocolVersion: UInt32;
    public receiveBufferSize: UInt32;
    public sendBufferSize: UInt32;
    public maxMessageSize: UInt32;
    public maxChunkCount: UInt32;
    public endpointUrl: UAString;

    constructor(options?: HelloMessageOptions) {
        options = options || {};
        super();
        const schema = schemaHelloMessage;
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }

        this.protocolVersion = initialize_field(schema.fields[0], options.protocolVersion);
        this.receiveBufferSize = initialize_field(schema.fields[1], options.receiveBufferSize);
        this.sendBufferSize = initialize_field(schema.fields[2], options.sendBufferSize);
        this.maxMessageSize = initialize_field(schema.fields[3], options.maxMessageSize);
        this.maxChunkCount = initialize_field(schema.fields[4], options.maxChunkCount);
        this.endpointUrl = initialize_field(schema.fields[5], options.endpointUrl);
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeUInt32(this.protocolVersion, stream);
        encodeUInt32(this.receiveBufferSize, stream);
        encodeUInt32(this.sendBufferSize, stream);
        encodeUInt32(this.maxMessageSize, stream);
        encodeUInt32(this.maxChunkCount, stream);
        encodeUAString(this.endpointUrl, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        this.protocolVersion = decodeUInt32(stream);
        this.receiveBufferSize = decodeUInt32(stream);
        this.sendBufferSize = decodeUInt32(stream);
        this.maxMessageSize = decodeUInt32(stream);
        this.maxChunkCount = decodeUInt32(stream);
        this.endpointUrl = decodeUAString(stream);
    }
    public toString(): string {
        let str = "";
        str += "protocolVersion   = " + this.protocolVersion + "\n";
        str += "receiveBufferSize = " + this.receiveBufferSize + "\n";
        str += "sendBufferSize    = " + this.sendBufferSize + "\n";
        str += "maxMessageSize    = " + this.maxMessageSize + "\n";
        str += "maxChunkCount     = " + this.maxChunkCount + "\n";
        str += "endpointUrl       = " + this.endpointUrl + "\n";
        return str;
    }
}
