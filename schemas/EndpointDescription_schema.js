var MessageSecurityMode = require("./MessageSecurityMode_enum").MessageSecurityMode;

// OPC Unified Architecture, Part 4 page 121
var EndpointDescription_Schema = {
    name: "EndpointDescription",
    fields: [
        // The URL for the Endpoint described.
        { name: "endpointUrl", fieldType: "String"       },

        // The description for the Server that the Endpoint belongs to. ( see part 4 - $7.1)
        { name: "server", fieldType: "ApplicationDescription"},

        // The application instance Certificate issued to the Server .
        //xx  { name: "serverCertificate",             fieldType: "ApplicationInstanceCertificate"  },
        { name: "serverCertificate", fieldType: "ByteString"  },

        // The type of security to apply to the messages. ( see part 4 - $7.14.)
        { name: "securityMode", fieldType: "MessageSecurityMode"},

        // The URI for SecurityPolicy to use when securing messages.
        // The set of known URIs and the SecurityPolicies associated with them are defined in Part 7.
        { name: "securityPolicyUri", fieldType: "String"},

        // The user identity tokens that the Server will accept. ( see part 4 - $7.36)
        //   The Client shall pass one of the UserIdentityTokens in the ActivateSession request.
        { name: "userIdentityTokens", isArray: true, fieldType: "UserTokenPolicy"},

        // The URI of the Transport Profile supported by the Endpoint . ( see part 7)
        { name: "transportProfileUri", fieldType: "String"},

        // A numeric value that indicates how secure the EndpointDescription
        // is compared to other EndpointDescriptions for the same Server.
        // A value of 0 indicates that the EndpointDescription is not
        // recommended and is only supported for backward compatibility.
        { name: "securityLevel", fieldType: "Byte"}
    ]
};

exports.EndpointDescription_Schema = EndpointDescription_Schema;