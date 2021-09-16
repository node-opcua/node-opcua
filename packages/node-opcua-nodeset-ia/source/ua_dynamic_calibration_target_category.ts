// ----- this file has been automatically generated - do not edit
import { UABaseCalibrationTargetCategory, UABaseCalibrationTargetCategory_Base } from "./ua_base_calibration_target_category"
/**
 * Characterizes a calibration target to be used
 * together with a measurement instrument, that
 * determines the values to be calibrated. It can be
 * a piece created during the normal production
 * process or an item specifically created for
 * calibration purposes. The calibration target
 * represents an individual piece or item, that is,
 * if a new piece should be used or item is created,
 * a new Object of this ObjectType is created.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:DynamicCalibrationTargetCategoryType ns=9;i=1018|
 * |isAbstract      |false                                             |
 */
export interface UADynamicCalibrationTargetCategory_Base extends UABaseCalibrationTargetCategory_Base {
}
export interface UADynamicCalibrationTargetCategory extends UABaseCalibrationTargetCategory, UADynamicCalibrationTargetCategory_Base {
}