var X509IdentityToken_Schema = {
    name:"X509IdentityToken",
    documentation: "A token representing a user identified by an X509 certificate.",
    fields: [
        // base type : UserIdentityToken
        { name: "policyId",                    fieldType:"String",     documentation:"The policy id specified in a user token policy for the endpoint being used."},
        //
        { name: "certificateData"            , fieldType:"ByteString", documentation:"The certificate."}
    ]
};
exports.X509IdentityToken_Schema = X509IdentityToken_Schema;