// ----- this file has been automatically generated - do not edit
import { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser"
import { UAPADIM_deviceConditionSet } from "./ua_padim"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CatalyticBeadSensorType i=1099                              |
 * |isAbstract      |false                                                       |
 */
export interface UACatalyticBeadSensor_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UAPADIM_deviceConditionSet;
}
export interface UACatalyticBeadSensor extends Omit<UAProcessAnalyser, "deviceConditionSet">, UACatalyticBeadSensor_Base {
}