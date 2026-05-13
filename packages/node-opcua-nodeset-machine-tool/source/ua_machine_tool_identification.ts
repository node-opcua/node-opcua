import type { UAObject } from "node-opcua-address-space-base";
import type { UAMachineIdentification, UAMachineIdentification_Base } from "node-opcua-nodeset-machinery/dist/ua_machine_identification";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MachineToolIdentificationType i=11                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMachineToolIdentification_Base extends UAMachineIdentification_Base {
    softwareIdentification?: UAObject;
}
export interface UAMachineToolIdentification extends UAMachineIdentification, UAMachineToolIdentification_Base {}