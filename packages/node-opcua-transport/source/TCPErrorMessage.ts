/**
 * @module node-opcua-transport
 */
import { decodeString, encodeString, UAString } from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    initialize_field,
    parameters
} from "node-opcua-factory";
import { decodeStatusCode, encodeStatusCode, StatusCode } from "node-opcua-status-code";

// TCP Error Message  OPC Unified Architecture, Part 6 page 46
// the server always close the connection after sending the TCPError message
const schemaTCPErrorMessage = buildStructuredType({
    name: "TCPErrorMessage",

    baseType: "BaseUAObject",

    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "reason", fieldType: "String" } // A more verbose description of the error.
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
        /* istanbul ignore next */
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
