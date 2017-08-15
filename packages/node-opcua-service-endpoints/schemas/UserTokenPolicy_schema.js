
var UserIdentityTokenType =require("./UserIdentityTokenType_enum").UserIdentityTokenType;

/*
 Release 1.02 38 OPC Unified Architecture, Part 7
//User Token profiles
    http://opcfoundation.org/UA-Profile/ Security/UserToken-Server/UserNamePassword
    http://opcfoundation.org/UA-Profile/Security/UserToken-Server/X509Certificate
    http://opcfoundation.org/UA-Profile/Security/UserToken-Server/IssuedToken
    http://opcfoundation.org/UA-Profile/Security/UserToken-Server/IssuedTokenWindows

    http://opcfoundation.org/UA-Profile/Security/UserToken-Client/UserNamePassword
    http://opcfoundation.org/UA-Profile/Security/UserToken-Client/X509Certificate
    http://opcfoundation.org/UA-Profile/Security/UserToken-Client/IssuedToken
    http://opcfoundation.org/UA-Profile/Security/UserToken-Client/IssuedTokenWindows
*/

// OPC Unified Architecture, Part 4 $7.36 page 160
var UserTokenPolicy_Schema = {
    name: "UserTokenPolicy",
    fields: [
        // An identifier for the UserTokenPolicy assigned by the Server.
        // The Client specifies this value when it constructs a UserIdentityToken that
        // conforms to the policy.
        // This value is only unique within the context of a single Server.
        { name: "policyId", fieldType: "String"                   },
        { name: "tokenType", fieldType: "EnumUserIdentityTokenType"},

        // This field may only be specified if TokenType is ISSUEDTOKEN.
        // A URI for the type of token. Part 7 defines URIs for supported token types.
        { name: "issuedTokenType", fieldType: "String", defaultValue: null  },

        // A optional URL for the token issuing service.
        { name: "issuerEndpointUrl", fieldType: "String", defaultValue: null  },

        // The security policy to use when encrypting or signing the UserToken when it is
        // passed to the Server in the ActivateSession request. see $7.35
        //
        // Release 1.02 155 OPC Unified Architecture, Part 4
        // (If this SecurityPolicy is omitted then the Client uses the SecurityPolicy in the
        // EndpointDescription.)
        { name: "securityPolicyUri", fieldType: "String", defaultValue: null  }
    ]
};
exports.UserTokenPolicy_Schema = UserTokenPolicy_Schema;
