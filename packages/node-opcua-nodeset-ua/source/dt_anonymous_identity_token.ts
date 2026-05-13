import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTUserIdentityToken } from "./dt_user_identity_token";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AnonymousIdentityToken                                      |
 * | isAbstract|false                                                       |
 */
export interface DTAnonymousIdentityToken extends DTUserIdentityToken {
  policyId: UAString; // String ns=0;i=12
}
export interface UDTAnonymousIdentityToken extends ExtensionObject, DTAnonymousIdentityToken {};