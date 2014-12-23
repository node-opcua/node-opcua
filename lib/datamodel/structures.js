/**
 * @module opcua.datamodel
 */
var factories = require("./../misc/factories");

require("./diagnostic_info");

var ec = require("./../misc/encode_decode");
var assert = require('better-assert');


exports.TCPErrorMessage = require("../../_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;
exports.ExtensibleParameter = require("../../_generated_/_auto_generated_ExtensibleParameter").ExtensibleParameter;
exports.ExtensibleParameterAdditionalHeader = require("../../_generated_/_auto_generated_ExtensibleParameterAdditionalHeader").ExtensibleParameterAdditionalHeader;



exports.RequestHeader = require("../../_generated_/_auto_generated_RequestHeader").RequestHeader;
exports.ResponseHeader = require("../../_generated_/_auto_generated_ResponseHeader").ResponseHeader;


exports.GetEndpointsRequest = require("../../_generated_/_auto_generated_GetEndpointsRequest").GetEndpointsRequest;


exports.MessageSecurityMode      = require("../../schemas/MessageSecurityMode_enum").MessageSecurityMode;
exports.UserIdentityTokenType    = require("../../schemas/UserIdentityTokenType_enum").UserIdentityTokenType;
exports.ApplicationType          = require("../../schemas/ApplicationType_enum").ApplicationType;
exports.SecurityTokenRequestType = require("../../schemas/SecurityTokenRequestType_enum").SecurityTokenRequestType;

exports.ApplicationDescription = require("../../_generated_/_auto_generated_ApplicationDescription").ApplicationDescription;
exports.UserTokenPolicy        = require("../../_generated_/_auto_generated_UserTokenPolicy").UserTokenPolicy;
exports.EndpointDescription    = require("../../_generated_/_auto_generated_EndpointDescription").EndpointDescription;
exports.GetEndpointsResponse   = require("../../_generated_/_auto_generated_GetEndpointsResponse").GetEndpointsResponse;
exports.ApplicationInstanceCertificate   = require("../../_generated_/_auto_generated_ApplicationInstanceCertificate").ApplicationInstanceCertificate;
exports.OpenSecureChannelRequest   = require("../../_generated_/_auto_generated_OpenSecureChannelRequest").OpenSecureChannelRequest;

exports.ChannelSecurityToken   = require("../../_generated_/_auto_generated_ChannelSecurityToken").ChannelSecurityToken;
/**
 * @property expired
 * @type {Boolean} - True if the security token has expired.
 */
exports.ChannelSecurityToken.prototype.__defineGetter__("expired", function () {
    return (this.createdAt.getTime() + this.revisedLifeTime * 1.6) < (new Date()).getTime();
});

exports.OpenSecureChannelResponse   = require("../../_generated_/_auto_generated_OpenSecureChannelResponse").OpenSecureChannelResponse;
exports.CloseSecureChannelRequest   = require("../../_generated_/_auto_generated_CloseSecureChannelRequest").CloseSecureChannelRequest;
exports.CloseSecureChannelResponse  = require("../../_generated_/_auto_generated_CloseSecureChannelResponse").CloseSecureChannelResponse;

exports.ServiceFault  = require("../../_generated_/_auto_generated_ServiceFault").ServiceFault;

exports.SignedSoftwareCertificate  = require("../../_generated_/_auto_generated_SignedSoftwareCertificate").SignedSoftwareCertificate;
exports.SignatureData  = require("../../_generated_/_auto_generated_SignatureData").SignatureData;




var s2 = require("./../services/session_service");
for (var name in s2) {
    exports[name] = s2[name];
}
