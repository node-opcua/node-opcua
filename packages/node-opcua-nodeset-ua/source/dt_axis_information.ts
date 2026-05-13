import type { EUInformation } from "node-opcua-data-access";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTRange } from "./dt_range";
import type { DTStructure } from "./dt_structure";
import type { EnumAxisScale } from "./enum_axis_scale";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AxisInformation                                             |
 * | isAbstract|false                                                       |
 */
export interface DTAxisInformation extends DTStructure {
  engineeringUnits: EUInformation; // ExtensionObject ns=0;i=887
  euRange: DTRange; // ExtensionObject ns=0;i=884
  title: LocalizedText; // LocalizedText ns=0;i=21
  axisScaleType: EnumAxisScale; // Int32 ns=0;i=12077
  axisSteps: number[]; // Double ns=0;i=11
}
export interface UDTAxisInformation extends ExtensionObject, DTAxisInformation {};