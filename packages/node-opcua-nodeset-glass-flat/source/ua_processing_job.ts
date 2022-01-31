// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseMaterial } from "./ua_base_material"
import { UAProductionJob, UAProductionJob_Base } from "./ua_production_job"
export interface UAProcessingJob_$InputMaterial$ extends Omit<UABaseMaterial, "$description"|"identifier"|"location"|"materialIdentifier"|"weight"|"x"|"y"|"z"> { // Object
      "$description"?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
      identifier: UAProperty<UAString, /*z*/DataType.String>;
      location: UAProperty<UAString, /*z*/DataType.String>;
      materialIdentifier: UAProperty<UAString, /*z*/DataType.String>;
      weight?: UAAnalogUnit<number, /*z*/DataType.Double>;
      x?: UAAnalogUnit<number, /*z*/DataType.Double>;
      y?: UAAnalogUnit<number, /*z*/DataType.Double>;
      z?: UAAnalogUnit<number, /*z*/DataType.Double>;
}
export interface UAProcessingJob_$OutputMaterial$ extends Omit<UABaseMaterial, "$description"|"identifier"|"location"|"materialIdentifier"|"weight"|"x"|"y"|"z"> { // Object
      "$description"?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
      identifier: UAProperty<UAString, /*z*/DataType.String>;
      location: UAProperty<UAString, /*z*/DataType.String>;
      materialIdentifier: UAProperty<UAString, /*z*/DataType.String>;
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
 * |typedDefinition |13:ProcessingJobType ns=13;i=1009                 |
 * |isAbstract      |false                                             |
 */
export interface UAProcessingJob_Base extends UAProductionJob_Base {
}
export interface UAProcessingJob extends UAProductionJob, UAProcessingJob_Base {
}