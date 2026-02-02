// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAPADIM_deviceConditionSet } from "./ua_padim"
import { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser"
export interface UADiodeArraySpectrometer_deviceConditionSet extends UAPADIM_deviceConditionSet { // Object
      watchdog?: UAProperty<boolean, DataType.Boolean>;
      remainingDataStorageCapacity?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DiodeArraySpectrometerType i=1102                           |
 * |isAbstract      |false                                                       |
 */
export interface UADiodeArraySpectrometer_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UADiodeArraySpectrometer_deviceConditionSet;
}
export interface UADiodeArraySpectrometer extends Omit<UAProcessAnalyser, "deviceConditionSet">, UADiodeArraySpectrometer_Base {
}