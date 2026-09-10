import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { EnumDeviceHealth } from "node-opcua-nodeset-di/dist/enum_device_health.js";
import type { UADevice, UADevice_Base } from "node-opcua-nodeset-di/dist/ua_device.js";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item.js";
import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file.js";
import type { DataType } from "node-opcua-variant";

import type { UAAnalyserDeviceStateMachine } from "./ua_analyser_device_state_machine.js";

// ----- this file has been automatically generated - do not edit

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
      manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
      model: UAProperty<LocalizedText, DataType.LocalizedText>;
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
export interface UAAnalyserDevice extends Omit<UADevice, "parameterSet"|"methodSet"|"identification">, UAAnalyserDevice_Base {}