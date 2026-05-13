import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SoftwareIdentificationType i=43                             |
 * |isAbstract      |false                                                       |
 */
export interface UASoftwareIdentification_Base {
    identifier: UAProperty<UAString, DataType.String>;
    manufacturer?: UAProperty<LocalizedText, DataType.LocalizedText>;
    softwareRevision: UAProperty<UAString, DataType.String>;
}
export interface UASoftwareIdentification extends UAObject, UASoftwareIdentification_Base {}