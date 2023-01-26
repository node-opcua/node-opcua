// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumPastaCookerMode } from "./enum_pasta_cooker_mode"
import { EnumSignalMode } from "./enum_signal_mode"
export interface UAPastaCookerParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPastaCookerParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPastaCookerParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPastaCookerParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:PastaCookerParameterType ns=5;i=1020            |
 * |isAbstract      |false                                             |
 */
export interface UAPastaCookerParameter_Base extends UAKitchenDeviceParameter_Base {
    actualTemperature: UAPastaCookerParameter_actualTemperature<number, DataType.Float>;
    cookingLevel: UABaseDataVariable<Int32, DataType.Int32>;
    programMode: UABaseDataVariable<EnumPastaCookerMode, DataType.Int32>;
    setProcessTime: UAPastaCookerParameter_setProcessTime<Int32, DataType.Int32>;
    setTemperature: UAPastaCookerParameter_setTemperature<number, DataType.Float>;
    signalMode: UABaseDataVariable<EnumSignalMode, DataType.Int32>;
    timeRemaining: UAPastaCookerParameter_timeRemaining<Int32, DataType.Int32>;
}
export interface UAPastaCookerParameter extends UAKitchenDeviceParameter, UAPastaCookerParameter_Base {
}