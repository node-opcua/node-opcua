import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTContentFilter } from "./dt_content_filter";
import type { DTMonitoringFilter } from "./dt_monitoring_filter";
import type { DTSimpleAttributeOperand } from "./dt_simple_attribute_operand";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |EventFilter                                                 |
 * | isAbstract|false                                                       |
 */
export interface DTEventFilter extends DTMonitoringFilter {
  selectClauses: DTSimpleAttributeOperand[]; // ExtensionObject ns=0;i=601
  whereClause: DTContentFilter; // ExtensionObject ns=0;i=586
}
export interface UDTEventFilter extends ExtensionObject, DTEventFilter {};