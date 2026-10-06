import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |SecurityKeyServerAddressDataType                            |
 * | isAbstract|false                                                       |
 */
export interface DTSecurityKeyServerAddress extends DTStructure {
  address: UAString; // String ns=0;i=23751
  securityPolicyUri: UAString; // String ns=0;i=12
  serverUri: UAString; // String ns=0;i=23751
  usePushModel: boolean; // Boolean ns=0;i=1
}
export interface UDTSecurityKeyServerAddress extends ExtensionObject, DTSecurityKeyServerAddress {};