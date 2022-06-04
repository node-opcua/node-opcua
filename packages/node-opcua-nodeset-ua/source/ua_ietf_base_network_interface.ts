// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UAString } from "node-opcua-basic-types"
import { EnumInterfaceAdminStatus } from "./enum_interface_admin_status"
import { EnumInterfaceOperStatus } from "./enum_interface_oper_status"
import { UABaseDataVariable } from "./ua_base_data_variable"
import { UAAnalogUnit } from "./ua_analog_unit"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IetfBaseNetworkInterfaceType ns=0;i=25221         |
 * |isAbstract      |false                                             |
 */
export interface UAIetfBaseNetworkInterface_Base {
    adminStatus: UABaseDataVariable<EnumInterfaceAdminStatus, /*z*/DataType.Int32>;
    operStatus: UABaseDataVariable<EnumInterfaceOperStatus, /*z*/DataType.Int32>;
    physAddress?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    speed: UAAnalogUnit<UInt64, /*z*/DataType.UInt64>;
}
export interface UAIetfBaseNetworkInterface extends UAObject, UAIetfBaseNetworkInterface_Base {
}