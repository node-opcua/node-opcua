import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";
import type { EnumUserToken } from "./enum_user_token";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |UserTokenPolicy                                             |
 * | isAbstract|false                                                       |
 */
export interface DTUserTokenPolicy extends DTStructure {
  policyId: UAString; // String ns=0;i=12
  tokenType: EnumUserToken; // Int32 ns=0;i=303
  issuedTokenType: UAString; // String ns=0;i=12
  issuerEndpointUrl: UAString; // String ns=0;i=12
  securityPolicyUri: UAString; // String ns=0;i=12
}
export interface UDTUserTokenPolicy extends ExtensionObject, DTUserTokenPolicy {};