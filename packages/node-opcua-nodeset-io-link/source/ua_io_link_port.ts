// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { UInt32, UInt16, Byte } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAOptionSet } from "node-opcua-nodeset-ua/source/ua_option_set"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/source/ua_topology_element"
import { UAIOLinkDevice } from "./ua_io_link_device"
export interface UAIOLinkPort_capabilities extends UAFunctionalGroup { // Object
      maxPowerSupply: UABaseDataVariable<number, DataType.Double>;
      pin2Support: UABaseDataVariable<boolean, DataType.Boolean>;
      portClass: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
export interface UAIOLinkPort_configuration extends UAFunctionalGroup { // Object
      configuredDevice: UAFunctionalGroup;
      cycleTime: UABaseDataVariable<number, DataType.Double>;
      pin2Configuration: UAMultiStateDiscrete<Byte, DataType.Byte>;
      portMode: UAMultiStateDiscrete<Byte, DataType.Byte>;
      updateConfiguration: UAMethod;
      useIODD: UABaseDataVariable<boolean, DataType.Boolean>;
      validationAndBackup: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
export interface UAIOLinkPort_information extends UAFunctionalGroup { // Object
      actualCycleTime: UABaseDataVariable<number, DataType.Double>;
      baudrate: UAMultiStateDiscrete<Byte, DataType.Byte>;
      quality: UAOptionSet<Byte, DataType.Byte>;
      status: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
export interface UAIOLinkPort_methodSet extends UAObject { // Object
      updateConfiguration: UAMethod;
      resetStatistics?: UAMethod;
}
export interface UAIOLinkPort_parameterSet extends UAObject { // Object
      maxPowerSupply: UABaseDataVariable<number, DataType.Double>;
      pin2Support: UABaseDataVariable<boolean, DataType.Boolean>;
      portClass: UAMultiStateDiscrete<Byte, DataType.Byte>;
      deviceID: UABaseDataVariable<UInt32, DataType.UInt32>;
      vendorID: UABaseDataVariable<UInt16, DataType.UInt16>;
      cycleTime: UABaseDataVariable<number, DataType.Double>;
      pin2Configuration: UAMultiStateDiscrete<Byte, DataType.Byte>;
      portMode: UAMultiStateDiscrete<Byte, DataType.Byte>;
      useIODD: UABaseDataVariable<boolean, DataType.Boolean>;
      validationAndBackup: UAMultiStateDiscrete<Byte, DataType.Byte>;
      actualCycleTime: UABaseDataVariable<number, DataType.Double>;
      baudrate: UAMultiStateDiscrete<Byte, DataType.Byte>;
      quality: UAOptionSet<Byte, DataType.Byte>;
      status: UAMultiStateDiscrete<Byte, DataType.Byte>;
      dateOfLastStatisticsReset?: UABaseDataVariable<Date, DataType.DateTime>;
      numberOfAborts?: UABaseDataVariable<UInt32, DataType.UInt32>;
      numberOfCycles?: UABaseDataVariable<UInt32, DataType.UInt32>;
      numberOfDeviceHasBeenExchanged?: UABaseDataVariable<UInt32, DataType.UInt32>;
      numberOfRetries?: UABaseDataVariable<UInt32, DataType.UInt32>;
      pin2ProcessData?: UABaseDataVariable<any, any>;
      pin4ProcessData?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAIOLinkPort_siOProcessData extends UAFunctionalGroup { // Object
      pin2ProcessData?: UABaseDataVariable<any, any>;
      pin4ProcessData?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAIOLinkPort_statistics extends UAFunctionalGroup { // Object
      resetStatistics?: UAMethod;
      dateOfLastStatisticsReset?: UABaseDataVariable<Date, DataType.DateTime>;
      numberOfAborts?: UABaseDataVariable<UInt32, DataType.UInt32>;
      numberOfCycles?: UABaseDataVariable<UInt32, DataType.UInt32>;
      numberOfDeviceHasBeenExchanged?: UABaseDataVariable<UInt32, DataType.UInt32>;
      numberOfRetries?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkPortType ns=17;i=1015                    |
 * |isAbstract      |false                                             |
 */
export interface UAIOLinkPort_Base extends UATopologyElement_Base {
    alarms?: UAFolder;
    capabilities: UAIOLinkPort_capabilities;
    configuration: UAIOLinkPort_configuration;
    device?: UAIOLinkDevice;
    deviceConfigurationDisabled: UAProperty<boolean, DataType.Boolean>;
    information: UAIOLinkPort_information;
    /**
     * methodSet
     * Flat list of Methods
     */
    methodSet: UAIOLinkPort_methodSet;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAIOLinkPort_parameterSet;
    siOProcessData: UAIOLinkPort_siOProcessData;
    statistics: UAIOLinkPort_statistics;
}
export interface UAIOLinkPort extends Omit<UATopologyElement, "methodSet"|"parameterSet">, UAIOLinkPort_Base {
}