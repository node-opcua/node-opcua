// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTConfiguration } from "./dt_configuration"
import { UAConfigurationFolder } from "./ua_configuration_folder"
import { UAConfigurationTransfer } from "./ua_configuration_transfer"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:ConfigurationManagementType ns=4;i=1006         |
 * |isAbstract      |false                                             |
 */
export interface UAConfigurationManagement_Base {
    activateConfiguration: UAMethod;
    activeConfiguration: UABaseDataVariable<DTConfiguration, /*z*/DataType.ExtensionObject>;
    addConfiguration?: UAMethod;
    configurations?: UAConfigurationFolder;
    configurationTransfer?: UAConfigurationTransfer;
    getConfigurationById: UAMethod;
    getConfigurationList: UAMethod;
    releaseConfigurationHandle?: UAMethod;
    removeConfiguration?: UAMethod;
}
export interface UAConfigurationManagement extends UAObject, UAConfigurationManagement_Base {
}