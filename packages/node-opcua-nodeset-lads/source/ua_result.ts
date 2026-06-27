import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { DTKeyValue } from "./dt_key_value";
import type { DTSampleInfo } from "./dt_sample_info";
import type { UAProgramTemplate } from "./ua_program_template";
import type { UAResultFileSet } from "./ua_result_file_set";
import type { UAVariableSet } from "./ua_variable_set";

// ----- this file has been automatically generated - do not edit

/**
 * The ResultType  provides the results of a
 * specific program run.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultType i=1021                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAResult_Base {
    /**
     * applicationUri
     * ApplicationUri provides information about the
     * remote client that initiated the program run
     * generating the result. It must align with the
     * ApplicationUri in the ApplicationDescription
     * (refer to OPC 10000-4 section 7.1) of a Session
     * (refer to OPC 10000-4 section 5.6.2). In
     * instances where the program was initiated locally
     * and cannot be attributed to an OPC UA Client, the
     * ApplicationUri of the Server should be utilized.
     */
    applicationUri: UAProperty<UAString, DataType.String>;
    /**
     * $description
     * Description is the human-readable description of
     * the specific program run that created this result
     * and the result itself.
     */
    "$description": UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * fileSet
     * The ResultFileSetType is used for organising
     * ResultFileType objects in an unordered list
     * structure.
     */
    fileSet: UAResultFileSet;
    /**
     * supervisoryJobId
     * SupervisoryJobId is the identifier for the
     * execution of a specific workflow consisting of
     * one or multiple tasks. It is provided as an
     * Argument of the StartProgram() Method which
     * initiates the program run.
     */
    supervisoryJobId: UAProperty<UAString, DataType.String>;
    /**
     * samples
     * Samples is a list of sample-specific information
     * with SampleInfoType provided when calling the
     * StartProgram() Method, which can be utilized when
     * performing the program run and provided in the
     * ResultType object for documentation and
     * traceability purposes.
     */
    samples: UAProperty<DTSampleInfo[], DataType.ExtensionObject>;
    /**
     * started
     * Started is the timestamp of when the program was
     * started.
     */
    started: UAProperty<Date, DataType.DateTime>;
    /**
     * stopped
     * Stopped is the timestamp of when the program was
     * stopped.
     */
    stopped: UAProperty<Date, DataType.DateTime>;
    /**
     * programTemplate
     * ProgramTemplate is an immutable copy of the
     * Program Template attributes with which the result
     * was generated and is provided for documentation
     * and traceability purposes. This copy will not
     * change even if the original is changed.
     */
    programTemplate: UAProgramTemplate;
    /**
     * user
     * User provides information about the remote client
     * user that initiated the program run generating
     * the result. User must be a human-readable value,
     * based on the UserIdentityToken (refer to OPC
     * 10000-4 section 7.36). In instances where the
     * program was initiated locally and cannot be
     * attributed to an OPC UA Client, the local user of
     * the Server should be utilized.
     */
    user: UAProperty<UAString, DataType.String>;
    /**
     * variableSet
     * The VariableSetType is used for storing
     * additional sample data that was created during a
     * run.
     */
    variableSet: UAVariableSet;
    /**
     * properties
     * Properties is a list of key-value pairs with
     * KeyValueType, provided when calling the
     * StartProgram() Method, which can be utilized when
     * performing the program run and provided in the
     * ResultType object for documentation and
     * traceability purposes.
     */
    properties: UAProperty<DTKeyValue[], DataType.ExtensionObject>;
    /**
     * supervisoryTaskId
     * SupervisoryTaskId is the unique identifier of the
     * specific Task in the supervisory system to which
     * the result belongs. It is provided as an Argument
     * of the StartProgram() Method which initiates the
     * program run.
     */
    supervisoryTaskId: UAProperty<UAString, DataType.String>;
    /**
     * deviceProgramRunId
     * DeviceProgramRunId is the internal program
     * identifier assigned by the Device to the program
     * run generating this result. It is used to
     * identify a Result object and is returned to the
     * Client when the StartProgram Method is called.
     */
    deviceProgramRunId?: UAProperty<UAString, DataType.String>;
    /**
     * totalRuntime
     * TotalRuntime is the total time of program
     * execution including paused states. Paused states
     * are the held State and the suspended State. This
     * information is retrieved from the
     * ActiveProgramType.
     */
    totalRuntime?: UAProperty<number, DataType.Double>;
    /**
     * totalPauseTime
     * TotalPauseTime is the time the program execution
     * for the result was in a paused state. Paused
     * states are the Held State and the Suspended
     * State. This information is retrieved from the
     * ActiveProgramType.
     */
    totalPauseTime?: UAProperty<number, DataType.Double>;
    /**
     * estimatedRuntime
     * EstimatedRuntime is the time that was estimated
     * for the program execution. This information is
     * retrieved from the ActiveProgramType.
     */
    estimatedRuntime?: UAProperty<number, DataType.Double>;
}
export interface UAResult extends UAObject, UAResult_Base {}