// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_selectExecutionCycle extends Omit<UAInitialState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForCalibrationTrigger extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_extractCalibrationSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_prepareCalibrationSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_analyseCalibrationSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForValidationTrigger extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_extractValidationSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_prepareValidationSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_analyseValidationSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForSampleTrigger extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_extractSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_prepareSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_analyseSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForDiagnosticTrigger extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_diagnostic extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForCleaningTrigger extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_cleaning extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_publishResults extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_ejectGrabSample extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_cleanupSamplingSystem extends Omit<UAState, "stateNumber"> { // Object
      stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:AnalyserChannel_OperatingModeExecuteSubStateMachineType ns=2;i=1009|
 * |isAbstract      |false                                             |
 */
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * selectExecutionCycle
     * This pseudo-state is used to decide which
     * execution path shall be taken.
     */
    selectExecutionCycle: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_selectExecutionCycle;
    /**
     * waitForCalibrationTrigger
     * Wait until the analyser channel is ready to
     * perform the Calibration acquisition cycle
     */
    waitForCalibrationTrigger: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForCalibrationTrigger;
    /**
     * extractCalibrationSample
     * Collect / setup the sampling system to perform
     * the acquisition cycle of a Calibration cycle
     */
    extractCalibrationSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_extractCalibrationSample;
    /**
     * prepareCalibrationSample
     * Prepare the Calibration sample for the
     * AnalyseCalibrationSample state
     */
    prepareCalibrationSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_prepareCalibrationSample;
    /**
     * analyseCalibrationSample
     * Perform the analysis of the Calibration Sample
     */
    analyseCalibrationSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_analyseCalibrationSample;
    /**
     * waitForValidationTrigger
     * Wait until the analyser channel is ready to
     * perform the Validation acquisition cycle
     */
    waitForValidationTrigger: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForValidationTrigger;
    /**
     * extractValidationSample
     * Collect / setup the sampling system to perform
     * the acquisition cycle of a Validation cycle
     */
    extractValidationSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_extractValidationSample;
    /**
     * prepareValidationSample
     * Prepare the Validation sample for the
     * AnalyseValidationSample state
     */
    prepareValidationSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_prepareValidationSample;
    /**
     * analyseValidationSample
     * Perform the analysis of the Validation Sample
     */
    analyseValidationSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_analyseValidationSample;
    /**
     * waitForSampleTrigger
     * Wait until the analyser channel is ready to
     * perform the Sample acquisition cycle
     */
    waitForSampleTrigger: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForSampleTrigger;
    /**
     * extractSample
     * Collect the Sample from the process
     */
    extractSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_extractSample;
    /**
     * prepareSample
     * Prepare the Sample for the AnalyseSample state
     */
    prepareSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_prepareSample;
    /**
     * analyseSample
     * Perform the analysis of the Sample
     */
    analyseSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_analyseSample;
    /**
     * waitForDiagnosticTrigger
     * Wait until the analyser channel is ready to
     * perform the diagnostic cycle,
     */
    waitForDiagnosticTrigger: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForDiagnosticTrigger;
    /**
     * diagnostic
     * Perform the diagnostic cycle.
     */
    diagnostic: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_diagnostic;
    /**
     * waitForCleaningTrigger
     * Wait until the analyser channel is ready to
     * perform the cleaning cycle,
     */
    waitForCleaningTrigger: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_waitForCleaningTrigger;
    /**
     * cleaning
     * Perform the cleaning cycle.
     */
    cleaning: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_cleaning;
    /**
     * publishResults
     * Publish the results of the previous acquisition
     * cycle
     */
    publishResults: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_publishResults;
    /**
     * ejectGrabSample
     * The Sample that was just analysed is ejected from
     * the system to allow the operator or another
     * system to grab it
     */
    ejectGrabSample: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_ejectGrabSample;
    /**
     * cleanupSamplingSystem
     * Cleanup the sampling sub-system to be ready for
     * the next acquisition
     */
    cleanupSamplingSystem: UAAnalyserChannel_OperatingModeExecuteSubStateMachine_cleanupSamplingSystem;
    selectExecutionCycleToWaitForCalibrationTriggerTransition: UATransition;
    waitForCalibrationTriggerToExtractCalibrationSampleTransition: UATransition;
    extractCalibrationSampleTransition: UATransition;
    extractCalibrationSampleToPrepareCalibrationSampleTransition: UATransition;
    prepareCalibrationSampleTransition: UATransition;
    prepareCalibrationSampleToAnalyseCalibrationSampleTransition: UATransition;
    analyseCalibrationSampleTransition: UATransition;
    analyseCalibrationSampleToPublishResultsTransition: UATransition;
    selectExecutionCycleToWaitForValidationTriggerTransition: UATransition;
    waitForValidationTriggerToExtractValidationSampleTransition: UATransition;
    extractValidationSampleTransition: UATransition;
    extractValidationSampleToPrepareValidationSampleTransition: UATransition;
    prepareValidationSampleTransition: UATransition;
    prepareValidationSampleToAnalyseValidationSampleTransition: UATransition;
    analyseValidationSampleTransition: UATransition;
    analyseValidationSampleToPublishResultsTransition: UATransition;
    selectExecutionCycleToWaitForSampleTriggerTransition: UATransition;
    waitForSampleTriggerToExtractSampleTransition: UATransition;
    extractSampleTransition: UATransition;
    extractSampleToPrepareSampleTransition: UATransition;
    prepareSampleTransition: UATransition;
    prepareSampleToAnalyseSampleTransition: UATransition;
    analyseSampleTransition: UATransition;
    analyseSampleToPublishResultsTransition: UATransition;
    selectExecutionCycleToWaitForDiagnosticTriggerTransition: UATransition;
    waitForDiagnosticTriggerToDiagnosticTransition: UATransition;
    diagnosticTransition: UATransition;
    diagnosticToPublishResultsTransition: UATransition;
    selectExecutionCycleToWaitForCleaningTriggerTransition: UATransition;
    waitForCleaningTriggerToCleaningTransition: UATransition;
    cleaningTransition: UATransition;
    cleaningToPublishResultsTransition: UATransition;
    publishResultsToCleanupSamplingSystemTransition: UATransition;
    publishResultsToEjectGrabSampleTransition: UATransition;
    ejectGrabSampleTransition: UATransition;
    ejectGrabSampleToCleanupSamplingSystemTransition: UATransition;
    cleanupSamplingSystemTransition: UATransition;
    cleanupSamplingSystemToSelectExecutionCycleTransition: UATransition;
}
export interface UAAnalyserChannel_OperatingModeExecuteSubStateMachine extends UAFiniteStateMachine, UAAnalyserChannel_OperatingModeExecuteSubStateMachine_Base {
}