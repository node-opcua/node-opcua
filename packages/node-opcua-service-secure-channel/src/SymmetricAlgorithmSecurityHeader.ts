// Symmetric algorithms are used to secure all messages other than the OpenSecureChannel messages
// OPC UA Secure Conversation Message Header Release 1.02 Part 6 page 39
import {
    buildStructuredType,
    BaseUAObject,
    initialize_field, StructuredTypeSchema
} from "node-opcua-factory";
import { BinaryStream } from "node-opcua-binary-stream";
import { encodeUInt32, UInt32, decodeUInt32 } from "node-opcua-basic-types";

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
    tokenId: UInt32;

    constructor(options?: any) {
        options = options || {};
        super();

        const schema = schemaSymmetricAlgorithmSecurityHeader;

        this.tokenId = initialize_field(schema.fields[0], options.tokenId);
    }

    encode(stream: BinaryStream): void {
        // call base class implementation first
        super.encode(stream);
        encodeUInt32(this.tokenId, stream);
    }

    decode(stream: BinaryStream): void {
        // call base class implementation first
        super.decode(stream);
        this.tokenId = decodeUInt32(stream);
    }

    static possibleFields: string[] = ["tokenId"];

    static schema = schemaSymmetricAlgorithmSecurityHeader;
}

SymmetricAlgorithmSecurityHeader.prototype.schema = SymmetricAlgorithmSecurityHeader.schema;

