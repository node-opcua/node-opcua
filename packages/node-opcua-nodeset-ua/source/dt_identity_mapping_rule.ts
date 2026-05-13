import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";
import type { EnumIdentityCriteria } from "./enum_identity_criteria";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |IdentityMappingRuleType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTIdentityMappingRule extends DTStructure {
  criteriaType: EnumIdentityCriteria; // Int32 ns=0;i=15632
  criteria: UAString; // String ns=0;i=12
}
export interface UDTIdentityMappingRule extends ExtensionObject, DTIdentityMappingRule {};