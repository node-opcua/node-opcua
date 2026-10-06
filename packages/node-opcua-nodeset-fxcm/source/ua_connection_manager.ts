import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { UALogObject } from "node-opcua-nodeset-ua/dist/ua_log_object.js";
import type { DataType } from "node-opcua-variant";

import type { UAConnectionManagerCapabilities } from "./ua_connection_manager_capabilities.js";
import type { UAConnectionManagerConfiguration } from "./ua_connection_manager_configuration.js";

// ----- this file has been automatically generated - do not edit

export interface UAConnectionManager_diagnostics extends UAFunctionalGroup { // Object
      closeCallCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      closeCallFailedCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      establishCallCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      establishCallFailedCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionManagerType i=1002                                |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionManager_Base {
    aggregatedCurrentState?: UABaseDataVariable<boolean, DataType.Boolean>;
    capabilities?: UAConnectionManagerCapabilities;
    connectionConfigurationSets: UAFolder;
    connectionManagerConfiguration?: UAConnectionManagerConfiguration;
    connectionManagerLog?: UALogObject;
    diagnostics?: UAConnectionManager_diagnostics;
    editConnectionConfigurationSets?: UAMethod;
    globalDiscoveryServers?: UABaseDataVariable<UAString[], DataType.String>;
    processConnectionConfigurationSets?: UAMethod;
}
export interface UAConnectionManager extends UAObject, UAConnectionManager_Base {}