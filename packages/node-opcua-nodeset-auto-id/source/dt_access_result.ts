import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTScanData } from "./dt_scan_data";

// ----- this file has been automatically generated - do not edit

/**
 * Result values of an AutoID Identifier access.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |AccessResult                                                |
 * | isAbstract|false                                                       |
 */
export interface DTAccessResult extends DTStructure {
  /** Defines the format of Identifier as string.*/
  codeType?: UAString; // String ns=3;i=3031
  /** The AutoID Identifier (e.g. a code or a transponder) which was accessed by a command.*/
  identifier?: DTScanData; // ExtensionObject ns=3;i=3020
  /** The point of time the AutoID Identifier was accessed by the command.*/
  timestamp?: Date; // DateTime ns=0;i=294
}
export interface UDTAccessResult extends ExtensionObject, DTAccessResult {};