import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface.js";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UAIAssetExtensions_diagnostics extends UAFunctionalGroup { // Object
      currentCPUUtilization?: UABaseDataVariable<number, DataType.Float>;
      currentMemoryUtilization?: UABaseDataVariable<number, DataType.Float>;
      maxCPUUtilization?: UABaseDataVariable<number, DataType.Float>;
      maxMemoryUtilization?: UABaseDataVariable<number, DataType.Float>;
      upTime?: UABaseDataVariable<number, DataType.Double>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAssetExtensionsType i=1009                                 |
 * |isAbstract      |true                                                        |
 */
export interface UAIAssetExtensions_Base extends UABaseInterface_Base {
    connectors?: UAFolder;
    diagnostics?: UAIAssetExtensions_diagnostics;
}
export interface UAIAssetExtensions extends UABaseInterface, UAIAssetExtensions_Base {}