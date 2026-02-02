// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAPADIM_deviceConditionSet } from "./ua_padim"
import { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser"
export interface UARamanSpectrometer_deviceConditionSet extends UAPADIM_deviceConditionSet { // Object
      watchdog?: UAProperty<boolean, DataType.Boolean>;
      remainingDataStorageCapacity?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RamanSpectrometerType i=1104                                |
 * |isAbstract      |false                                                       |
 */
export interface UARamanSpectrometer_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UARamanSpectrometer_deviceConditionSet;
}
export interface UARamanSpectrometer extends Omit<UAProcessAnalyser, "deviceConditionSet">, UARamanSpectrometer_Base {
}