// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "./dt_argument"
import { EnumApplication } from "./enum_application"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProvisionableDeviceType i=26871                             |
 * |isAbstract      |false                                                       |
 */
export interface UAProvisionableDevice_Base {
    isSingleton: UAProperty<boolean, DataType.Boolean>;
    requestTickets: UAMethod;
    setRegistrarEndpoints?: UAMethod;
   // PlaceHolder for $ApplicationName$
}
export interface UAProvisionableDevice extends UAObject, UAProvisionableDevice_Base {
}