// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAComponent, UAComponent_Base } from "./ua_component"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:SoftwareType ns=1;i=15106                       |
 * |isAbstract      |false                                             |
 */
export interface UASoftware_Base extends UAComponent_Base {
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    softwareRevision: UAProperty<UAString, DataType.String>;
}
export interface UASoftware extends Omit<UAComponent, "manufacturer"|"model"|"softwareRevision">, UASoftware_Base {
}