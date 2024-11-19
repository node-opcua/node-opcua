// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UInt32, Int32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UAFile } from "node-opcua-nodeset-ua/source/ua_file"
import { EnumDeviceHealth } from "node-opcua-nodeset-di/source/enum_device_health"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UADevice, UADevice_Base } from "node-opcua-nodeset-di/source/ua_device"
import { EnumExecutionCycle } from "./enum_execution_cycle"
import { EnumAcquisitionResultStatus } from "./enum_acquisition_result_status"
import { UAAnalyserDeviceStateMachine } from "./ua_analyser_device_state_machine"
export interface UAAnalyserDevice_parameterSet extends UAObject { // Object
      /**
       * diagnosticStatus
       * General health status of the analyser
       */
      diagnosticStatus: UADataItem<EnumDeviceHealth, DataType.Int32>;
      /**
       * configData
       * Optional analyser device large configuration
       */
      configData?: UAFile;
}
export interface UAAnalyserDevice_methodSet extends UAObject { // Object
      getConfiguration: UAMethod;
      setConfiguration: UAMethod;
      getConfigDataDigest: UAMethod;
      compareConfigDataDigest: UAMethod;
      resetAllChannels: UAMethod;
      startAllChannels: UAMethod;
      stopAllChannels: UAMethod;
      abortAllChannels: UAMethod;
      gotoOperating: UAMethod;
      gotoMaintenance: UAMethod;
}
export interface UAAnalyserDevice_identification extends UAFunctionalGroup { // Object
      /**
       * manufacturer
       * Name of the company that manufactured the device
       */
      manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * model
       * Model name of the device
       */
      model: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * serialNumber
       * Identifier that uniquely identifies, within a
       * manufacturer, a device instance
       */
      serialNumber: UAProperty<UAString, DataType.String>;
}
export interface UAAnalyserDevice_configuration extends UAFunctionalGroup { // Object
      /**
       * configData
       * Optional analyser device large configuration
       */
      configData?: UAFile;
}
export interface UAAnalyserDevice_status extends UAFunctionalGroup { // Object
      /**
       * diagnosticStatus
       * General health status of the analyser
       */
      diagnosticStatus: UADataItem<EnumDeviceHealth, DataType.Int32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalyserDeviceType i=1001                                   |
 * |isAbstract      |true                                                        |
 */
export interface UAAnalyserDevice_Base extends UADevice_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UAAnalyserDevice_parameterSet;
    /**
     * methodSet
     * Flat list of Methods
     */
    methodSet: UAAnalyserDevice_methodSet;
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification: UAAnalyserDevice_identification;
    configuration: UAAnalyserDevice_configuration;
    status: UAAnalyserDevice_status;
    factorySettings: UAFunctionalGroup;
    analyserStateMachine: UAAnalyserDeviceStateMachine;
   // PlaceHolder for $ChannelIdentifier$
   // PlaceHolder for $AccessorySlotIdentifier$
}
export interface UAAnalyserDevice extends Omit<UADevice, "parameterSet"|"methodSet"|"identification">, UAAnalyserDevice_Base {
}