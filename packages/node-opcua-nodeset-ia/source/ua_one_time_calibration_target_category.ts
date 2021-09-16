// ----- this file has been automatically generated - do not edit
import { UABaseCalibrationTargetCategory, UABaseCalibrationTargetCategory_Base } from "./ua_base_calibration_target_category"
/**
 * Categorizes a calibration target to be used only
 * once, for example because the calibration
 * destroys the target. Typically, Objects of this
 * ObjectType do not represent one individual
 * calibration target, but a batch of calibration
 * targets with the same characteristics.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:OneTimeCalibrationTargetCategoryType ns=9;i=1017|
 * |isAbstract      |false                                             |
 */
export interface UAOneTimeCalibrationTargetCategory_Base extends UABaseCalibrationTargetCategory_Base {
}
export interface UAOneTimeCalibrationTargetCategory extends UABaseCalibrationTargetCategory, UAOneTimeCalibrationTargetCategory_Base {
}