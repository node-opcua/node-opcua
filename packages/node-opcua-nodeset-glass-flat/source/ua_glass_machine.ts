// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAMachineComponents } from "node-opcua-nodeset-machinery/source/ua_machine_components"
import { DTUserProfile } from "./dt_user_profile"
import { UAConfigurationRules } from "./ua_configuration_rules"
import { UAGlassMachineIdentification } from "./ua_glass_machine_identification"
import { UAManualFolder } from "./ua_manual_folder"
import { UAProduction } from "./ua_production"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:GlassMachineType ns=13;i=1015                  |
 * |isAbstract      |false                                             |
 */
export interface UAGlassMachine_Base {
    components?: UAMachineComponents;
    configurationRules: UAConfigurationRules;
    identification: UAGlassMachineIdentification;
    maintenanceManuals?: UAManualFolder;
    operationManuals?: UAManualFolder;
    production: UAProduction;
}
export interface UAGlassMachine extends UAObject, UAGlassMachine_Base {
}