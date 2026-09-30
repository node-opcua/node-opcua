/**
 * @module node-opcua-transport
 */
import { decodeString, encodeString, type UAString } from "node-opcua-basic-types";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    initialize_field,
    parameters
} from "node-opcua-factory";
import { decodeStatusCode, encodeStatusCode, type StatusCode } from "node-opcua-status-code";

// TCP Error Message  OPC Unified Architecture, Part 6 page 46
// the server always close the connection after sending the TCPError message
const schemaTCPErrorMessage = buildStructuredType({
    name: "TCPErrorMessage",

    baseType: "BaseUAObject",

    fields: [
        { name: "StatusCode", fieldType: "StatusCode" },
        { name: "Reason", fieldType: "String" } // A more verbose description of the error.
    ]
});

export class TCPErrorMessage extends BaseUAObject {
    public static possibleFields: string[] = ["statusCode", "reason"];
    public statusCode: StatusCode;
    public reason: UAString;
    constructor(options?: { statusCode?: StatusCode; reason?: string }) {
        options = options || {};
        const schema = schemaTCPErrorMessage;

        super();
        /* c8 ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }
        this.statusCode = initialize_field(schema.fields[0], options.statusCode);
        this.reason = initialize_field(schema.fields[1], options.reason);
    }

    public encode(stream: OutputBinaryStream): void {
        // call base class implementation first
        super.encode(stream);
        encodeStatusCode(this.statusCode, stream);
        encodeString(this.reason, stream);
    }

    public decode(stream: BinaryStream): void {
        // call base class implementation first
        super.decode(stream);
        this.statusCode = decodeStatusCode(stream);
        this.reason = decodeString(stream);
    }
}

/**
 * the error an Error Message (ERR) received from the peer is reported with.
 * A Client that receives an Error Message reports it to the application
 * (OPC 10000-6 §7.1.5): the StatusCode and Reason stay available here.
 */
export class TCPErrorMessageReceivedError extends Error {
    public readonly statusCode: StatusCode;
    public readonly reason: UAString;
    constructor(statusCode: StatusCode, reason: UAString) {
        super(`ERR received ${statusCode.toString()} : ${reason || "no reason given"}`);
        this.name = "TCPErrorMessageReceivedError";
        this.statusCode = statusCode;
        this.reason = reason;
    }
}
