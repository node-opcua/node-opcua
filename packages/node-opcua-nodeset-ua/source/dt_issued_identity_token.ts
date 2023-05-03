// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTUserIdentityToken } from "./dt_user_identity_token"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |IssuedIdentityToken                                         |
 * | isAbstract|false                                                       |
 */
export interface DTIssuedIdentityToken extends DTUserIdentityToken {
  policyId: UAString; // String ns=0;i=12
  tokenData: Buffer; // ByteString ns=0;i=15
  encryptionAlgorithm: UAString; // String ns=0;i=12
}
export interface UDTIssuedIdentityToken extends ExtensionObject, DTIssuedIdentityToken {};