
// documentation excerpt:
//
// SecurityTokens have a finite lifetime negotiated with this Service. However, differences between the
// system clocks on different machines and network latencies mean that valid Messages could arrive after the token has
// expired. To prevent valid Messagesfrom being discarded, the applications should do the following:
// 1.  Clients should request a new SecurityTokens after 75% of its lifetime has elapsed. This should ensure that Clients
//     will receive the new SecurityTokenbefore the old one actually expires.
// 2.  Serversshould use the existing SecurityTokento secure outgoing  Messages until the SecurityToken expires or the
//     Serverreceives a Messagesecured with a new SecurityToken.
//     This should ensure that Clientsdo not reject Messages secured with the new SecurityToken that arrive before
//     the Clientreceives the new SecurityToken.
// 3.  Clients should accept Messages secured by an expired SecurityToken for up to 25% of the token lifetime.
//     This should ensure that  Messagessent by the Serverbefore the token expired are not rejected because of
//     network delays.


var OpenSecureChannelResponse_Schema_as_per_Spec_Part4 = {
    name: "OpenSecureChannelResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"                 },
        { name: "securityToken", fieldType: "ChannelSecurityToken"           },
        { name: "serverNonce", fieldType: "ByteString"                     }
    ]
};
var OpenSecureChannelResponse_Schema_as_per_Spec_Part6 = {
    name: "OpenSecureChannelResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"                 },
        { name: "serverProtocolVersion", fieldType: "UInt32"                        },
        { name: "securityToken", fieldType: "ChannelSecurityToken"           },
        { name: "serverNonce", fieldType: "ByteString"                     }
    ]
};
exports.OpenSecureChannelResponse_Schema =OpenSecureChannelResponse_Schema_as_per_Spec_Part6;
