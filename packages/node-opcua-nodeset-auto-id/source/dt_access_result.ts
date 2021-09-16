// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTScanData } from "./dt_scan_data"
/**
 * Result values of an AutoID Identifier access.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:AccessResult                                    |
 * | isAbstract|false                                             |
 */
export interface DTAccessResult extends DTStructure  {
/** Defines the format of Identifier as string.*/
  codeType: UAString; // String ns=3;i=3031
/** The AutoID Identifier (e.g. a code or a transponder) which was accessed by a command.*/
  identifier: DTScanData; // ExtensionObject ns=3;i=3020
/** The point of time the AutoID Identifier was accessed by the command.*/
  timestamp: Date; // DateTime ns=0;i=294
}