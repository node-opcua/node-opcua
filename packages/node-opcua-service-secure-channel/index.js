"use strict";
/**
 * @module services.secure-channel
 */
var ChannelSecurityToken =require("./_generated_/_auto_generated_ChannelSecurityToken").ChannelSecurityToken;
/**
 * @property expired
 * @type {Boolean} - True if the security token has expired.
 */
ChannelSecurityToken.prototype.__defineGetter__("expired", function () {
    return (this.createdAt.getTime() + this.revisedLifeTime * 1.6) < (new Date()).getTime();
});

module.exports = {

    OpenSecureChannelRequest: require("./_generated_/_auto_generated_OpenSecureChannelRequest").OpenSecureChannelRequest,
    OpenSecureChannelResponse: require("./_generated_/_auto_generated_OpenSecureChannelResponse").OpenSecureChannelResponse,
    CloseSecureChannelRequest: require("./_generated_/_auto_generated_CloseSecureChannelRequest").CloseSecureChannelRequest,
    CloseSecureChannelResponse: require("./_generated_/_auto_generated_CloseSecureChannelResponse").CloseSecureChannelResponse,
    ServiceFault: require("./_generated_/_auto_generated_ServiceFault").ServiceFault,
    AsymmetricAlgorithmSecurityHeader: require("./_generated_/_auto_generated_AsymmetricAlgorithmSecurityHeader").AsymmetricAlgorithmSecurityHeader,
    SymmetricAlgorithmSecurityHeader: require("./_generated_/_auto_generated_SymmetricAlgorithmSecurityHeader").SymmetricAlgorithmSecurityHeader,

    SecurityTokenRequestType: require("./schemas/SecurityTokenRequestType_enum").SecurityTokenRequestType,
    ChannelSecurityToken: ChannelSecurityToken,
    ResponseHeader: require("./_generated_/_auto_generated_ResponseHeader").ResponseHeader,
    RequestHeader: require("./_generated_/_auto_generated_RequestHeader").RequestHeader,
    SequenceHeader: require("./_generated_/_auto_generated_SequenceHeader").SequenceHeader,

    SignatureData: require("./_generated_/_auto_generated_SignatureData").SignatureData,
    MessageSecurityMode: require("./schemas/MessageSecurityMode_enum").MessageSecurityMode,

};



