import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASAdministrativeInformationType i=1030                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAASAdministrativeInformation_Base {
    revision?: UAProperty<UAString, DataType.String>;
    version?: UAProperty<UAString, DataType.String>;
}
export interface UAAASAdministrativeInformation extends UAObject, UAAASAdministrativeInformation_Base {}