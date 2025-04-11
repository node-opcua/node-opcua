// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"

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