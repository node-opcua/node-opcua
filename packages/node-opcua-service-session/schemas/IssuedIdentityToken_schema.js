var IssuedIdentityToken_Schema = {
    name:"IssuedIdentityToken",
    documentation: "A token representing a user identified by a WS-Security XML token.",
    fields: [
        // base type : UserIdentityToken
        { name: "policyId",              fieldType:"String",     documentation:"The policy id specified in a user token policy for the endpoint being used."},
        //
        { name: "tokenData"            , fieldType:"ByteString", documentation:"The XML token encrypted with the server certificate."},
        { name: "encryptionAlgorithm"  , fieldType:"String",     documentation:"The algorithm used to encrypt the password."}
    ]
};
exports.IssuedIdentityToken_Schema = IssuedIdentityToken_Schema;