import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { EnumFxTimeUnitsEnum } from "./enum_fx_time_units_enum.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |IntervalRange                                               |
 * | isAbstract|false                                                       |
 */
export interface DTIntervalRange extends DTStructure {
  min: UInt32; // UInt32 ns=0;i=7
  max: UInt32; // UInt32 ns=0;i=7
  increment: UInt16; // UInt16 ns=0;i=5
  multiplier: UInt16; // UInt16 ns=0;i=5
  unit: EnumFxTimeUnitsEnum; // Int32 ns=33;i=3012
}
export interface UDTIntervalRange extends ExtensionObject, DTIntervalRange {};