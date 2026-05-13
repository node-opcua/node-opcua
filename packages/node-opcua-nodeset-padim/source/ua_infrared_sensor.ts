import type { UAPADIM_deviceConditionSet } from "./ua_padim";
import type { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |InfraredSensorType i=1097                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAInfraredSensor_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UAPADIM_deviceConditionSet;
}
export interface UAInfraredSensor extends Omit<UAProcessAnalyser, "deviceConditionSet">, UAInfraredSensor_Base {}