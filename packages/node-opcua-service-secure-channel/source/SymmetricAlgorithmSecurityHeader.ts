/**
 * @module node-opcua-service-secure-channel
 */
// Symmetric algorithms are used to secure all messages other than the OpenSecureChannel messages
// OPC UA Secure Conversation Message Header Release 1.02 Part 6 page 39
import { decodeUInt32, encodeUInt32, UInt32 } from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    initialize_field, StructuredTypeSchema
} from "node-opcua-factory";

const schemaSymmetricAlgorithmSecurityHeader: StructuredTypeSchema = buildStructuredType({
    name: "SymmetricAlgorithmSecurityHeader",

    baseType: "BaseUAObject",

    fields: [
        // A unique identifier for the ClientSecureChannelLayer token used to secure the message
        // This identifier is returned by the server in an OpenSecureChannel response message. If a
        // Server receives a TokenId which it does not recognize it shall return an appropriate
        // transport layer error.
        {name: "tokenId", fieldType: "UInt32", defaultValue: 0xDEADBEEF}
    ]
});

export class SymmetricAlgorithmSecurityHeader extends BaseUAObject {

    public static possibleFields: string[] = ["tokenId"];

    public static schema = schemaSymmetricAlgorithmSecurityHeader;
    public tokenId: UInt32;

    constructor(options?: any) {
        options = options || {};
        super();

        const schema = schemaSymmetricAlgorithmSecurityHeader;

        this.tokenId = initialize_field(schema.fields[0], options.tokenId);
    }

    public encode(stream: OutputBinaryStream): void {
        // call base class implementation first
        super.encode(stream);
        encodeUInt32(this.tokenId, stream);
    }

    public decode(stream: BinaryStream): void {
        // call base class implementation first
        super.decode(stream);
        this.tokenId = decodeUInt32(stream);
    }
}

SymmetricAlgorithmSecurityHeader.prototype.schema = SymmetricAlgorithmSecurityHeader.schema;
