// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { EnumDeviceHealth } from "./enum_device_health"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:IDeviceHealthType ns=1;i=15051                  |
 * |isAbstract      |true                                              |
 */
export interface UAIDeviceHealth_Base extends UABaseInterface_Base {
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    deviceHealthAlarms?: UAFolder;
}
export interface UAIDeviceHealth extends UABaseInterface, UAIDeviceHealth_Base {
}