// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UAString } from "node-opcua-basic-types"
import { DTRange } from "./dt_range"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
import { UAAnalogUnit } from "./ua_analog_unit"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIetfBaseNetworkInterfaceType ns=0;i=24148        |
 * |isAbstract      |true                                              |
 */
export interface UAIIetfBaseNetworkInterface_Base extends UABaseInterface_Base {
    adminStatus: UABaseDataVariable<any, any>;
    operStatus: UABaseDataVariable<any, any>;
    physAddress?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    speed: UAAnalogUnit<UInt64, /*z*/DataType.UInt64>;
}
export interface UAIIetfBaseNetworkInterface extends UABaseInterface, UAIIetfBaseNetworkInterface_Base {
}