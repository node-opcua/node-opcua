import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { DataType } from "node-opcua-variant";

import type { UAAutoIdDevice, UAAutoIdDevice_Base } from "./ua_auto_id_device";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RtlsDeviceType i=1012                                       |
 * |isAbstract      |false                                                       |
 */
export interface UARtlsDevice_Base extends UAAutoIdDevice_Base {
    geographicalUnit: UAProperty<EUInformation, DataType.ExtensionObject>;
    getLocation?: UAMethod;
    getSupportedLocationTypes?: UAMethod;
    getUnits?: UAMethod;
    lengthUnit: UAProperty<EUInformation, DataType.ExtensionObject>;
    rotationalUnit: UAProperty<EUInformation, DataType.ExtensionObject>;
    scan?: UAMethod;
    speedUnit: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UARtlsDevice extends Omit<UAAutoIdDevice, "scan">, UARtlsDevice_Base {}