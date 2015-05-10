"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// OPC Unified Architecture, Part 4 $7.36 page 160
// This value is an enumeration with one of the following values:
//  ANONYMOUS_0     No token is required.
//  USERNAME_1      A username/password token.
//  CERTIFICATE_2   An X509v3 certificate token.
//  ISSUEDTOKEN_3    Any WS-Security defined token.
//  A tokenType of ANONYMOUS indicates that the Server does not require any
//  user identification. In this case the Client application instance Certificate is used
//  as the user identification.
var EnumUserIdentityTokenType_Schema = {
    name: "EnumUserIdentityTokenType",
    enumValues: {
        ANONYMOUS: 0,
        USERNAME: 1,
        CERTIFICATE: 2,
        ISSUEDTOKEN: 3
    }
};

exports.UserIdentityTokenType = factories.registerEnumeration(EnumUserIdentityTokenType_Schema);
