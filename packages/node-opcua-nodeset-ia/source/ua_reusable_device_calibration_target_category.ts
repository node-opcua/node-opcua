import type { UAReusableCalibrationTargetCategory, UAReusableCalibrationTargetCategory_Base } from "./ua_reusable_calibration_target_category";

// ----- this file has been automatically generated - do not edit
/**
 * Categorizes a calibration target to be a reusable
 * device that produces a certain environment like
 * pressure that can be used for calibration.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ReusableDeviceCalibrationTargetCategoryType i=1016          |
 * |isAbstract      |false                                                       |
 */
export type UAReusableDeviceCalibrationTargetCategory_Base = UAReusableCalibrationTargetCategory_Base;
export interface UAReusableDeviceCalibrationTargetCategory extends UAReusableCalibrationTargetCategory, UAReusableDeviceCalibrationTargetCategory_Base {}