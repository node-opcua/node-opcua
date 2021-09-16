// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UAMachineIdentification, UAMachineIdentification_Base } from "node-opcua-nodeset-machinery/source/ua_machine_identification"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:MachineToolIdentificationType ns=10;i=11       |
 * |isAbstract      |false                                             |
 */
export interface UAMachineToolIdentification_Base extends UAMachineIdentification_Base {
    softwareIdentification?: UAObject;
}
export interface UAMachineToolIdentification extends UAMachineIdentification, UAMachineToolIdentification_Base {
}