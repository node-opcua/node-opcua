"use strict";

require("requirish")._(module);
var factories = require("lib/misc/factories");

// OPC Unified Architecture, Part 4 page 106
var ApplicationInstanceCertificate_Schema = {
    // ApplicationInstanceCertificate with signature created by a Certificate Authority
    name: "ApplicationInstanceCertificate",
    id: factories.next_available_id(),

    fields: [
        // An identifier for the version of the Certificate encoding.
        { name: "version", fieldType: "String" },

        // A unique identifier for the Certificate assigned by the Issuer.
        { name: "serialNumber", fieldType: "ByteString" },

        // The algorithm used to sign the Certificate .
        // The syntax of this field depends on the Certificate encoding.
        { name: "signatureAlgorithm", fieldType: "String" },

        // The signature created by the Issuer.
        { name: "signature", fieldType: "ByteString" },

        // A name that identifies the Issuer Certificate used to create the signature.
        { name: "issuer", fieldType: "String" },

        // When the Certificate becomes valid.
        { name: "validFrom", fieldType: "UtcTime" },

        // When the Certificate expires.
        { name: "validTo", fieldType: "UtcTime" },

        // A name that identifies the application instance that the Certificate describes.
        // This field shall contain the productName and the name of the organization
        // responsible for the application instance.
        { name: "subject", fieldType: "String" },

        // The applicationUri specified in the ApplicationDescription .
        // The ApplicationDescription is described in 7.1.
        { name: "applicationUri", fieldType: "String" },

        // The name of the machine where the application instance runs.
        // A machine may have multiple names if is accessible via multiple networks.
        // The hostname may be a numeric network address or a descriptive name.
        // Server Certificates shall have at least one hostname defined.
        { name: "hostnames", isArray: true, fieldType: "String" },


        // The public key associated with the Certificate .
        { name: "publicKey", fieldType: "ByteString" },

        // Specifies how the Certificate key may be used.
        // ApplicationInstanceCertificates shall support Digital Signature, Non-Repudiation
        // Key Encryption, Data Encryption and Client/Server Authorization.
        // The contents of this field depend on the Certificate enco
        { name: "keyUsage", fieldType: "String" }

    ]
};
exports.ApplicationInstanceCertificate_Schema = ApplicationInstanceCertificate_Schema;
