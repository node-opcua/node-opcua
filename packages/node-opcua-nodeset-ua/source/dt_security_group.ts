import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTRolePermission } from "./dt_role_permission";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SecurityGroupDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTSecurityGroup extends DTStructure {
  name: UAString; // String ns=0;i=12
  securityGroupFolder: UAString[]; // String ns=0;i=12
  keyLifetime: number; // Double ns=0;i=290
  securityPolicyUri: UAString; // String ns=0;i=12
  maxFutureKeyCount: UInt32; // UInt32 ns=0;i=7
  maxPastKeyCount: UInt32; // UInt32 ns=0;i=7
  securityGroupId: UAString; // String ns=0;i=12
  rolePermissions: DTRolePermission[]; // ExtensionObject ns=0;i=96
  groupProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTSecurityGroup extends ExtensionObject, DTSecurityGroup {};