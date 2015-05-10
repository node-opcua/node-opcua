"use strict";

require("requirish")._(module);
var ExtensionObject = require("lib/misc/extension_object").ExtensionObject;

var ActivateSessionRequest_Schema =  {
    documentation: "Activates a session with the server.",
    name: "ActivateSessionRequest",
    fields: [
        { name:"requestHeader",                            fieldType:"RequestHeader",               documentation:"A standard header included in all requests sent to a server." },
        { name:"clientSignature",                          fieldType:"SignatureData",               documentation:"A signature created with the client certificate from the last server nonce returned by the server." },
        { name:"clientSoftwareCertificates", isArray:true, fieldType:"SignedSoftwareCertificate",   documentation:"The software certificates owned by the client." },
        { name:"localeIds",                  isArray:true, fieldType:"LocaleId",                    documentation:"The locales to use with the session." },
        { name:"userIdentityToken",                        fieldType:"ExtensionObject",             documentation:"The user identity to use with the session."},
        { name:"userTokenSignature",                       fieldType:"SignatureData",               documentation:"A digital signature created with the user identity token."}

    ]
};
exports.ActivateSessionRequest_Schema = ActivateSessionRequest_Schema;