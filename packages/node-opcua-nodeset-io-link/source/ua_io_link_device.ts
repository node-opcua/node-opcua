// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt32, UInt16, Byte, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { EnumDeviceHealth } from "node-opcua-nodeset-di/source/enum_device_health"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/source/ua_topology_element"
import { UAProcessDataVariable } from "./ua_process_data_variable"
export interface UAIOLinkDevice_general extends UAFunctionalGroup { // Object
      applicationReset: UAMethod;
      applicationSpecificTag: UABaseDataVariable<UAString, DataType.String>;
      detailedDeviceStatus?: UABaseDataVariable<Byte[], DataType.Byte>;
      deviceReset: UAMethod;
      errorCount?: UABaseDataVariable<UInt16, DataType.UInt16>;
      functionTag: UABaseDataVariable<UAString, DataType.String>;
      locationTag: UABaseDataVariable<UAString, DataType.String>;
      offsetTime?: UABaseDataVariable<number, DataType.Double>;
      paramBreak: UAMethod;
      paramDownloadToDeviceStart: UAMethod;
      paramDownloadToDeviceStop: UAMethod;
      paramDownloadToDeviceStore: UAMethod;
      paramUploadFromDeviceStart: UAMethod;
      paramUploadFromDeviceStop: UAMethod;
      processDataInput: UAProcessDataVariable<Byte[], DataType.Byte>;
      processDataOutput: UAProcessDataVariable<Byte[], DataType.Byte>;
      readISDU: UAMethod;
      restoreFactorySettings: UAMethod;
      systemCommand: UAMethod;
      writeISDU: UAMethod;
}
export interface UAIOLinkDevice_identification extends UAFunctionalGroup { // Object
      deviceID: UAProperty<UInt32, DataType.UInt32>;
      applicationSpecificTag: UABaseDataVariable<UAString, DataType.String>;
      functionTag: UABaseDataVariable<UAString, DataType.String>;
      locationTag: UABaseDataVariable<UAString, DataType.String>;
      /**
       * serialNumber
       * Identifier that uniquely identifies, within a
       * manufacturer, a device instance
       */
      serialNumber?: UAProperty<UAString, DataType.String>;
      vendorID: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIOLinkDevice_methodSet extends UAObject { // Object
      applicationReset: UAMethod;
      deviceReset: UAMethod;
      paramBreak: UAMethod;
      paramDownloadToDeviceStart: UAMethod;
      paramDownloadToDeviceStop: UAMethod;
      paramDownloadToDeviceStore: UAMethod;
      paramUploadFromDeviceStart: UAMethod;
      paramUploadFromDeviceStop: UAMethod;
      readISDU: UAMethod;
      restoreFactorySettings: UAMethod;
      systemCommand: UAMethod;
      writeISDU: UAMethod;
}
export interface UAIOLinkDevice_parameterSet extends UAObject { // Object
      applicationSpecificTag: UABaseDataVariable<UAString, DataType.String>;
      detailedDeviceStatus?: UABaseDataVariable<Byte[], DataType.Byte>;
      errorCount?: UABaseDataVariable<UInt16, DataType.UInt16>;
      functionTag: UABaseDataVariable<UAString, DataType.String>;
      locationTag: UABaseDataVariable<UAString, DataType.String>;
      offsetTime?: UABaseDataVariable<number, DataType.Double>;
      processDataInput: UAProcessDataVariable<Byte[], DataType.Byte>;
      processDataOutput: UAProcessDataVariable<Byte[], DataType.Byte>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkDeviceType ns=17;i=1002                  |
 * |isAbstract      |false                                             |
 */
export interface UAIOLinkDevice_Base extends UATopologyElement_Base {
    alarms?: UAFolder;
    deviceAccessLocks?: UAProperty<UInt16, DataType.UInt16>;
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    deviceID: UAProperty<UInt32, DataType.UInt32>;
    general: UAIOLinkDevice_general;
    hardwareRevision?: UAProperty<UAString, DataType.String>;
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification: UAIOLinkDevice_identification;
    /**
     * serialNumber
     * Identifier that uniquely identifies, within a
     * manufacturer, a device instance
     */
    serialNumber?: UAProperty<UAString, DataType.String>;
    vendorID: UAProperty<UInt16, DataType.UInt16>;
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * methodSet
     * Flat list of Methods
     */
    methodSet: UAIOLinkDevice_methodSet;
    minCycleTime: UAProperty<number, DataType.Double>;
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAIOLinkDevice_parameterSet;
    productID?: UAProperty<UAString, DataType.String>;
    productText?: UAProperty<UAString, DataType.String>;
    profileCharacteristic?: UAProperty<UInt16[], DataType.UInt16>;
    revisionID: UAProperty<UAString, DataType.String>;
    softwareRevision?: UAProperty<UAString, DataType.String>;
    vendorText?: UAProperty<UAString, DataType.String>;
}
export interface UAIOLinkDevice extends Omit<UATopologyElement, "identification"|"methodSet"|"parameterSet">, UAIOLinkDevice_Base {
}