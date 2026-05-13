import type { UAString, UInt64 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumInterfaceAdminStatus } from "./enum_interface_admin_status";
import type { EnumInterfaceOperStatus } from "./enum_interface_oper_status";
import type { UAAnalogUnit } from "./ua_analog_unit";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIetfBaseNetworkInterfaceType i=24148                       |
 * |isAbstract      |true                                                        |
 */
export interface UAIIetfBaseNetworkInterface_Base extends UABaseInterface_Base {
    adminStatus: UABaseDataVariable<EnumInterfaceAdminStatus, DataType.Int32>;
    operStatus: UABaseDataVariable<EnumInterfaceOperStatus, DataType.Int32>;
    physAddress?: UABaseDataVariable<UAString, DataType.String>;
    speed: UAAnalogUnit<UInt64, DataType.UInt64>;
}
export interface UAIIetfBaseNetworkInterface extends UABaseInterface, UAIIetfBaseNetworkInterface_Base {}