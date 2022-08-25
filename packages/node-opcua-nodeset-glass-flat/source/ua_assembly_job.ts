// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseMaterial } from "./ua_base_material"
import { UAAssembly } from "./ua_assembly"
import { UAProductionJob, UAProductionJob_Base } from "./ua_production_job"
export interface UAAssemblyJob_$InputMaterial$ extends Omit<UABaseMaterial, "$description"|"identifier"|"location"|"materialIdentifier"|"weight"|"x"|"y"|"z"> { // Object
      "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
      weight?: UAAnalogUnit<number, DataType.Double>;
      x?: UAAnalogUnit<number, DataType.Double>;
      y?: UAAnalogUnit<number, DataType.Double>;
      z?: UAAnalogUnit<number, DataType.Double>;
}
export interface UAAssemblyJob_$OutputMaterial$ extends Omit<UAAssembly, "identifier"|"location"|"materialIdentifier"> { // Object
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:AssemblyJobType ns=13;i=1008                   |
 * |isAbstract      |false                                             |
 */
export type UAAssemblyJob_Base = UAProductionJob_Base;
export interface UAAssemblyJob extends UAProductionJob, UAAssemblyJob_Base {
}