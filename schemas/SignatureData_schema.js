// Node-opcua raised a issue in mantis => issue 2895
// BUG: the specification 1.02 says in part 4 $7.30
//   SignatureData  is "signature" + "algorithm"
//   however the schema file specifies:   "algorithm" + "signature" , Schema file is correct
var SignatureData_Schema = {
    name: "SignatureData",
    fields: [
        { name: "algorithm", fieldType: "String", defaultValue: null, documentation: "The cryptography algorithm used to create the signature." },
        { name: "signature", fieldType: "ByteString", defaultValue: null, documentation: "The digital signature."}
    ]
};
exports.SignatureData_Schema =SignatureData_Schema;