// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { Int32, UInt16, Int16, Byte, UAString, Guid } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/source/ua_machinery_item_identification"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
export interface UAITighteningSystemAsset_generalInformation extends UAFolder { // Object
      /**
       * $description
       * The optional Description is the system specific
       * description of the asset.
       */
      "$description"?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
      /**
       * errorCode
       * The optional ErrorCode is the system specific
       * code for the error occurred.
       */
      errorCode?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * errorMessage
       * The optional ErrorMessage is the user readable
       * text of the error reported by the given asset.
       */
      errorMessage?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
      /**
       * errorTimestamp
       * The optional ErrorTimestamp is the timestamp when
       * the error occurred in the given asset.
       */
      errorTimestamp?: UABaseDataVariable<Date, DataType.DateTime>;
      /**
       * productInstanceId
       * The optional ProductInstanceId is a system-wide
       * unique identifier as GUID to be consistent with
       * other entities like Result, Programs, etc. for
       * ease of automation.
       */
      productInstanceId?: UABaseDataVariable<Guid, DataType.Guid>;
      /**
       * supplierCode
       * The optional SupplierCode is the SAP or ERP
       * Supplier Code of the asset.
       */
      supplierCode?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * temperature
       * The optional Temperature is the measured
       * temperature of the asset.
       */
      temperature?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * uptime
       * The optional Uptime is the total number of hours
       * it has been running since its operational date.
       */
      uptime?: UABaseDataVariable<Int32, DataType.Int32>;
}
export interface UAITighteningSystemAsset_serviceInformation extends UAFolder { // Object
      /**
       * nextServiceDate
       * The optional NextServiceDate is the date of the
       * next planned service.
       */
      nextServiceDate?: UABaseDataVariable<Date, DataType.DateTime>;
      /**
       * numberOfServices
       * The optional NumberOfServices is the total number
       * of services taken place till date.
       */
      numberOfServices?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * remainingCycles
       * The optional RemainingCycles is the remaining
       * cycles before the service or maintenance. It can
       * go negative if a service is skipped to indicate
       * overshoot cycles.
       */
      remainingCycles?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * serviceCycleCount
       * The optional ServiceCycleCount is the total cycle
       * counter when the last service took place.
       */
      serviceCycleCount?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * serviceCycleSpan
       * The optional ServiceCycleSpan is the maximum
       * allowed number of cycles between two services.
       */
      serviceCycleSpan?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * serviceDate
       * The mandatory ServiceDate is the date of the last
       * service.
       */
      serviceDate: UABaseDataVariable<Date, DataType.DateTime>;
      /**
       * servicePlace
       * The mandatory ServicePlace is the location where
       * the last service took place.
       */
      servicePlace: UABaseDataVariable<UAString, DataType.String>;
      /**
       * serviceReminderDays
       * The optional ServiceReminderDays is the number of
       * days before a service reminder should be sent.
       */
      serviceReminderDays?: UABaseDataVariable<Int16, DataType.Int16>;
}
/**
 * This is a generic interface common for all assets
 * in a given Tightening System. The purpose of this
 * interface is to provide a standard way of
 * identification and common information for all the
 * assets. 
 * This interface has a standard
 * MachineryItemIdentificationType add-in which can
 * be assigned with MachineIdentificationType or
 * MachineryComponentIdentificationType for a given
 * asset based on the requirement of the system.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:ITighteningSystemAssetType ns=14;i=1002        |
 * |isAbstract      |true                                              |
 */
export interface UAITighteningSystemAsset_Base extends UABaseInterface_Base {
    /**
     * generalInformation
     * The GeneralInformation Object is an instance of
     * FolderType to group common parameters for all the
     * assets under TighteningSystemType.
     */
    generalInformation?: UAITighteningSystemAsset_generalInformation;
    /**
     * identification
     * The Identification Object, using the standardized
     * name defined in OPC 10000-100, provides
     * identification information about the asset. This
     * is a mandatory place holder and any asset
     * inheriting ITighteningSystemAssetType will
     * replace it with MachineIdentificationType or
     * MachineryComponentIdentificationType.
     */
    identification: UAMachineryItemIdentification;
    /**
     * serviceInformation
     * The optional ServiceInformation Object provides
     * general information on the service operations
     * performed on a given asset.
     */
    serviceInformation?: UAITighteningSystemAsset_serviceInformation;
}
export interface UAITighteningSystemAsset extends UABaseInterface, UAITighteningSystemAsset_Base {
}