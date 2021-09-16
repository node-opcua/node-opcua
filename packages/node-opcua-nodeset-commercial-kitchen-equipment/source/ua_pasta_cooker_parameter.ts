// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UAPastaCookerParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPastaCookerParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPastaCookerParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPastaCookerParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
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
    actualTemperature: UAPastaCookerParameter_actualTemperature<number, /*z*/DataType.Float>;
    cookingLevel: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    programMode: UABaseDataVariable<any, any>;
    setProcessTime: UAPastaCookerParameter_setProcessTime<Int32, /*z*/DataType.Int32>;
    setTemperature: UAPastaCookerParameter_setTemperature<number, /*z*/DataType.Float>;
    signalMode: UABaseDataVariable<any, any>;
    timeRemaining: UAPastaCookerParameter_timeRemaining<Int32, /*z*/DataType.Int32>;
}
export interface UAPastaCookerParameter extends UAKitchenDeviceParameter, UAPastaCookerParameter_Base {
}