// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { Int32, Byte, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UABaseCalibrationTargetCategory } from "./ua_base_calibration_target_category"
export interface UACalibrationTarget_identification extends UAFunctionalGroup { // Object
      assetId?: UAProperty<UAString, /*z*/DataType.String>;
      componentName?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
      deviceClass?: UAProperty<UAString, /*z*/DataType.String>;
      deviceManual?: UAProperty<UAString, /*z*/DataType.String>;
      deviceRevision?: UAProperty<UAString, /*z*/DataType.String>;
      hardwareRevision?: UAProperty<UAString, /*z*/DataType.String>;
      manufacturer?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
      manufacturerUri?: UAProperty<UAString, /*z*/DataType.String>;
      model?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
      productCode?: UAProperty<UAString, /*z*/DataType.String>;
      productInstanceUri?: UAProperty<UAString, /*z*/DataType.String>;
      revisionCounter?: UAProperty<Int32, /*z*/DataType.Int32>;
      serialNumber?: UAProperty<UAString, /*z*/DataType.String>;
      softwareRevision?: UAProperty<UAString, /*z*/DataType.String>;
}
/**
 * Provides information about a calibration target.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:CalibrationTargetType ns=9;i=1019               |
 * |isAbstract      |false                                             |
 */
export interface UACalibrationTarget_Base {
    /**
     * calibrationTargetCategory
     * Defines what category the calibration target is
     * of.
     */
    calibrationTargetCategory: UABaseCalibrationTargetCategory;
    /**
     * calibrationTargetFeatures
     * A folder containing information about the
     * features of a calibration target, that is, what
     * can be calibrated with the calibration target.
     */
    calibrationTargetFeatures: UAFolder;
    /**
     * certificateUri
     * Contains the Uri of a certificate of the
     * calibration target, in case the calibration
     * target is certified and the information
     * available. Otherwise, the Property should be
     * omitted.
     */
    certificateUri?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * identification
     * Provides identification information.
     */
    identification: UACalibrationTarget_identification;
    /**
     * lastValidationDate
     * Provides the date, the calibration target was
     * validated the last time. If there is no specific
     * validation date known, the date when the
     * calibration target was bought or created should
     * be used.
     */
    lastValidationDate?: UAProperty<Date, /*z*/DataType.DateTime>;
    /**
     * nextValidationDate
     * Provides the date, when the calibration target
     * should be validated the next time. If this date
     * is not known, the Property should be omitted.
     * Note: Potentially the NextValidationDate is in
     * the past, when the next validation did not take
     * place.
     */
    nextValidationDate?: UAProperty<Date, /*z*/DataType.DateTime>;
    /**
     * operationalConditions
     * A folder containing information about operational
     * conditions of the calibration target. For
     * example, it might provide in what ranges of
     * humidity the calibration target can be operated.
     * It might also provide correction information, for
     * example, depending on the temperature the
     * calibration values need to be corrected (in case
     * of a length, the length might increase with high
     * temperatures). If no operational conditions are
     * provided, this folder should be omitted.
     */
    operationalConditions?: UAFolder;
    /**
     * quality
     * Provides the quality of the calibration target in
     * percentage, this is, the value shall be between 0
     * and 100. 100 means the highest quality, 0 the
     * lowest. The semantic of the quality is
     * application-specific.
     */
    quality?: UAProperty<Byte, /*z*/DataType.Byte>;
}
export interface UACalibrationTarget extends UAObject, UACalibrationTarget_Base {
}