var factories = require("./factories");
var ec = require("./encode_decode");

//The StatusCode is a 32-bit unsigned integer. The top 16 bits represent the numeric value of the
//code that shall be used for detecting specific errors or conditions. The bottom 16 bits are bit flags
//that contain additional information but do not affect the meaning of the StatusCode.
factories.UAObjectFactoryBuild({name:"StatusCode",subtype:"UInt32"}); // 7.33 Part 4 - P 143


factories.UAObjectFactoryBuild({name:"String"    ,subtype:"UAString"});


// see Part 3 $8.3 and Part 6 $5.2.213
var QualifiedName_Description = {
    name: "QualifiedName",
    fields: [
        { name: "namespaceIndex", fieldType: "UInt16" , comment: "The namespace index" },
        { name: "name",           fieldType: "String" , comment: "The name"            }
    ]
};
exports.QualifiedName = factories.UAObjectFactoryBuild(QualifiedName_Description);


// see Part 3 - $8.5 page 63
var LocalizedText_Description = {
    name: "LocalizedText",
    fields: [
        { name: "text", fieldType: "String" },
        { name: "locale", fieldType: "LocaleId" }
    ],

    // OPCUA Part 6 $ 5.2.2.14 : localizedText have a special encoding
    encode: function(localizeText,stream) {
        encoding_mask= 0
        if (localizeText.text) {
            encoding_mask +=1;
        }
        if (localizeText.locale) {
            encoding_mask +=2;
        }
        ec.encodeByte(encoding_mask,stream);
        if (localizeText.text) {
            ec.encodeUAString(localizeText.text,stream);
        }
        if (localizeText.locale) {
            ec.encodeUAString(localizeText.locale,stream);
        }
    },
    decode: function(self,stream) {
        encoding_mask = ec.decodeByte(stream);
        if ( ( encoding_mask & 0x01) == 0x01 )  {
            self.text = ec.decodeUAString(stream);
        } else {
            self.text = null;
        }
        if ( ( encoding_mask & 0x02) === 0x02)  {
            self.locale = ec.decodeUAString(stream);
        }else {
            self.locale = null;
        }
    }
};
exports.LocalizedText = factories.UAObjectFactoryBuild(LocalizedText_Description);


var ExtensibleParameter_Description = {
    name: "ExtensibleParameter",
    // The extensible parameter types can only be extended by additional parts of this multi-part
    // specification.
    // The ExtensibleParameter defines a data structure with two elements. The parameterTypeId
    // specifies the data type encoding of the second element. Therefore the second element is specified
    // as “--“. The ExtensibleParameter base type is defined in Table 126.
    // Concrete extensible parameters that are common to OPC UA are defined in Clause 7. Additional
    // parts of this multi-part specification can define additional extensible parameter types.
    fields: [
        { name: "parameterTypeId", fieldType: "NodeId" }
        // TODO: { name: "data"}
    ]
};
factories.UAObjectFactoryBuild(ExtensibleParameter_Description);


var ExtensibleParameterAdditionalHeader_Description = {
    name: "ExtensibleParameterAdditionalHeader",
    fields: [
        { name: "parameterTypeId", fieldType: "NodeId" }
        // TODO: { name: "data"}
    ]
};
factories.UAObjectFactoryBuild(ExtensibleParameterAdditionalHeader_Description);


// OPC Unified Architecture, Part 4  $7.29 page 139
var SessionAuthenticationToken_Description = {
  name: "SessionAuthenticationToken",
  subtype: "NodeId"
};
factories.UAObjectFactoryBuild(SessionAuthenticationToken_Description);


// OPC Unified Architecture, Part 4  $7.27 page 139
var RequestHeader_Description = {
    name: "RequestHeader",
    fields: [

        // The secret Session identifier used to verify that the request is associated with
        // the Session. The SessionAuthenticationToken type is defined in 7.29.
        { name: "authenticationToken", fieldType: "SessionAuthenticationToken" },

        // The time the Client sent the request.
        { name: "timeStamp",           fieldType: "UtcTime"  , defaultValue: function () { return new Date() }  },

        // A requestHandle associated with the request. This client defined handle can
        // be used to cancel the request. It is also returned in the response.
        { name: "requestHandle",       fieldType: "IntegerId"                  },

        // A bit mask that identifies the types of vendor-specific diagnostics to be
        // returned in diagnosticInfo response parameters.
        { name: "returnDiagnostics",   fieldType: "UInt32"                     },

        // An identifier that identifies the Client ’s security audit log entry associated with
        // this request.
        { name: "auditEntryId",        fieldType: "UAString"                   },

        { name: "timeoutHint",         fieldType: "UInt32"                    },

        // Reserved for future use.
        { name: "additionalHeader",    fieldType: "ExtensibleParameterAdditionalHeader" }
    ]
};


exports.RequestHeader = factories.UAObjectFactoryBuild(RequestHeader_Description);

// OPC Unified Architecture, Part 4  $7.27 page 139
var ResponseHeader_Description = {
    name: "ResponseHeader",
    fields: [
        // The time the Server sent the response.
        { name: "timeStamp",           fieldType: "UtcTime"                    },

        // The requestHandle given by the Client to the request.
        { name: "requestHandle",       fieldType: "IntegerId"                  },

        // OPC UA-defined result of the Service invocation.
        { name: "serviceResult",       fieldType:"StatusCode"                 },

        // There is one string in this list for each unique namespace, symbolic identifier,
        // and localized text string contained in all of the diagnostics information
        // parameters contained in the response (see 7.8). Each is identified within this
        // table by its zero-based index.
        { name: "stringTable",     isArray: true,     fieldType: 'String'                     },

        // Reserved for future use.
        { name: "additionalHeader",    fieldType: "ExtensibleParameterAdditionalHeader" }

    ]
};


exports.ResponseHeader = factories.UAObjectFactoryBuild(ResponseHeader_Description);



// OPC Unified Architecture, Part 4 page 16
var GetEndpointsRequest_Description= {
    name: "GetEndpointsRequest",
    fields: [
        { name: "requestHeader",     fieldType: "RequestHeader"                  },

        // The network address that the Client used to access the Discovery Endpoint .
        // The Server uses this information for diagnostics and to determine what
        // URLs to return in the response.
        // The Server should return a suitable default URL if it does not recognize
        // the HostName in the URL.
        { name: "endpointUrl",       fieldType: "String"                         },

        // List of locales to use.
        // Specifies the locale to use when returning human readable strings.
        { name: "localeIds" , isArray: true, fieldType: "LocaleId"               },

        // List of transport profiles that the returned Endpoints shall support.
        { name: "profileUris" , isArray: true, fieldType: "String"               },

    ]
};

exports.GetEndpointsRequest = factories.UAObjectFactoryBuild(GetEndpointsRequest_Description);


// see part 4 $7.14
var EnumMessageSecurityMode_Description = {
    name: "EnumMessageSecurityMode",
    isEnum: true,
    enumValues: {
        INVALID:        0, // The MessageSecurityMode is invalid
        NONE:           1, // No security is applied.
        SIGN:           2, // All messages are signed but not encrypted.
        SIGNANDENCRYPT: 3  // All messages are signed and encrypted.
    }
};
exports.MessageSecurityMode = factories.UAObjectFactoryBuild(EnumMessageSecurityMode_Description);

// OPC Unified Architecture, Part 4 $7.36 page 160
// This value is an enumeration with one of the following values:
//  ANONYMOUS_0     No token is required.
//  USERNAME_1      A username/password token.
//  CERTIFICATE_2   An X509v3 certificate token.
//  ISSUEDTOKEN_3    Any WS-Security defined token.
//  A tokenType of ANONYMOUS indicates that the Server does not require any
//  user identification. In this case the Client application instance Certificate is used
//  as the user identification.
var EnumUserIdentityTokenType_Description = {
    name: "EnumUserIdentityTokenType",
    isEnum: true,
    enumValues: {
        ANONYMOUS:   0,
        USERNAME:    1,
        CERTIFICATE: 2,
        ISSUEDTOKEN: 3
    }
};

exports.UserIdentityTokenType = factories.UAObjectFactoryBuild(EnumUserIdentityTokenType_Description);



var EnumApplicationType_Description = {
    name: "EnumApplicationType",
    isEnum: true,
    enumValues: {
        SERVER:          0, // The application is a Server
        CLIENT:          1, // The application is a Client
        CLIENTANDSERVER: 2, // The application is a Client and a Server
        DISCOVERYSERVER: 3  // The application is a DiscoveryServer
    }
};
exports.ApplicationType = factories.UAObjectFactoryBuild(EnumApplicationType_Description);

// OPC Unified Architecture, Part 4 $7.1 page 106
var ApplicationDescription_Description = {
    name: "ApplicationDescription",
    fields: [
        // The globally unique identifier for the application instance.
        { name: "applicationUri",                   fieldType: "String"             },

        // The globally unique identifier for the product.
        { name: "productUri",                      fieldType: "String"              },
        // A localized descriptive name for the application.
        { name: "applicationName",                 fieldType: "LocalizedText"       },

        // The type of application.
        { name: "applicationType",                 fieldType: "EnumApplicationType" },

        // A URI that identifies the Gateway Server associated with the discoveryUrls .
        // this flag is not used if applicationType == CLIENT
        { name: "gatewayServerUri",                fieldType: "String"             },

        // A URI that identifies the discovery profile supported by the URLs provided
        { name: "discoveryProfileUri",             fieldType: "String"             },

        // A list of URLs for the discovery Endpoints provided by the application
        { name: "discoveryUrls",  isArray: true,   fieldType: "String"             }

    ]
};
exports.ApplicationDescription = factories.UAObjectFactoryBuild(ApplicationDescription_Description);


// OPC Unified Architecture, Part 4 $7.36 page 160
var UserTokenPolicy_Description = {
    name: "UserTokenPolicy",
    fields: [
        // An identifier for the UserTokenPolicy assigned by the Server.
        // The Client specifies this value when it constructs a UserIdentityToken that
        // conforms to the policy.
        // This value is only unique within the context of a single Server.
        { name: "policyId",                   fieldType: "String"                   },
        { name: "tokenType",                  fieldType: "EnumUserIdentityTokenType"},

        // This field may only be specified if TokenType is ISSUEDTOKEN.
        // A URI for the type of token. Part 7 defines URIs for supported token types.
        { name: "issuedTokenType",            fieldType: "String"                   },

        // A optional URL for the token issuing service.
        { name: "issuerEndpointUrl",          fieldType: "String"                   },

        // The security policy to use when encrypting or signing the UserToken when it is
        // passed to the Server in the ActivateSession request. see $7.35
        { name: "securityPolicyUri",          fieldType: "String"                   }
    ]
};

exports.UserTokenPolicy = factories.UAObjectFactoryBuild(UserTokenPolicy_Description);

// OPC Unified Architecture, Part 4 page 121
var EndpointDescription_Description = {
    name: "EndpointDescription",
    fields: [
        // The URL for the Endpoint described.
        { name: "endpointUrl",                   fieldType: "String"       },

        // The description for the Server that the Endpoint belongs to. ( see part 4 - $7.1)
        { name: "server",                        fieldType: "ApplicationDescription"},

        // The application instance Certificate issued to the Server .
        { name: "serverCertificate",             fieldType: "ApplicationInstanceCertificate"  },

        // The type of security to apply to the messages. ( see part 4 - $7.14.)
        { name: "securityMode",                  fieldType: "EnumMessageSecurityMode"},

        // The URI for SecurityPolicy to use when securing messages.
        // The set of known URIs and the SecurityPolicies associated with them are defined in Part 7.
        { name: "securityPolicyUri",             fieldType: "String"},

        // The user identity tokens that the Server will accept. ( see part 4 - $7.36)
        //   The Client shall pass one of the UserIdentityTokens in the ActivateSession request.
        { name: "userIdentityTokens" , isArray:true, fieldType: "UserTokenPolicy"},

        // The URI of the Transport Profile supported by the Endpoint . ( see part 7)
        { name: "transportProfileUri",               fieldType: "String"},

        // A numeric value that indicates how secure the EndpointDescription
        // is compared to other EndpointDescriptions for the same Server.
        // A value of 0 indicates that the EndpointDescription is not
        // recommended and is only supported for backward compatibility.
        { name: "securityLevel",                     fieldType: "Byte"}
    ]
};


exports.EndpointDescription = factories.UAObjectFactoryBuild(EndpointDescription_Description);


var GetEndpointsResponse_Description= {
    name: "GetEndpointsResponse",
    fields: [
        { name: "responseHeader",                fieldType: "ResponseHeader"       },
        { name: "endpoints"     , isArray: true, fieldType: "EndpointDescription"  }
    ]
};

exports.GetEndpointsResponse = factories.UAObjectFactoryBuild(GetEndpointsResponse_Description);




// OPC Unified Architecture, Part 4 page 106
var ApplicationInstanceCertificate_Description = {
    // ApplicationInstanceCertificate with signature created by a Certificate Authority
    name: "ApplicationInstanceCertificate",
    fields: [
        // An identifier for the version of the Certificate encoding.
        { name: "version",             fieldType: "ExtensibleParameterAdditionalHeader" },

        // A unique identifier for the Certificate assigned by the Issuer.
        { name: "serialNumber",        fieldType: "ByteString" },

        // The algorithm used to sign the Certificate .
        // The syntax of this field depends on the Certificate encoding.
        { name: "signatureAlgorithm",  fieldType: "String" },

        // The signature created by the Issuer.
        { name: "signature",           fieldType: "ByteString" },

        // A name that identifies the Issuer Certificate used to create the signature.
        { name: "issuer",              fieldType: "String" },

        // When the Certificate becomes valid.
        { name: "validFrom",           fieldType: "UtcTime" },

        // When the Certificate expires.
        { name: "validTo",             fieldType: "UtcTime" },

        // A name that identifies the application instance that the Certificate describes.
        // This field shall contain the productName and the name of the organization
        // responsible for the application instance.
        { name: "subject",             fieldType: "String" },

        // The applicationUri specified in the ApplicationDescription .
        // The ApplicationDescription is described in 7.1.
        { name: "applicationUri",      fieldType: "String" },

        // The name of the machine where the application instance runs.
        // A machine may have multiple names if is accessible via multiple networks.
        // The hostname may be a numeric network address or a descriptive name.
        // Server Certificates shall have at least one hostname defined.
        { name: "hostnames",  isArray: true,fieldType: "String" },


        // The public key associated with the Certificate .
        { name: "publicKey",           fieldType: "ByteString" },

        // Specifies how the Certificate key may be used.
        // ApplicationInstanceCertificates shall support Digital Signature, Non-Repudiation
        // Key Encryption, Data Encryption and Client/Server Authorization.
        // The contents of this field depend on the Certificate enco
        { name: "keyUsage",            fieldType: "String" }

    ]
};
exports.ApplicationInstanceCertificate = factories.UAObjectFactoryBuild(ApplicationInstanceCertificate_Description);

// see OPCUA.Part4. page 22
var OpenSecureChannelRequest_Description = {
    name: "OpenSecureChannelRequest",
    fields: [
        { name: "requestHeader",     fieldType: "RequestHeader"                  },
        { name: "clientCertificate", fieldType: "ApplicationInstanceCertificate" },
        { name: "requestType",       fieldType: "SecurityTokenRequestType"       },
        { name: "secureChannelId",   fieldType: "ByteString"                     },
        { name: "securityMode",      fieldType: "EnumMessageSecurityMode"        },
        { name: "securityPolicyUri", fieldType: "String"                         },
        { name: "clientNonce",       fieldType: "ByteString"                     },
        { name: "requestedLifetime", fieldType: "Duration"                       }
    ]
};

var OpenSecureChannelResponse_Description = {
    name: "OpenSecureChannelResponse",
    fields: [
        { name: "responseHeader",    fieldType: "responseHeader"                 },
        { name: "securityToken",     fieldType: "ChannelSecurityToken"           },
        { name: "channelId",         fieldType: "ByteString"                     },
        { name: "tokenId",           fieldType: "ByteString"                     },
        { name: "createdAt",         fieldType: "UTCTime"                        },
        { name: "revisedLifetime",   fieldType: "Duration"                       },
        { name: "serverNonce",       fieldType: "ByteString"                     }
    ]
};

var CloseSecureChannelRequest_Description = {
    name: "CloseSecureChannelRequuest",
    fields: [
        { name: "requestHeader",     fieldType: "RequestHeader"                  },
        { name: "secureChannelId",   fieldType: "ByteString"                     },
    ]
};

var CloseSecureChannelResponse_Description = {
    name: "CloseSecureChannelResponse",
    fields: [
        { name: "responseHeader",     fieldType: "ResponseHeader"                  },
    ]
};



var factories = require("./factories");

var OpenSecureChannelRequest = factories.UAObjectFactoryBuild(OpenSecureChannelRequest_Description);
