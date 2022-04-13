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
      "$description"?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
      identifier: UAProperty<UAString, /*z*/DataType.String>;
      location: UAProperty<UAString, /*z*/DataType.String>;
      materialIdentifier: UAProperty<UAString, /*z*/DataType.String>;
      weight?: UAAnalogUnit<number, /*z*/DataType.Double>;
      x?: UAAnalogUnit<number, /*z*/DataType.Double>;
      y?: UAAnalogUnit<number, /*z*/DataType.Double>;
      z?: UAAnalogUnit<number, /*z*/DataType.Double>;
}
export interface UACuttingJob_$OutputMaterial$ extends Omit<UAGlass, "absorption"|"coatingClass"|"coatingEmessivity"|"$description"|"electricalConductivity"|"identifier"|"location"|"materialIdentifier"|"orientation"|"reflection"|"significantSide"|"structureAlignment"|"structureClass"|"transmission"|"weight"|"x"|"y"|"z"> { // Object
      absorption: UAAnalogUnit<any, any>;
      coatingClass: UAProperty<EnumCoatingClass, /*z*/DataType.Int32>;
      coatingEmessivity: UAAnalogUnit<any, any>;
      "$description"?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
      electricalConductivity: UAAnalogUnit<any, any>;
      identifier: UAProperty<UAString, /*z*/DataType.String>;
      location: UAProperty<UAString, /*z*/DataType.String>;
      materialIdentifier: UAProperty<UAString, /*z*/DataType.String>;
      orientation: UAProperty<any, any>;
      reflection: UAAnalogUnit<any, any>;
      significantSide: UAProperty<EnumSignificantSide, /*z*/DataType.Int32>;
      structureAlignment: UAProperty<EnumStructureAlignment, /*z*/DataType.Int32>;
      structureClass: UAProperty<UAString, /*z*/DataType.String>;
      transmission: UAAnalogUnit<any, any>;
      weight?: UAAnalogUnit<number, /*z*/DataType.Double>;
      x?: UAAnalogUnit<number, /*z*/DataType.Double>;
      y?: UAAnalogUnit<number, /*z*/DataType.Double>;
      z?: UAAnalogUnit<number, /*z*/DataType.Double>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:CuttingJobType ns=13;i=1007                    |
 * |isAbstract      |false                                             |
 */
export interface UACuttingJob_Base extends UAProductionJob_Base {
}
export interface UACuttingJob extends UAProductionJob, UACuttingJob_Base {
}