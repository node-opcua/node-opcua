// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { EnumCombiSteamerMode } from "./enum_combi_steamer_mode"
import { EnumSpecialCookingMode } from "./enum_special_cooking_mode"
import { EnumEnergySource } from "./enum_energy_source"
import { UACombiSteamerParameter, UACombiSteamerParameter_actualInternalCoreTemperature_$No_$, UACombiSteamerParameter_actualTemperatureChamber_$No_$, UACombiSteamerParameter_setProcessTimeProgram, UACombiSteamerParameter_setTemperature, UACombiSteamerParameter_timeRemainingProgram } from "./ua_combi_steamer_parameter"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
export interface UACombiSteamerDevice_combiSteamer extends Omit<UACombiSteamerParameter, "actualInternalCoreTemperature_$No_$"|"actualTemperatureChamber_$No_$"|"combiSteamerMode"|"isDoorOpen"|"setProcessTimeProgram"|"setTemperature"|"timeRemainingProgram"> { // Object
      "actualInternalCoreTemperature_$No_$": UACombiSteamerParameter_actualInternalCoreTemperature_$No_$<number, DataType.Float>;
      "actualTemperatureChamber_$No_$": UACombiSteamerParameter_actualTemperatureChamber_$No_$<number, DataType.Float>;
      combiSteamerMode: UABaseDataVariable<EnumCombiSteamerMode, DataType.Int32>;
      isDoorOpen: UABaseDataVariable<boolean, DataType.Boolean>;
      setProcessTimeProgram: UACombiSteamerParameter_setProcessTimeProgram<Int32, DataType.Int32>;
      setTemperature: UACombiSteamerParameter_setTemperature<number, DataType.Float>;
      timeRemainingProgram: UACombiSteamerParameter_timeRemainingProgram<Int32, DataType.Int32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CombiSteamerDeviceType ns=5;i=1011              |
 * |isAbstract      |false                                             |
 */
export interface UACombiSteamerDevice_Base extends UACommercialKitchenDevice_Base {
    combiSteamer: UACombiSteamerDevice_combiSteamer;
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    isWithAutomaticCleaning: UAProperty<boolean, DataType.Boolean>;
    isWithExternalCoreTempSensor: UAProperty<boolean, DataType.Boolean>;
    isWithInternalCoreTempSensor: UAProperty<boolean, DataType.Boolean>;
    isWithSousvideTempSensor: UAProperty<boolean, DataType.Boolean>;
}
export interface UACombiSteamerDevice extends UACommercialKitchenDevice, UACombiSteamerDevice_Base {
}