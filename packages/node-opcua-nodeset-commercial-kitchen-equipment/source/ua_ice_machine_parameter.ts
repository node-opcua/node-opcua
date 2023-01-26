// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumStatus } from "./enum_status"
export interface UAIceMachineParameter_lastFreezeTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAIceMachineParameter_lastHarvestTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAIceMachineParameter_temperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:IceMachineParameterType ns=5;i=1035             |
 * |isAbstract      |false                                             |
 */
export interface UAIceMachineParameter_Base extends UAKitchenDeviceParameter_Base {
    lastFreezeTime?: UAIceMachineParameter_lastFreezeTime<Int32, DataType.Int32>;
    lastHarvestTime?: UAIceMachineParameter_lastHarvestTime<Int32, DataType.Int32>;
    status?: UABaseDataVariable<EnumStatus, DataType.Int32>;
   // PlaceHolder for temperature_$No_$
    waterFillTime?: UAAnalogItem<Int32, DataType.Int32>;
}
export interface UAIceMachineParameter extends UAKitchenDeviceParameter, UAIceMachineParameter_Base {
}