import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { UASimpleScale, UASimpleScale_Base } from "./ua_simple_scale.js";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a laboratory scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LaboratoryScaleType i=15                                    |
 * |isAbstract      |false                                                       |
 */
export interface UALaboratoryScale_Base extends UASimpleScale_Base {
    /**
     * calibrationNeeded
     * Defines if a calibration procedure is needed and
     * the current process should be paused.
     */
    calibrationNeeded?: UAProperty<boolean, DataType.Boolean>;
    /**
     * calibrationRunning
     * Defines if a calibration procedure is running.
     */
    calibrationRunning?: UAProperty<boolean, DataType.Boolean>;
    /**
     * closeDraftShields
     * Method to close a certain or all draft shields.
     */
    closeDraftShields?: UAMethod;
    /**
     * draftShieldLeftClosed
     * Defines if the left draft shield is closed.
     */
    draftShieldLeftClosed?: UAProperty<boolean, DataType.Boolean>;
    /**
     * draftShieldRightClosed
     * Defines if the right draft shield is closed.
     */
    draftShieldRightClosed?: UAProperty<boolean, DataType.Boolean>;
    /**
     * draftShieldTopClosed
     * Defines if the top draft shield is closed.
     */
    draftShieldTopClosed?: UAProperty<boolean, DataType.Boolean>;
    ionisatorRunning?: UAProperty<boolean, DataType.Boolean>;
    /**
     * levelingRunning
     * Defines if a levelling process is running.
     */
    levelingRunning?: UAProperty<boolean, DataType.Boolean>;
    /**
     * openDraftShields
     * Method to open a certain or all draft shields.
     */
    openDraftShields?: UAMethod;
    /**
     * startCalibration
     * Method to start the automatic calibration
     * procedure.
     */
    startCalibration?: UAMethod;
    /**
     * startIonisator
     * Method to start the ionization process.
     */
    startIonisator?: UAMethod;
    /**
     * startLeveling
     * Method to start the automatic leveling procedure
     * of the scale.
     */
    startLeveling?: UAMethod;
    /**
     * stopIonisator
     * Method to stop the ionization process.
     */
    stopIonisator?: UAMethod;
}
export interface UALaboratoryScale extends UASimpleScale, UALaboratoryScale_Base {}