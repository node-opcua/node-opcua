// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAPADIM_deviceConditionSet } from "./ua_padim"
import { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser"
export interface UAFtnirOrFtirSpectrometer_deviceConditionSet extends UAPADIM_deviceConditionSet { // Object
      watchdog?: UAProperty<boolean, DataType.Boolean>;
      remainingDataStorageCapacity?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FtnirOrFtirSpectrometerType i=1105                          |
 * |isAbstract      |false                                                       |
 */
export interface UAFtnirOrFtirSpectrometer_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UAFtnirOrFtirSpectrometer_deviceConditionSet;
}
export interface UAFtnirOrFtirSpectrometer extends Omit<UAProcessAnalyser, "deviceConditionSet">, UAFtnirOrFtirSpectrometer_Base {
}