import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { EnumAASKeyElements } from "./enum_aas_key_elements.js";
import type { EnumAASKeyType } from "./enum_aas_key_type.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/I4AAS/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AASKeyDataType                                              |
 * | isAbstract|false                                                       |
 */
export interface DTAASKey extends DTStructure {
  type: EnumAASKeyElements; // Int32 ns=29;i=3012
  local: boolean; // Boolean ns=0;i=1
  value: UAString; // String ns=0;i=12
  idType: EnumAASKeyType; // Int32 ns=29;i=3002
}
export interface UDTAASKey extends ExtensionObject, DTAASKey {};