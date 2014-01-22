var factories = require("./factories.js");

factories.UAObjectFactoryBuild({name:"StatusCode",subtype:"UInt32"}); // 7.33
factories.UAObjectFactoryBuild({name:"String"    ,subtype:"UAString"});


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
        { name: "timeStamp",           fieldType: "UtcTime"                    },

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
    name: "RequestHeader",
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
        { name: "issuer",              fieldType: "Structure" },

        // When the Certificate becomes valid.
        { name: "validFrom",           fieldType: "UtcTime" },

        // When the Certificate expires.
        { name: "validTo",             fieldType: "UtcTime" },

        // A name that identifies the application instance that the Certificate describes.
        // This field shall contain the productName and the name of the organization
        // responsible for the application instance.
        { name: "subject",             fieldType: "Structure" },

        // The applicationUri specified in the ApplicationDescription .
        // The ApplicationDescription is described in 7.1.
        { name: "applicationUri",      fieldType: "String" },

        // The name of the machine where the application instance runs.
        // A machine may have multiple names if is accessible via multiple networks.
        // The hostname may be a numeric network address or a descriptive name.
        // Server Certificates shall have at least one hostname defined.
        { name: "hostnames []",        fieldType: "String" },


        // The public key associated with the Certificate .
        { name: "publicKey",           fieldType: "ByteString" },

        // Specifies how the Certificate key may be used.
        // ApplicationInstanceCertificates shall support Digital Signature, Non-Repudiation
        // Key Encryption, Data Encryption and Client/Server Authorization.
        // The contents of this field depend on the Certificate enco
        { name: "keyUsage",            fieldType: "String" }

    ]
};

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
        { name: "responseHeader",     fieldType: "responseHeader"                  },
    ]
};



var factories = require("./factories");

var OpenSecureChannelRequest = factories.UAObjectFactoryBuild(OpenSecureChannelRequest_Description);
