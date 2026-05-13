import type { UAObject } from "node-opcua-address-space-base";
import type { UAMachineComponents } from "node-opcua-nodeset-machinery/dist/ua_machine_components";

import type { UAConfigurationRules } from "./ua_configuration_rules";
import type { UAGlassMachineIdentification } from "./ua_glass_machine_identification";
import type { UAManualFolder } from "./ua_manual_folder";
import type { UAProduction } from "./ua_production";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GlassMachineType i=1015                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAGlassMachine_Base {
    components?: UAMachineComponents;
    configurationRules: UAConfigurationRules;
    identification: UAGlassMachineIdentification;
    maintenanceManuals?: UAManualFolder;
    operationManuals?: UAManualFolder;
    production: UAProduction;
}
export interface UAGlassMachine extends UAObject, UAGlassMachine_Base {}