
//---------------------------------------------------------
// extension objects
//---------------------------------------------------------
const UserIdentityToken_Schema = {
    name:"UserIdentityToken",
    documentation: "A base type for a user identity token.",
    fields: [
        { name: "policyId", fieldType:"String", documentation:"The policy id specified in a user token policy for the endpoint being used."}
    ]
};

const AnonymousIdentityToken_Schema = {
    name:"AnonymousIdentityToken",
    documentation: "A token representing an anonymous user.",
    fields: [
        // base type : UserIdentityToken
        { name: "policyId",             fieldType:"String", documentation:"The policy id specified in a user token policy for the endpoint being used."}
    ]
};
exports.AnonymousIdentityToken_Schema = AnonymousIdentityToken_Schema;