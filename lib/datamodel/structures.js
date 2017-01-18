/**
 * @module opcua.datamodel
 */
require("requirish")._(module);


require("lib/datamodel/diagnostic_info");

import ec from "lib/misc/encode_decode";
import assert from "better-assert";
export var TCPErrorMessage = require("_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;
export var ExtensionObject = require("lib/misc/extension_object").ExtensionObject;
export var RequestHeader = require("_generated_/_auto_generated_RequestHeader").RequestHeader;
export var ResponseHeader = require("_generated_/_auto_generated_ResponseHeader").ResponseHeader;
export var MessageSecurityMode = require("schemas/MessageSecurityMode_enum").MessageSecurityMode;
export var UserIdentityTokenType = require("schemas/UserIdentityTokenType_enum").UserIdentityTokenType;
export var ApplicationType = require("schemas/ApplicationType_enum").ApplicationType;
export var SecurityTokenRequestType = require("schemas/SecurityTokenRequestType_enum").SecurityTokenRequestType;
export var OpenSecureChannelRequest = require("_generated_/_auto_generated_OpenSecureChannelRequest").OpenSecureChannelRequest;
export var ChannelSecurityToken = require("_generated_/_auto_generated_ChannelSecurityToken").ChannelSecurityToken;
/**
 * @property expired
 * @type {Boolean} - True if the security token has expired.
 */
exports.ChannelSecurityToken.prototype.__defineGetter__("expired", function () {
  return (this.createdAt.getTime() + this.revisedLifeTime * 1.6) < (new Date()).getTime();
});


export var SignedSoftwareCertificate = require("_generated_/_auto_generated_SignedSoftwareCertificate").SignedSoftwareCertificate;
export var SignatureData = require("_generated_/_auto_generated_SignatureData").SignatureData;
export var ServiceFault = require("_generated_/_auto_generated_ServiceFault").ServiceFault;
import s2 from "lib/services/session_service";
for (const name in s2) {
  if (s2.hasOwnProperty(name)) {
    exports[name] = s2[name];
  }
}
