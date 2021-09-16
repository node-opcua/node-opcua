// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAAutoIdDevice, UAAutoIdDevice_Base } from "./ua_auto_id_device"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:RtlsDeviceType ns=3;i=1012                      |
 * |isAbstract      |false                                             |
 */
export interface UARtlsDevice_Base extends UAAutoIdDevice_Base {
    geographicalUnit: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    getLocation?: UAMethod;
    getSupportedLocationTypes?: UAMethod;
    getUnits?: UAMethod;
    lengthUnit: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    rotationalUnit: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    scan?: UAMethod;
    speedUnit: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UARtlsDevice extends Omit<UAAutoIdDevice, "scan">, UARtlsDevice_Base {
}