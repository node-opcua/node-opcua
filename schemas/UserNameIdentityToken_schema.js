
var UserNameIdentityToken_Schema = {
    name:"UserNameIdentityToken",
    documentation: "A token representing a user identified by a user name and password",
    fields: [
        // base type : UserIdentityToken
        { name: "policyId",             fieldType:"String", documentation:"The policy id specified in a user token policy for the endpoint being used."},
        //
        { name: "userName"            , fieldType:"String" ,    documentation:"The user name"},
        { name: "password"            , fieldType:"ByteString", documentation:"The password encrypted with the server certificate."},
        { name: "encryptionAlgorithm" , fieldType:"String" ,    documentation:"The algorithm used to encrypt the password."}
    ]
};
exports.UserNameIdentityToken_Schema = UserNameIdentityToken_Schema;