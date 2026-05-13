import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MetalForming/                   |
 * | nodeClass |DataType                                                    |
 * | name      |CyclicProcessValueDataType                                  |
 * | isAbstract|false                                                       |
 */
export interface DTCyclicProcessValue extends DTStructure {
  analogSignal?: number; // Variant ns=0;i=26
  setpoint?: number; // Variant ns=0;i=26
  cycleCount: UInt32; // UInt32 ns=0;i=289
  isActive: boolean; // Boolean ns=0;i=1
}
export interface UDTCyclicProcessValue extends ExtensionObject, DTCyclicProcessValue {};