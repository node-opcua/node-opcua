import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { DTConfiguration } from "./dt_configuration";
import type { UAConfigurationFolder } from "./ua_configuration_folder";
import type { UAConfigurationTransfer } from "./ua_configuration_transfer";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfigurationManagementType i=1006                          |
 * |isAbstract      |false                                                       |
 */
export interface UAConfigurationManagement_Base {
    activateConfiguration: UAMethod;
    activeConfiguration: UABaseDataVariable<DTConfiguration, DataType.ExtensionObject>;
    addConfiguration?: UAMethod;
    configurations?: UAConfigurationFolder;
    configurationTransfer?: UAConfigurationTransfer;
    getConfigurationById: UAMethod;
    getConfigurationList: UAMethod;
    releaseConfigurationHandle?: UAMethod;
    removeConfiguration?: UAMethod;
}
export interface UAConfigurationManagement extends UAObject, UAConfigurationManagement_Base {}