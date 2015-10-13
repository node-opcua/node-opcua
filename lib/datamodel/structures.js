"use strict";
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);

var factories = require("lib/misc/factories");

require("lib/datamodel/diagnostic_info");

var ec = require("lib/misc/encode_decode");
var assert = require("better-assert");


exports.TCPErrorMessage = require("_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;

exports.ExtensionObject = require("lib/misc/extension_object").ExtensionObject;


exports.RequestHeader = require("_generated_/_auto_generated_RequestHeader").RequestHeader;
exports.ResponseHeader = require("_generated_/_auto_generated_ResponseHeader").ResponseHeader;


exports.MessageSecurityMode = require("schemas/MessageSecurityMode_enum").MessageSecurityMode;
exports.UserIdentityTokenType = require("schemas/UserIdentityTokenType_enum").UserIdentityTokenType;
exports.ApplicationType = require("schemas/ApplicationType_enum").ApplicationType;
exports.SecurityTokenRequestType = require("schemas/SecurityTokenRequestType_enum").SecurityTokenRequestType;

exports.OpenSecureChannelRequest = require("_generated_/_auto_generated_OpenSecureChannelRequest").OpenSecureChannelRequest;

exports.ChannelSecurityToken = require("_generated_/_auto_generated_ChannelSecurityToken").ChannelSecurityToken;
/**
 * @property expired
 * @type {Boolean} - True if the security token has expired.
 */
exports.ChannelSecurityToken.prototype.__defineGetter__("expired", function () {
    return (this.createdAt.getTime() + this.revisedLifeTime * 1.6) < (new Date()).getTime();
});


exports.SignedSoftwareCertificate = require("_generated_/_auto_generated_SignedSoftwareCertificate").SignedSoftwareCertificate;
exports.SignatureData = require("_generated_/_auto_generated_SignatureData").SignatureData;
exports.ServiceFault = require("_generated_/_auto_generated_ServiceFault").ServiceFault;


var s2 = require("lib/services/session_service");
for (var name in s2) {
    if (s2.hasOwnProperty(name)) {
        exports[name] = s2[name];
    }
}
