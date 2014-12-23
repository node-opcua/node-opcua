
//---------------------------------------------------------
// extension objects
//---------------------------------------------------------
var UserIdentityToken_Schema = {
    name:"UserIdentityToken",
    documentation: "A base type for a user identity token.",
    fields: [
        { name: "policyId", fieldType:"String", documentation:"The policy id specified in a user token policy for the endpoint being used."}
    ]
};

var AnonymousIdentityToken_Schema = {
    name:"AnonymousIdentityToken",
    documentation: "A token representing an anonymous user.",
    fields: [
        // base type : UserIdentityToken
        { name: "policyId",             fieldType:"String", documentation:"The policy id specified in a user token policy for the endpoint being used."}
    ]
};
exports.AnonymousIdentityToken_Schema = AnonymousIdentityToken_Schema;