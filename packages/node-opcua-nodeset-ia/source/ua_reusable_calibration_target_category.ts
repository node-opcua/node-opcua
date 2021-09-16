// ----- this file has been automatically generated - do not edit
import { UABaseCalibrationTargetCategory, UABaseCalibrationTargetCategory_Base } from "./ua_base_calibration_target_category"
/**
 * Categorizes a calibration target to be reused
 * several times. For example, a calibration target
 * like a meter, that is bought specifically for
 * calibration and not destroyed by an individual
 * usage is of this category.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:ReusableCalibrationTargetCategoryType ns=9;i=1015|
 * |isAbstract      |false                                             |
 */
export interface UAReusableCalibrationTargetCategory_Base extends UABaseCalibrationTargetCategory_Base {
}
export interface UAReusableCalibrationTargetCategory extends UABaseCalibrationTargetCategory, UAReusableCalibrationTargetCategory_Base {
}