// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |IdentityMappingRuleType                           |
 * | isAbstract|false                                             |
 */
export interface DTIdentityMappingRule extends DTStructure  {
  criteriaType: Variant; // Variant ns=0;i=15632
  criteria: UAString; // String ns=0;i=12
}