// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UASimpleScale, UASimpleScale_Base } from "./ua_simple_scale"
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
    openDraftShields?: UAMethod;
    startCalibration?: UAMethod;
    startIonisator?: UAMethod;
    startLeveling?: UAMethod;
    stopIonisator?: UAMethod;
}
export interface UALaboratoryScale extends UASimpleScale, UALaboratoryScale_Base {
}