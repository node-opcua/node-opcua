// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { DTStructure } from "./dt_structure"
import { DTRange } from "./dt_range"
import { EnumAxisScale } from "./enum_axis_scale"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |AxisInformation                                   |
 * | isAbstract|false                                             |
 */
export interface DTAxisInformation extends DTStructure  {
  engineeringUnits: EUInformation; // ExtensionObject ns=0;i=887
  euRange: DTRange; // ExtensionObject ns=0;i=884
  title: LocalizedText; // LocalizedText ns=0;i=21
  axisScaleType: EnumAxisScale; // Int32 ns=0;i=12077
  axisSteps: number[]; // Double ns=0;i=11
}