import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/AC/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AggregatedHealthDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTAggregatedHealth extends DTStructure {
  aggregatedDeviceHealth: UInt16; // UInt16 ns=34;i=3005
  aggregatedOperationalHealth: UInt32; // UInt32 ns=34;i=3010
}
export interface UDTAggregatedHealth extends ExtensionObject, DTAggregatedHealth {};