
/**
 * @module opcua.datamodel
 */


import * as __ from "lib/datamodel/diagnostic_info";

import assert from "better-assert";


import { SignedSoftwareCertificate } from "_generated_/_auto_generated_SignedSoftwareCertificate";
import { SignatureData } from "_generated_/_auto_generated_SignatureData";
import { TCPErrorMessage } from "_generated_/_auto_generated_TCPErrorMessage";
import { ExtensionObject } from "lib/misc/extension_object";
import { RequestHeader } from "_generated_/_auto_generated_RequestHeader";
import { ResponseHeader } from "_generated_/_auto_generated_ResponseHeader";
import { MessageSecurityMode } from "schemas/MessageSecurityMode_enum";
import { UserIdentityTokenType } from "schemas/UserIdentityTokenType_enum";
import { ApplicationType } from "schemas/ApplicationType_enum";
import { SecurityTokenRequestType } from "schemas/SecurityTokenRequestType_enum";
import { OpenSecureChannelRequest } from "_generated_/_auto_generated_OpenSecureChannelRequest";
import { ChannelSecurityToken } from "_generated_/_auto_generated_ChannelSecurityToken";
import { ServiceFault } from "_generated_/_auto_generated_ServiceFault";

import { 
  CreateSessionRequest,
  CreateSessionResponse,
  ActivateSessionRequest,
  ActivateSessionResponse,
  CloseSessionRequest,
  CloseSessionResponse,
  CancelRequest,
  CancelResponse,
  AnonymousIdentityToken,
  UserNameIdentityToken,
  X509IdentityToken,
  IssuedIdentityToken 
} from "lib/services/session_service";


/**
 * @property expired
 * @type {Boolean} - True if the security token has expired.
 */
ChannelSecurityToken.prototype.__defineGetter__("expired", function () {
  return (this.createdAt.getTime() + this.revisedLifeTime * 1.6) < (new Date()).getTime();
});

export { 
  SignedSoftwareCertificate,
  SignatureData,
  ServiceFault,
  TCPErrorMessage,
  ExtensionObject,
  RequestHeader,
  ResponseHeader,
  MessageSecurityMode,
  UserIdentityTokenType,
  ApplicationType,
  SecurityTokenRequestType,
  OpenSecureChannelRequest,
  ChannelSecurityToken,


  CreateSessionRequest,
  CreateSessionResponse,
  ActivateSessionRequest,
  ActivateSessionResponse,
  CloseSessionRequest,
  CloseSessionResponse,
  CancelRequest,
  CancelResponse,
  AnonymousIdentityToken,
  UserNameIdentityToken,
  X509IdentityToken,
  IssuedIdentityToken 
 
 };

