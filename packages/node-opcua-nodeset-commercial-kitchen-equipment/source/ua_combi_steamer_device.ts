// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UACombiSteamerParameter, UACombiSteamerParameter_actualInternalCoreTemperature_$No_$, UACombiSteamerParameter_actualTemperatureChamber_$No_$, UACombiSteamerParameter_setProcessTimeProgram, UACombiSteamerParameter_setTemperature, UACombiSteamerParameter_timeRemainingProgram } from "./ua_combi_steamer_parameter"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
export interface UACombiSteamerDevice_combiSteamer extends Omit<UACombiSteamerParameter, "actualInternalCoreTemperature_$No_$"|"actualTemperatureChamber_$No_$"|"combiSteamerMode"|"isDoorOpen"|"setProcessTimeProgram"|"setTemperature"|"timeRemainingProgram"> { // Object
      "actualInternalCoreTemperature_$No_$": UACombiSteamerParameter_actualInternalCoreTemperature_$No_$<number, /*z*/DataType.Float>;
      "actualTemperatureChamber_$No_$": UACombiSteamerParameter_actualTemperatureChamber_$No_$<number, /*z*/DataType.Float>;
      combiSteamerMode: UABaseDataVariable<any, any>;
      isDoorOpen: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
      setProcessTimeProgram: UACombiSteamerParameter_setProcessTimeProgram<Int32, /*z*/DataType.Int32>;
      setTemperature: UACombiSteamerParameter_setTemperature<number, /*z*/DataType.Float>;
      timeRemainingProgram: UACombiSteamerParameter_timeRemainingProgram<Int32, /*z*/DataType.Int32>;
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
    energySource: UAProperty<any, any>;
    isWithAutomaticCleaning: UAProperty<boolean, /*z*/DataType.Boolean>;
    isWithExternalCoreTempSensor: UAProperty<boolean, /*z*/DataType.Boolean>;
    isWithInternalCoreTempSensor: UAProperty<boolean, /*z*/DataType.Boolean>;
    isWithSousvideTempSensor: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UACombiSteamerDevice extends UACommercialKitchenDevice, UACombiSteamerDevice_Base {
}