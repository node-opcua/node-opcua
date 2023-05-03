// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
import { EnumIdentityCriteria } from "./enum_identity_criteria"
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