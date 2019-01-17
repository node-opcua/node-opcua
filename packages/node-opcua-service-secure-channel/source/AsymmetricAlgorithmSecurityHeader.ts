/**
 * @module node-opcua-service-secure-channel
 */
// OPC UA Secure Conversation Message Header : Part 6 page 36
// Asymmetric algorithms are used to secure the OpenSecureChannel messages.
import {
    ByteString,
    decodeByteString,
    decodeString,
    encodeByteString,
    encodeString,
    UAString
} from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType, check_options_correctness_against_schema,
    initialize_field, parameters, StructuredTypeSchema
} from "node-opcua-factory";

const schemaAsymmetricAlgorithmSecurityHeader: StructuredTypeSchema = buildStructuredType({
    name: "AsymmetricAlgorithmSecurityHeader",

    baseType: "BaseUAObject",

    fields: [
        // length shall not exceed 256
        // The URI of the security policy used to secure the message.
        // This field is encoded as a UTF8 string without a null terminator
        { name: "securityPolicyUri", fieldType: "String" },

        // The X509v3 certificate assigned to the sending application instance.
        // This is a DER encoded blob.
        // This indicates what private key was used to sign the MessageChunk.
        // This field shall be null if the message is not signed.
        // The structure of an X509 Certificate is defined in X509.
        // The DER format for a Certificate is defined in X690
        // The Stack shall close the channel and report an error to the Application if the SenderCertificate
        // is too large for the buffer size supported by the transport layer.
        // If the Certificate is signed by a CA the DER encoded CA Certificate may be appended after the Certificate
        // in the byte array. If the CA Certificate is also signed by another CA this process is repeated until
        // the entire Certificate chain is in the buffer or if MaxSenderCertificateSize limit is reached
        // (the process stops after the last whole Certificate that can be added without exceeding the
        // MaxSenderCertificateSize limit).
        // Receivers can extract the Certificates from the byte array by using the Certificate size contained
        // in DER header (see X509).
        // Receivers that do not handle Certificate chains shall ignore the extra bytes.
        { name: "senderCertificate", fieldType: "ByteString", defaultValue: null },

        // The thumbprint of the X509v3 certificate assigned to the receiving application
        // The thumbprint is the SHA1 digest of the DER encoded form of the certificate.
        // This indicates what public key was used to encrypt the MessageChunk
        // This field shall be null if the message is not encrypted.
        { name: "receiverCertificateThumbprint", fieldType: "ByteString", defaultValue: null }
    ]
});

export class AsymmetricAlgorithmSecurityHeader extends BaseUAObject {

    public static possibleFields: string[] = [
      "securityPolicyUri",
        "senderCertificate",
        "receiverCertificateThumbprint"
    ];
    public static schema = schemaAsymmetricAlgorithmSecurityHeader;
    public securityPolicyUri: UAString;
    public senderCertificate: ByteString;
    public receiverCertificateThumbprint: ByteString;

    constructor(options?: any) {
        options = options || {};
        super();
        const schema = schemaAsymmetricAlgorithmSecurityHeader;
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }
        this.securityPolicyUri = initialize_field(schema.fields[0], options.securityPolicyUri);
        this.senderCertificate = initialize_field(schema.fields[1], options.senderCertificate);
        this.receiverCertificateThumbprint = initialize_field(schema.fields[2], options.receiverCertificateThumbprint);
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeString(this.securityPolicyUri, stream);
        encodeByteString(this.senderCertificate, stream);
        encodeByteString(this.receiverCertificateThumbprint, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        this.securityPolicyUri = decodeString(stream);
        this.senderCertificate = decodeByteString(stream);
        this.receiverCertificateThumbprint = decodeByteString(stream);
    }
}

AsymmetricAlgorithmSecurityHeader.prototype.schema = AsymmetricAlgorithmSecurityHeader.schema;
