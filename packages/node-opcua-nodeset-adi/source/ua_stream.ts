// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { EnumDeviceHealth } from "node-opcua-nodeset-di/source/enum_device_health"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/source/ua_topology_element"
import { EnumExecutionCycle } from "./enum_execution_cycle"
import { EnumAcquisitionResultStatus } from "./enum_acquisition_result_status"
export interface UAStream_parameterSet extends UAObject { // Object
      /**
       * isEnabled
       * True if this stream maybe used to perform
       * acquisition
       */
      isEnabled: UADataItem<boolean, DataType.Boolean>;
      /**
       * isForced
       * True if this stream is forced, which means that
       * is the only Stream on this AnalyserChannel that
       * can be used to perform acquisition
       */
      isForced?: UADataItem<boolean, DataType.Boolean>;
      /**
       * diagnosticStatus
       * Stream health status
       */
      diagnosticStatus: UADataItem<EnumDeviceHealth, DataType.Int32>;
      /**
       * lastCalibrationTime
       * Time at which the last calibration was run
       */
      lastCalibrationTime?: UADataItem<Date, DataType.DateTime>;
      /**
       * lastValidationTime
       * Time at which the last validation was run
       */
      lastValidationTime?: UADataItem<Date, DataType.DateTime>;
      /**
       * lastSampleTime
       * Time at which the last sample was acquired
       */
      lastSampleTime: UADataItem<Date, DataType.DateTime>;
      /**
       * timeBetweenSamples
       * Number of milliseconds between two consecutive
       * starts of acquisition
       */
      timeBetweenSamples?: UAAnalogItem<number, DataType.Double>;
      /**
       * isActive
       * True if this stream is actually running,
       * acquiring data
       */
      isActive: UADataItem<boolean, DataType.Boolean>;
      /**
       * executionCycle
       * Indicates which Execution cycle is in progress
       */
      executionCycle: UADataItem<EnumExecutionCycle, DataType.Int32>;
      /**
       * executionCycleSubcode
       * Indicates which Execution cycle subcode is in
       * progress
       */
      executionCycleSubcode: UAMultiStateDiscrete<any, any>;
      /**
       * progress
       * Indicates the progress of an acquisition in terms
       * of percentage of completion. Its value shall be
       * between 0 and 100.
       */
      progress: UADataItem<number, DataType.Float>;
      /**
       * acquisitionCounter
       * Simple counter incremented after each Sampling
       * acquisition performed on this Stream
       */
      acquisitionCounter: UAAnalogItem<UInt32, DataType.UInt32>;
      /**
       * acquisitionResultStatus
       * Quality of the acquisition
       */
      acquisitionResultStatus: UADataItem<EnumAcquisitionResultStatus, DataType.Int32>;
      /**
       * rawData
       * Raw data produced as a result of data acquisition
       * on the Stream
       */
      rawData?: UADataItem<any, any>;
      /**
       * scaledData
       * Scaled data produced as a result of data
       * acquisition on the Stream and application of the
       * analyser model
       */
      scaledData: UADataItem<any, any>;
      /**
       * offset
       * Difference in milliseconds between the start of
       * sample extraction and the start of the analysis.
       */
      offset?: UADataItem<number, DataType.Double>;
      /**
       * acquisitionEndTime
       * The end time of the AnalyseSample or
       * AnalyseCalibrationSample or
       * AnalyseValidationSample state of the
       * AnalyserChannel_OperatingModeExecuteSubStateMachine
       * state machine
       */
      acquisitionEndTime: UADataItem<Date, DataType.DateTime>;
      /**
       * campaignId
       * Defines the current campaign
       */
      campaignId?: UADataItem<UAString, DataType.String>;
      /**
       * batchId
       * Defines the current batch
       */
      batchId?: UADataItem<UAString, DataType.String>;
      /**
       * subBatchId
       * Defines the current sub-batch
       */
      subBatchId?: UADataItem<UAString, DataType.String>;
      /**
       * lotId
       * Defines the current lot
       */
      lotId?: UADataItem<UAString, DataType.String>;
      /**
       * materialId
       * Defines the current material
       */
      materialId?: UADataItem<UAString, DataType.String>;
      /**
       * process
       * Current Process name
       */
      process?: UADataItem<UAString, DataType.String>;
      /**
       * unit
       * Current Unit name
       */
      unit?: UADataItem<UAString, DataType.String>;
      /**
       * operation
       * Current Operation name
       */
      operation?: UADataItem<UAString, DataType.String>;
      /**
       * phase
       * Current Phase name
       */
      phase?: UADataItem<UAString, DataType.String>;
      /**
       * userId
       * Login name of the user who is logged on at the
       * device console
       */
      userId?: UADataItem<UAString, DataType.String>;
      /**
       * sampleId
       * Identifier for the sample
       */
      sampleId?: UADataItem<UAString, DataType.String>;
}
export interface UAStream_configuration extends UAFunctionalGroup { // Object
      /**
       * isEnabled
       * True if this stream maybe used to perform
       * acquisition
       */
      isEnabled: UADataItem<boolean, DataType.Boolean>;
      /**
       * isForced
       * True if this stream is forced, which means that
       * is the only Stream on this AnalyserChannel that
       * can be used to perform acquisition
       */
      isForced?: UADataItem<boolean, DataType.Boolean>;
}
export interface UAStream_status extends UAFunctionalGroup { // Object
      /**
       * diagnosticStatus
       * Stream health status
       */
      diagnosticStatus: UADataItem<EnumDeviceHealth, DataType.Int32>;
      /**
       * lastCalibrationTime
       * Time at which the last calibration was run
       */
      lastCalibrationTime?: UADataItem<Date, DataType.DateTime>;
      /**
       * lastValidationTime
       * Time at which the last validation was run
       */
      lastValidationTime?: UADataItem<Date, DataType.DateTime>;
      /**
       * lastSampleTime
       * Time at which the last sample was acquired
       */
      lastSampleTime: UADataItem<Date, DataType.DateTime>;
}
export interface UAStream_acquisitionSettings extends UAFunctionalGroup { // Object
      /**
       * timeBetweenSamples
       * Number of milliseconds between two consecutive
       * starts of acquisition
       */
      timeBetweenSamples?: UAAnalogItem<number, DataType.Double>;
}
export interface UAStream_acquisitionStatus extends UAFunctionalGroup { // Object
      /**
       * isActive
       * True if this stream is actually running,
       * acquiring data
       */
      isActive: UADataItem<boolean, DataType.Boolean>;
      /**
       * executionCycle
       * Indicates which Execution cycle is in progress
       */
      executionCycle: UADataItem<EnumExecutionCycle, DataType.Int32>;
      /**
       * executionCycleSubcode
       * Indicates which Execution cycle subcode is in
       * progress
       */
      executionCycleSubcode: UAMultiStateDiscrete<any, any>;
      /**
       * progress
       * Indicates the progress of an acquisition in terms
       * of percentage of completion. Its value shall be
       * between 0 and 100.
       */
      progress: UADataItem<number, DataType.Float>;
}
export interface UAStream_acquisitionData extends UAFunctionalGroup { // Object
      /**
       * acquisitionCounter
       * Simple counter incremented after each Sampling
       * acquisition performed on this Stream
       */
      acquisitionCounter: UAAnalogItem<UInt32, DataType.UInt32>;
      /**
       * acquisitionResultStatus
       * Quality of the acquisition
       */
      acquisitionResultStatus: UADataItem<EnumAcquisitionResultStatus, DataType.Int32>;
      /**
       * rawData
       * Raw data produced as a result of data acquisition
       * on the Stream
       */
      rawData?: UADataItem<any, any>;
      /**
       * scaledData
       * Scaled data produced as a result of data
       * acquisition on the Stream and application of the
       * analyser model
       */
      scaledData: UADataItem<any, any>;
      /**
       * offset
       * Difference in milliseconds between the start of
       * sample extraction and the start of the analysis.
       */
      offset?: UADataItem<number, DataType.Double>;
      /**
       * acquisitionEndTime
       * The end time of the AnalyseSample or
       * AnalyseCalibrationSample or
       * AnalyseValidationSample state of the
       * AnalyserChannel_OperatingModeExecuteSubStateMachine
       * state machine
       */
      acquisitionEndTime: UADataItem<Date, DataType.DateTime>;
}
export interface UAStream_context extends UAFunctionalGroup { // Object
      /**
       * campaignId
       * Defines the current campaign
       */
      campaignId?: UADataItem<UAString, DataType.String>;
      /**
       * batchId
       * Defines the current batch
       */
      batchId?: UADataItem<UAString, DataType.String>;
      /**
       * subBatchId
       * Defines the current sub-batch
       */
      subBatchId?: UADataItem<UAString, DataType.String>;
      /**
       * lotId
       * Defines the current lot
       */
      lotId?: UADataItem<UAString, DataType.String>;
      /**
       * materialId
       * Defines the current material
       */
      materialId?: UADataItem<UAString, DataType.String>;
      /**
       * process
       * Current Process name
       */
      process?: UADataItem<UAString, DataType.String>;
      /**
       * unit
       * Current Unit name
       */
      unit?: UADataItem<UAString, DataType.String>;
      /**
       * operation
       * Current Operation name
       */
      operation?: UADataItem<UAString, DataType.String>;
      /**
       * phase
       * Current Phase name
       */
      phase?: UADataItem<UAString, DataType.String>;
      /**
       * userId
       * Login name of the user who is logged on at the
       * device console
       */
      userId?: UADataItem<UAString, DataType.String>;
      /**
       * sampleId
       * Identifier for the sample
       */
      sampleId?: UADataItem<UAString, DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:StreamType ns=2;i=1010                          |
 * |isAbstract      |false                                             |
 */
export interface UAStream_Base extends UATopologyElement_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UAStream_parameterSet;
   // PlaceHolder for $GroupIdentifier$
    configuration: UAStream_configuration;
    status: UAStream_status;
    acquisitionSettings: UAStream_acquisitionSettings;
    acquisitionStatus: UAStream_acquisitionStatus;
    acquisitionData: UAStream_acquisitionData;
    chemometricModelSettings: UAFunctionalGroup;
    context: UAStream_context;
}
export interface UAStream extends Omit<UATopologyElement, "parameterSet"|"$GroupIdentifier$">, UAStream_Base {
}