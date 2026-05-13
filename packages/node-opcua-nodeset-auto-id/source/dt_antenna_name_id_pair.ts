import type { Int32, UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |AntennaNameIdPair                                           |
 * | isAbstract|false                                                       |
 */
export interface DTAntennaNameIdPair extends DTStructure {
  antennaId: Int32; // Int32 ns=0;i=6
  antennaName: UAString; // String ns=0;i=12
}
export interface UDTAntennaNameIdPair extends ExtensionObject, DTAntennaNameIdPair {};