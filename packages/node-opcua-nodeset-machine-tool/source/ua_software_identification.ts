// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:SoftwareIdentificationType ns=10;i=43          |
 * |isAbstract      |false                                             |
 */
export interface UASoftwareIdentification_Base {
    identifier: UAProperty<UAString, /*z*/DataType.String>;
    manufacturer?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    softwareRevision: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UASoftwareIdentification extends UAObject, UASoftwareIdentification_Base {
}