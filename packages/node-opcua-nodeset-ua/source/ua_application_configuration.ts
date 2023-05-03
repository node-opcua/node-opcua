// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumApplication } from "./enum_application"
import { UAServerConfiguration, UAServerConfiguration_Base } from "./ua_server_configuration"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ApplicationConfigurationType i=25731                        |
 * |isAbstract      |false                                                       |
 */
export interface UAApplicationConfiguration_Base extends UAServerConfiguration_Base {
    applicationUri: UAProperty<UAString, DataType.String>;
    productUri: UAProperty<UAString, DataType.String>;
    applicationType: UAProperty<EnumApplication, DataType.Int32>;
    enabled: UAProperty<boolean, DataType.Boolean>;
}
export interface UAApplicationConfiguration extends Omit<UAServerConfiguration, "applicationUri"|"productUri"|"applicationType">, UAApplicationConfiguration_Base {
}