// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAOpticalReaderDevice, UAOpticalReaderDevice_Base } from "./ua_optical_reader_device"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:OpticalVerifierDeviceType ns=3;i=1011           |
 * |isAbstract      |false                                             |
 */
export interface UAOpticalVerifierDevice_Base extends UAOpticalReaderDevice_Base {
    scan?: UAMethod;
}
export interface UAOpticalVerifierDevice extends Omit<UAOpticalReaderDevice, "scan">, UAOpticalVerifierDevice_Base {
}