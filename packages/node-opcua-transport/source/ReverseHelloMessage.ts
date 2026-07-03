/**
 * @module node-opcua-transport
 */
import { decodeUAString, encodeUAString, type UAString } from "node-opcua-basic-types";
import { BinaryStream, type OutputBinaryStream } from "node-opcua-binary-stream";
import { readMessageHeader } from "node-opcua-chunkmanager";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    initialize_field,
    parameters
} from "node-opcua-factory";
import { StatusCodes2 } from "./status_codes";

/**
 * The maximum encoded length (in bytes) of the ServerUri and EndpointUrl fields.
 *
 * OPC UA Part 6 §7.1.2.6 (Table 77) mandates that a Client shall reject a
 * ReverseHello whose ServerUri or EndpointUrl exceeds 4096 bytes.
 */
export const MAXIMUM_REVERSE_HELLO_FIELD_LENGTH = 4096;

// OPC UA Part 6 §7.1.2.6 - ReverseHello Message
// For connection-based protocols such as TCP, the ReverseHello Message allows a Server
// behind a firewall with no open ports to connect to a Client and request that the Client
// establish a SecureChannel using the socket created by the Server.
const schemaReverseHelloMessage = buildStructuredType({
    name: "ReverseHelloMessage",

    baseType: "BaseUAObject",

    fields: [
        {
            name: "ServerUri",

            fieldType: "String",

            documentation: "The ApplicationUri of the Server which sent the Message."
        },
        {
            name: "EndpointUrl",

            fieldType: "String",

            documentation: "The URL of the Endpoint which the Client uses when establishing the SecureChannel."
        }
    ]
});

export interface ReverseHelloMessageOptions {
    serverUri?: UAString;
    endpointUrl?: UAString;
}

export class ReverseHelloMessage extends BaseUAObject {
    public static possibleFields: string[] = ["serverUri", "endpointUrl"];
    public serverUri: UAString;
    public endpointUrl: UAString;

    constructor(options?: ReverseHelloMessageOptions) {
        options = options || {};
        super();
        const schema = schemaReverseHelloMessage;
        /* c8 ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }

        this.serverUri = initialize_field(schema.fields[0], options.serverUri);
        this.endpointUrl = initialize_field(schema.fields[1], options.endpointUrl);
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeUAString(this.serverUri, stream);
        encodeUAString(this.endpointUrl, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        this.serverUri = decodeUAString(stream);
        this.endpointUrl = decodeUAString(stream);
    }

    public toString(): string {
        let str = "";
        str += `serverUri   = ${this.serverUri}\n`;
        str += `endpointUrl = ${this.endpointUrl}\n`;
        return str;
    }
}

/**
 * Build an Error tagged with a transport-level StatusCode so callers can turn it
 * into a TCPErrorMessage / decide how to react.
 */
function makeTaggedError(statusCode: (typeof StatusCodes2)[keyof typeof StatusCodes2], message: string): Error {
    const err = new Error(message);
    // biome-ignore lint/suspicious/noExplicitAny: diagnostic field, mirrors ClientTransportBase._handle_ACK_response
    (err as any).statusCode = statusCode;
    return err;
}

/**
 * Decode a ReverseHello ("RHE") message from a raw TCP message chunk.
 *
 * The chunk MUST be a single, final ("F") RHE frame:
 *   [ 'R' 'H' 'E' ] [ 'F' ] [ UInt32 messageSize ] [ ServerUri ] [ EndpointUrl ]
 *
 * This deliberately does NOT go through `tools.ts#decodeMessage`, whose
 * `is_valid_msg_type` allowlist / ERR special-casing does not apply to RHE, and
 * because the inbound `readMessageHeader` does not itself validate the 3-char
 * message type — so we assert it here.
 *
 * @throws an Error tagged with `.statusCode = BadTcp*` when the message is not a
 *         well-formed RHE or when either field exceeds the 4096-byte spec limit.
 */
export function decodeReverseHello(messageChunk: Buffer): ReverseHelloMessage {
    if (messageChunk.length < 8) {
        throw makeTaggedError(StatusCodes2.BadTcpMessageTypeInvalid, "ReverseHello: message too short");
    }
    const stream = new BinaryStream(messageChunk);
    const header = readMessageHeader(stream);
    if (header.msgType !== "RHE") {
        throw makeTaggedError(
            StatusCodes2.BadTcpMessageTypeInvalid,
            `ReverseHello: expecting message type 'RHE' but got '${header.msgType}'`
        );
    }
    if (header.isFinal !== "F") {
        throw makeTaggedError(StatusCodes2.BadTcpMessageTypeInvalid, `ReverseHello: expecting a final chunk but got '${header.isFinal}'`);
    }
    if (header.length !== messageChunk.length) {
        throw makeTaggedError(
            StatusCodes2.BadTcpMessageTooLarge,
            `ReverseHello: declared message size ${header.length} does not match buffer length ${messageChunk.length}`
        );
    }

    const reverseHello = new ReverseHelloMessage();
    try {
        reverseHello.decode(stream);
    } catch (err) {
        throw makeTaggedError(
            StatusCodes2.BadTcpEndpointUrlInvalid,
            `ReverseHello: failed to decode (malformed or truncated) : ${err instanceof Error ? err.message : err}`
        );
    }

    validateReverseHelloFields(reverseHello);
    return reverseHello;
}

/**
 * Validate that ServerUri / EndpointUrl are present and within the 4096-byte limit.
 * Used both on decode (client side) and before packing (server side) so we never
 * emit or accept an out-of-spec ReverseHello.
 *
 * @throws an Error tagged with `.statusCode = BadTcpEndpointUrlInvalid`
 */
export function validateReverseHelloFields(reverseHello: ReverseHelloMessage): void {
    const serverUriLength = Buffer.byteLength(reverseHello.serverUri || "", "utf-8");
    const endpointUrlLength = Buffer.byteLength(reverseHello.endpointUrl || "", "utf-8");
    if (serverUriLength > MAXIMUM_REVERSE_HELLO_FIELD_LENGTH) {
        throw makeTaggedError(
            StatusCodes2.BadTcpEndpointUrlInvalid,
            `ReverseHello: ServerUri exceeds ${MAXIMUM_REVERSE_HELLO_FIELD_LENGTH} bytes (${serverUriLength})`
        );
    }
    if (endpointUrlLength > MAXIMUM_REVERSE_HELLO_FIELD_LENGTH) {
        throw makeTaggedError(
            StatusCodes2.BadTcpEndpointUrlInvalid,
            `ReverseHello: EndpointUrl exceeds ${MAXIMUM_REVERSE_HELLO_FIELD_LENGTH} bytes (${endpointUrlLength})`
        );
    }
}
