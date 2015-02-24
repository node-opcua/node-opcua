
var UserNameIdentityToken_Schema = {
    name:"UserNameIdentityToken",
    documentation: "A token representing a user identified by a user name and password",
    fields: [
        // base type : UserIdentityToken
        { name: "policyId",             fieldType:"String", documentation:"The policy id specified in a user token policy for the endpoint being used."},
        //
        { name: "userName"            , fieldType:"String" ,    documentation:"The user name"},

        // The password for the user. The password can be an empty string.
        // This parameter shall be encrypted with the Server‟s Certificate using the algorithm
        // specified by the SecurityPolicy.
        { name: "password"            , fieldType:"ByteString", documentation:"The password encrypted with the server certificate."},

        // The URI string values are defined names that may be used as part of the security profiles specified in Part 7.
        // This parameter is null if the password is not encrypted.
        // encryptionAlgorithm String A string containing the URI of the AsymmetricEncryptionAlgorithm.
        { name: "encryptionAlgorithm" , fieldType:"String" ,    documentation:"The algorithm used to encrypt the password."}
    ]
};
exports.UserNameIdentityToken_Schema = UserNameIdentityToken_Schema;