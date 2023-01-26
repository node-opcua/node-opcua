// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { EnumCoatingClass } from "./enum_coating_class"
import { EnumSignificantSide } from "./enum_significant_side"
import { EnumStructureAlignment } from "./enum_structure_alignment"
import { UABaseMaterial } from "./ua_base_material"
import { UAGlass } from "./ua_glass"
import { UAProductionJob, UAProductionJob_Base } from "./ua_production_job"
export interface UACuttingJob_$InputMaterial$ extends Omit<UABaseMaterial, "$description"|"identifier"|"location"|"materialIdentifier"|"weight"|"x"|"y"|"z"> { // Object
      "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
      weight?: UAAnalogUnit<number, DataType.Double>;
      x?: UAAnalogUnit<number, DataType.Double>;
      y?: UAAnalogUnit<number, DataType.Double>;
      z?: UAAnalogUnit<number, DataType.Double>;
}
export interface UACuttingJob_$OutputMaterial$ extends Omit<UAGlass, "absorption"|"coatingClass"|"coatingEmessivity"|"$description"|"electricalConductivity"|"identifier"|"location"|"materialIdentifier"|"orientation"|"reflection"|"significantSide"|"structureAlignment"|"structureClass"|"transmission"|"weight"|"x"|"y"|"z"> { // Object
      absorption: UAAnalogUnit<any, any>;
      coatingClass: UAProperty<EnumCoatingClass, DataType.Int32>;
      coatingEmessivity: UAAnalogUnit<any, any>;
      "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
      electricalConductivity: UAAnalogUnit<any, any>;
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
      orientation: UAProperty<any, any>;
      reflection: UAAnalogUnit<any, any>;
      significantSide: UAProperty<EnumSignificantSide, DataType.Int32>;
      structureAlignment: UAProperty<EnumStructureAlignment, DataType.Int32>;
      structureClass: UAProperty<UAString, DataType.String>;
      transmission: UAAnalogUnit<any, any>;
      weight?: UAAnalogUnit<number, DataType.Double>;
      x?: UAAnalogUnit<number, DataType.Double>;
      y?: UAAnalogUnit<number, DataType.Double>;
      z?: UAAnalogUnit<number, DataType.Double>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:CuttingJobType ns=13;i=1007                    |
 * |isAbstract      |false                                             |
 */
export type UACuttingJob_Base = UAProductionJob_Base;
export interface UACuttingJob extends UAProductionJob, UACuttingJob_Base {
}