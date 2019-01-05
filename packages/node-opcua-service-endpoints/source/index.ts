/**
 * @module node-opcua-service-endpoints
 */
// tslint:disable:max-line-length
export {
    ApplicationType,
    ApplicationDescription,
    ApplicationDescriptionOptions,
    UserTokenPolicy,
    EndpointDescription,
    UserIdentityToken,
    GetEndpointsRequest,
    GetEndpointsRequestOptions,
    GetEndpointsResponse,
    UserTokenType
} from "node-opcua-types";

import { UserTokenType } from "node-opcua-types";

// OPC Unified Architecture, Part 4 $7.1 page 106
// ApplicationDescription",
// 0.   applicationUri        String          The globally unique identifier for the application instance.
// 1.   productUri            String          The globally unique identifier for the product.
// 2.   applicationName       LocalizedText   A localized descriptive name for the application.
// 3.   applicationType       ApplicationType The type of application.
// 4.   gatewayServerUri      String          A URI that identifies the Gateway Server associated with the discoveryUrls .
//                                            this flag is not used if applicationType === CLIENT
// 5.   discoveryProfileUri   String          A URI that identifies the discovery profile supported by the URLs provided
// 6.   discoveryUrls         String[]        A list of URLs for the discovery Endpoints provided by the application

// OPC Unified Architecture, Part 4 page 121
// EndpointDescription",
//   endpointUrl          String                     The URL for the Endpoint described.
//   server               ApplicationDescription     The description for the Server that the Endpoint belongs to. ( see part 4 - $7.1)
//   serverCertificate    ByteString                 The application instance Certificate issued to the Server .
//   securityMode         MessageSecurityMode        The type of security to apply to the messages. ( see part 4 - $7.14.)
//   securityPolicyUri    String                     The URI for SecurityPolicy to use when securing messages.
//                                                   The set of known URIs and the SecurityPolicies associated with them are defined in Part 7.
//   userIdentityTokens   UserTokenPolicy[]          The user identity tokens that the Server will accept. ( see part 4 - $7.36)
//                                                   The Client shall pass one of the UserIdentityTokens in the ActivateSession request.
//   transportProfileUri  String                     The URI of the Transport Profile supported by the Endpoint . ( see part 7)
//   securityLevel       Byte                        A numeric value that indicates how secure the EndpointDescription
//                                                   is compared to other EndpointDescriptions for the same Server.
//                                                   A value of 0 indicates that the EndpointDescription is not
//                                                   recommended and is only supported for backward compatibility.

// OPC Unified Architecture, Part 4 page 16
// GetEndpointsRequest
//    requestHeader      RequestHeader
//    endpointUrl        String                The network address that the Client used to access the Discovery Endpoint .
//                                             The Server uses this information for diagnostics and to determine what
//                                             URLs to return in the response.
//                                             The Server should return a suitable default URL if it does not recognize
//                                             the HostName in the URL.
//     localeIds         LocaleId[]            List of locales to use.
//                                             Specifies the locale to use when returning human readable strings.
//    profileUri         String[]              List of transport profiles that the returned Endpoints shall support.
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
// UserTokenPolicy
//    policyId      String                     An identifier for the UserTokenPolicy assigned by the Server.
//                                             The Client specifies this value when it constructs a UserIdentityToken that
//                                             conforms to the policy.
//                                             This value is only unique within the context of a single Server.
//    tokenType      UserTokenType
//    issuedTokenType      String              This field may only be specified if TokenType is ISSUEDTOKEN.
//                                             A URI for the type of token. Part 7 defines URIs for supported token types.
//    issuerEndpointUrl    String              A optional URL for the token issuing service.
// ", defaultValue: null  },
//    securityPolicyUri     String             The security policy to use when encrypting or signing the UserToken when it is
//                                             passed to the Server in the ActivateSession request. see $7.35
//                                             Release 1.02 155 OPC Unified Architecture, Part 4
//                                             (If this SecurityPolicy is omitted then the Client uses the SecurityPolicy in the
//                                             EndpointDescription.)
// ", defaultValue: null  }
//
