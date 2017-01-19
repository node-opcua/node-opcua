/**
 * @module opcua.datamodel
 */
require("requirish")._(module);


require("lib/datamodel/diagnostic_info");

import ec from "lib/misc/encode_decode";
import assert from "better-assert";
export const TCPErrorMessage = require("_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;
export const ExtensionObject = require("lib/misc/extension_object").ExtensionObject;
export const RequestHeader = require("_generated_/_auto_generated_RequestHeader").RequestHeader;
export const ResponseHeader = require("_generated_/_auto_generated_ResponseHeader").ResponseHeader;
export const MessageSecurityMode = require("schemas/MessageSecurityMode_enum").MessageSecurityMode;
export const UserIdentityTokenType = require("schemas/UserIdentityTokenType_enum").UserIdentityTokenType;
export const ApplicationType = require("schemas/ApplicationType_enum").ApplicationType;
export const SecurityTokenRequestType = require("schemas/SecurityTokenRequestType_enum").SecurityTokenRequestType;
export const OpenSecureChannelRequest = require("_generated_/_auto_generated_OpenSecureChannelRequest").OpenSecureChannelRequest;
export const ChannelSecurityToken = require("_generated_/_auto_generated_ChannelSecurityToken").ChannelSecurityToken;
/**
 * @property expired
 * @type {Boolean} - True if the security token has expired.
 */
exports.ChannelSecurityToken.prototype.__defineGetter__("expired", function () {
  return (this.createdAt.getTime() + this.revisedLifeTime * 1.6) < (new Date()).getTime();
});


export const SignedSoftwareCertificate = require("_generated_/_auto_generated_SignedSoftwareCertificate").SignedSoftwareCertificate;
export const SignatureData = require("_generated_/_auto_generated_SignatureData").SignatureData;
export const ServiceFault = require("_generated_/_auto_generated_ServiceFault").ServiceFault;
import s2 from "lib/services/session_service";
for (const name in s2) {
  if (s2.hasOwnProperty(name)) {
    exports[name] = s2[name];
  }
}
