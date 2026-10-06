import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { EnumMessageSecurityMode } from "node-opcua-nodeset-ua/dist/enum_message_security_mode.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ServerAddressDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTServerAddress extends DTStructure {
  address: UAString; // String ns=0;i=23751
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityPolicyUri: UAString; // String ns=0;i=12
  serverUri: UAString; // String ns=0;i=23751
}
export interface UDTServerAddress extends ExtensionObject, DTServerAddress {};