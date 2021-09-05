// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTUserIdentityToken } from "./dt_user_identity_token"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |X509IdentityToken                                 |
 * | isAbstract|false                                             |
 */
export interface DTX509IdentityToken extends DTUserIdentityToken  {
  policyId: UAString; // String ns=0;i=12
  certificateData: Buffer; // ByteString ns=0;i=15
}