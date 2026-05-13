import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTUserIdentityToken } from "./dt_user_identity_token";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |X509IdentityToken                                           |
 * | isAbstract|false                                                       |
 */
export interface DTX509IdentityToken extends DTUserIdentityToken {
  policyId: UAString; // String ns=0;i=12
  certificateData: Buffer; // ByteString ns=0;i=15
}
export interface UDTX509IdentityToken extends ExtensionObject, DTX509IdentityToken {};