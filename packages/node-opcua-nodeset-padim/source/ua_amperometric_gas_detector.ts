import type { UAPADIM_deviceConditionSet } from "./ua_padim";
import type { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AmperometricGasDetectorType i=1098                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAmperometricGasDetector_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UAPADIM_deviceConditionSet;
}
export interface UAAmperometricGasDetector extends Omit<UAProcessAnalyser, "deviceConditionSet">, UAAmperometricGasDetector_Base {}