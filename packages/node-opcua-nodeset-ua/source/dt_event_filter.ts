// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTMonitoringFilter } from "./dt_monitoring_filter"
import { DTSimpleAttributeOperand } from "./dt_simple_attribute_operand"
import { DTContentFilter } from "./dt_content_filter"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EventFilter                                       |
 * | isAbstract|false                                             |
 */
export interface DTEventFilter extends DTMonitoringFilter {
  selectClauses: DTSimpleAttributeOperand[]; // ExtensionObject ns=0;i=601
  whereClause: DTContentFilter; // ExtensionObject ns=0;i=586
}
export interface UDTEventFilter extends ExtensionObject, DTEventFilter {};