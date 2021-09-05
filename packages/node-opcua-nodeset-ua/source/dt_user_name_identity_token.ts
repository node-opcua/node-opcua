// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTUserIdentityToken } from "./dt_user_identity_token"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UserNameIdentityToken                             |
 * | isAbstract|false                                             |
 */
export interface DTUserNameIdentityToken extends DTUserIdentityToken  {
  policyId: UAString; // String ns=0;i=12
  userName: UAString; // String ns=0;i=12
  password: Buffer; // ByteString ns=0;i=15
  encryptionAlgorithm: UAString; // String ns=0;i=12
}