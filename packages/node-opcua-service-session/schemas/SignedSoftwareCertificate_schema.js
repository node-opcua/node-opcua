
var SignedSoftwareCertificate_Schema = {
    name: "SignedSoftwareCertificate",
    fields: [
        { name: "certificateData", fieldType: "ByteString", documentation: "The data of the certificate." },
        { name: "signature", fieldType: "ByteString", documentation: "The digital signature."}
    ]
};
exports.SignedSoftwareCertificate_Schema =SignedSoftwareCertificate_Schema;
