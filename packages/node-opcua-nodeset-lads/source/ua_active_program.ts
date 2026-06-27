import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DTNameNodeId } from "node-opcua-nodeset-amb/dist/dt_name_node_id";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The ActiveProgramType specifies the current state
 * of operation of a FunctionalUnit. It provides
 * context and information about the currently
 * active program on the device. This allows users
 * to follow the progress of a program run in a
 * standardized fashion by organising steps into a
 * flat, linear sequence.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ActiveProgramType i=1040                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAActiveProgram_Base {
    /**
     * currentPauseTime
     * CurrentPauseTime is the current pause-time of the
     * program- run. The CurrentPauseTime is set to 0 at
     * the start of the program and is counted upwards
     * when the program run is in a Paused state. The
     * Paused state is an aggregation of the Suspended
     * state and the Held State.
     */
    currentPauseTime?: UAProperty<number, DataType.Double>;
    /**
     * currentRuntime
     * CurrentRuntime is the current run-time of the
     * program -run. The CurrentRunTime is set to 0 at
     * the start of the program and is counted upwards
     * as long as the program run is not in a Paused
     * state. The Paused state is an aggregation of the
     * Suspended state and the Held state.
     */
    currentRuntime?: UAProperty<number, DataType.Double>;
    /**
     * currentStepName
     * CurrentStepName is the name of the current step.
     */
    currentStepName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * currentStepNumber
     * CurrentStepNumber is the number/index of the
     * current step (incremented whenever the next step
     * is entered). The CurrentStepNumber starts with 1.
     */
    currentStepNumber?: UAProperty<UInt32, DataType.UInt32>;
    /**
     * currentStepRuntime
     * CurrentStepRuntime is the runtime of the current
     * step. The CurrentStepRunTime is set to 0 at the
     * start of the current step and is counted upwards
     * as long as the program run is not in Paused
     * state. The Paused state is an aggregation of the
     * Suspended state and the Held State.
     */
    currentStepRuntime?: UAProperty<number, DataType.Double>;
    /**
     * estimatedRuntime
     * EstimatedRuntime is the estimated run-time of the
     * current program run. If the runtime cannot be
     * estimated, the StatusCode BadNoData should be
     * sent.
     */
    estimatedRuntime?: UAProperty<number, DataType.Double>;
    /**
     * estimatedStepNumbers
     * EstimatedStepNumbers are the estimated total
     * number of steps of the current program run. If
     * the total number cannot be estimated, the
     * StatusCode BadNoData should be sent.
     */
    estimatedStepNumbers?: UAProperty<UInt32, DataType.UInt32>;
    /**
     * estimatedStepRuntime
     * EstimatedStepRuntime is the estimated run-time of
     * the current program-step. If the run-time cannot
     * estimate, the StatusCode BadNoData should sent.
     */
    estimatedStepRuntime?: UAProperty<number, DataType.Double>;
    /**
     * deviceProgramRunId
     * DeviceProgramRunId represents a device-specific
     * unique internal identifier for this program run.
     * Its value shall be identical to the return value
     * of the last call to the FunctionalUnit’s
     * StartProgram() Method. It is used to identify the
     * result object corresponding to this program run
     * within the FunctionalUnit’s result set.
     */
    deviceProgramRunId?: UAProperty<UAString, DataType.String>;
    /**
     * currentProgramTemplate
     * CurrentProgramTemplate provides the template-id
     * as well as the node-id of the currently executed
     * program.
     */
    currentProgramTemplate?: UAProperty<DTNameNodeId, DataType.ExtensionObject>;
}
export interface UAActiveProgram extends UAObject, UAActiveProgram_Base {}