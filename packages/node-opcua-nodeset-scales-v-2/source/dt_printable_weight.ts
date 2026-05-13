import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTAbstractWeight } from "./dt_abstract_weight";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Scales/V2/                      |
 * | nodeClass |DataType                                                    |
 * | name      |PrintableWeightType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTPrintableWeight extends DTAbstractWeight {
  gross: UAString; // String ns=0;i=12
  net: UAString; // String ns=0;i=12
  tare: UAString; // String ns=0;i=12
}
export interface UDTPrintableWeight extends ExtensionObject, DTPrintableWeight {};