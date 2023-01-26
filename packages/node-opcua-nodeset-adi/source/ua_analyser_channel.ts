// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { EnumDeviceHealth } from "node-opcua-nodeset-di/source/enum_device_health"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/source/ua_topology_element"
import { UAAnalyserChannelStateMachine } from "./ua_analyser_channel_state_machine"
export interface UAAnalyserChannel_parameterSet extends UAObject { // Object
      /**
       * channelId
       * Channel Id defined by user
       */
      channelId?: UADataItem<UAString, DataType.String>;
      /**
       * isEnabled
       * True if the channel is enabled and accepting
       * commands
       */
      isEnabled: UADataItem<boolean, DataType.Boolean>;
      /**
       * diagnosticStatus
       * AnalyserChannel health status
       */
      diagnosticStatus: UADataItem<EnumDeviceHealth, DataType.Int32>;
      /**
       * activeStream
       * Active stream for this AnalyserChannel
       */
      activeStream: UADataItem<UAString, DataType.String>;
}
export interface UAAnalyserChannel_methodSet extends UAObject { // Object
      gotoOperating: UAMethod;
      gotoMaintenance: UAMethod;
      startSingleAcquisition: UAMethod;
      reset: UAMethod;
      start: UAMethod;
      stop: UAMethod;
      hold: UAMethod;
      unhold: UAMethod;
      suspend: UAMethod;
      unsuspend: UAMethod;
      abort: UAMethod;
      clear: UAMethod;
}
export interface UAAnalyserChannel_configuration extends UAFunctionalGroup { // Object
      /**
       * isEnabled
       * True if the channel is enabled and accepting
       * commands
       */
      isEnabled: UADataItem<boolean, DataType.Boolean>;
}
export interface UAAnalyserChannel_status extends UAFunctionalGroup { // Object
      /**
       * diagnosticStatus
       * AnalyserChannel health status
       */
      diagnosticStatus: UADataItem<EnumDeviceHealth, DataType.Int32>;
      /**
       * activeStream
       * Active stream for this AnalyserChannel
       */
      activeStream: UADataItem<UAString, DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:AnalyserChannelType ns=2;i=1003                 |
 * |isAbstract      |false                                             |
 */
export interface UAAnalyserChannel_Base extends UATopologyElement_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UAAnalyserChannel_parameterSet;
    /**
     * methodSet
     * Flat list of Methods
     */
    methodSet: UAAnalyserChannel_methodSet;
   // PlaceHolder for $GroupIdentifier$
    configuration: UAAnalyserChannel_configuration;
    status: UAAnalyserChannel_status;
    channelStateMachine: UAAnalyserChannelStateMachine;
   // PlaceHolder for $StreamIdentifier$
   // PlaceHolder for $AccessorySlotIdentifier$
}
export interface UAAnalyserChannel extends Omit<UATopologyElement, "parameterSet"|"methodSet"|"$GroupIdentifier$">, UAAnalyserChannel_Base {
}