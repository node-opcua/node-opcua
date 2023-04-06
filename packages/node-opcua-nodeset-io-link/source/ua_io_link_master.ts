// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32, UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/source/ua_topology_element"
export interface UAIOLinkMaster_capabilities extends UAFunctionalGroup { // Object
      maxNumberOfPorts: UABaseDataVariable<Byte, DataType.Byte>;
      maxPowerSupply: UABaseDataVariable<number, DataType.Double>;
}
export interface UAIOLinkMaster_identification extends UAFunctionalGroup { // Object
      deviceID: UAProperty<UInt32, DataType.UInt32>;
      applicationSpecificTag: UABaseDataVariable<UAString, DataType.String>;
      functionTag: UABaseDataVariable<UAString, DataType.String>;
      locationTag: UABaseDataVariable<UAString, DataType.String>;
      masterType: UAMultiStateDiscrete<Byte, DataType.Byte>;
      vendorID?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIOLinkMaster_management extends UAFunctionalGroup { // Object
      restart: UAMethod;
}
export interface UAIOLinkMaster_methodSet extends UAObject { // Object
      restart: UAMethod;
      resetStatisticsOnAllPorts?: UAMethod;
}
export interface UAIOLinkMaster_parameterSet extends UAObject { // Object
      maxNumberOfPorts: UABaseDataVariable<Byte, DataType.Byte>;
      maxPowerSupply: UABaseDataVariable<number, DataType.Double>;
      applicationSpecificTag: UABaseDataVariable<UAString, DataType.String>;
      functionTag: UABaseDataVariable<UAString, DataType.String>;
      locationTag: UABaseDataVariable<UAString, DataType.String>;
      masterType: UAMultiStateDiscrete<Byte, DataType.Byte>;
      dateOfLastStatisticsReset?: UABaseDataVariable<Date, DataType.DateTime>;
      numberOfIOLinkMasterStarts?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UAIOLinkMaster_statistics extends UAFunctionalGroup { // Object
      resetStatisticsOnAllPorts?: UAMethod;
      dateOfLastStatisticsReset?: UABaseDataVariable<Date, DataType.DateTime>;
      numberOfIOLinkMasterStarts?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkMasterType ns=17;i=1014                  |
 * |isAbstract      |false                                             |
 */
export interface UAIOLinkMaster_Base extends UATopologyElement_Base {
    alarms?: UAFolder;
    capabilities: UAIOLinkMaster_capabilities;
    deviceID: UAProperty<UInt32, DataType.UInt32>;
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification: UAIOLinkMaster_identification;
    vendorID?: UAProperty<UInt16, DataType.UInt16>;
    ioLinkStackRevision?: UAProperty<UAString, DataType.String>;
    management: UAIOLinkMaster_management;
    masterConfigurationDisabled: UAProperty<boolean, DataType.Boolean>;
    /**
     * methodSet
     * Flat list of Methods
     */
    methodSet: UAIOLinkMaster_methodSet;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAIOLinkMaster_parameterSet;
   // PlaceHolder for port$n$
    productID?: UAProperty<UAString, DataType.String>;
    productText?: UAProperty<UAString, DataType.String>;
    revisionID?: UAProperty<UAString, DataType.String>;
    statistics: UAIOLinkMaster_statistics;
    vendorURL?: UAProperty<UAString, DataType.String>;
}
export interface UAIOLinkMaster extends Omit<UATopologyElement, "identification"|"methodSet"|"parameterSet">, UAIOLinkMaster_Base {
}