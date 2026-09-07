import type { UAMachineComponents } from "node-opcua-nodeset-machinery/dist/ua_machine_components";
import type { UASTSys, UASTSys_Base } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_sys";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STSysRamType i=1006                                         |
 * |isAbstract      |false                                                       |
 */
export interface UASTSysRam_Base extends UASTSys_Base {
    components?: UAMachineComponents;
}
export interface UASTSysRam extends Omit<UASTSys, "components">, UASTSysRam_Base {}