// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { Int64, UInt16, Byte, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { EnumDeviceHealth } from "node-opcua-nodeset-di/source/enum_device_health"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/source/ua_machinery_item_identification"
import { UAMachineryLifetimeCounter } from "node-opcua-nodeset-machinery/source/ua_machinery_lifetime_counter"
import { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/source/ua_machinery_operation_counter"
import { DTSignal } from "./dt_signal"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
export interface UAIJoiningSystemAsset_health extends UAFunctionalGroup { // Object
      /**
       * deviceHealth
       * DeviceHealth indicates the status as defined by
       * NAMUR Recommendation NE107. Clients can read or
       * monitor this Variable to determine the device
       * condition.
       */
      deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
      deviceHealthAlarms?: UAFolder;
      /**
       * errorCode
       * ErrorCode is the system specific code for the
       * error occurred.
       */
      errorCode?: UABaseDataVariable<Int64, DataType.Int64>;
      /**
       * errorMessage
       * ErrorMessage is the user readable text of the
       * error reported by the given asset.
       */
      errorMessage?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
      /**
       * errorTimestamp
       * ErrorTimestamp is the timestamp when the error
       * occurred in the given asset.
       */
      errorTimestamp?: UABaseDataVariable<Date, DataType.DateTime>;
      /**
       * temperature
       * Temperature is the measured temperature of the
       * asset.
       */
      temperature?: UAJoiningDataVariable<number, DataType.Double>;
}
export interface UAIJoiningSystemAsset_identification extends Omit<UAMachineryItemIdentification, "manufacturer"|"serialNumber"> { // Object
      /**
       * $description
       * Description is the system specific description of
       * the asset.
       */
      "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * joiningTechnology
       * JoiningTechnology is a human readable text to
       * identify the joining technology.
       */
      joiningTechnology?: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * manufacturer
       * A human-readable, localized name of the
       * manufacturer of the MachineryItem.
       */
      manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * serialNumber
       * A string containing a unique production number of
       * the manufacturer of the MachineryItem. The global
       * uniqueness of the serial number is only given in
       * the context of the manufacturer, and potentially
       * the model. The value shall not change during the
       * life-cycle of the MachineryItem.
       */
      serialNumber: UAProperty<UAString, DataType.String>;
      /**
       * supplierCode
       * SupplierCode is the SAP or ERP Supplier Code of
       * the asset.
       */
      supplierCode?: UAProperty<UAString, DataType.String>;
}
export interface UAIJoiningSystemAsset_machineryBuildingBlocks extends UAFolder { // Object
      /**
       * identification
       * The Identification Object, using the standardized
       * name defined in OPC 10000-100, provides
       * identification information about the asset. This
       * is a mandatory place holder and any asset
       * inheriting IJoiningSystemAssetType will replace
       * it with MachineIdentificationType or
       * MachineryComponentIdentificationType.
       */
      identification: UAMachineryItemIdentification;
      /**
       * lifetimeCounters
       * It provides an entry point to various lifetime
       * variables.
       */
      lifetimeCounters?: UAMachineryLifetimeCounter;
      /**
       * operationCounters
       * It provides information about the duration
       * something is turned on and how long it performs
       * an activity.
       */
      operationCounters?: UAMachineryOperationCounter;
}
export interface UAIJoiningSystemAsset_maintenance extends UAFunctionalGroup { // Object
      /**
       * calibration
       * The Calibration Object provides a set of
       * parameters related to the calibration operations
       * performed on a given asset.
       */
      calibration?: UAFunctionalGroup;
      /**
       * service
       * The Service Object provides a set of parameters
       * related to the service operations performed on a
       * given asset.
       */
      service?: UAFunctionalGroup;
}
export interface UAIJoiningSystemAsset_parameters extends UAFolder { // Object
      /**
       * connected
       * Connected indicates if a given asset is connected
       * or disconnected. It can change by DisconnectAsset
       * method or by some other external interface.
       */
      connected?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * enabled
       * Enabled indicates if a given asset is enabled or
       * disabled. It can change by EnableAsset method or
       * by some other external interface.
       */
      enabled?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * ioSignals
       * IOSignals is an array of signals available for
       * the asset.
       */
      ioSignals?: UABaseDataVariable<DTSignal[], DataType.ExtensionObject>;
}
/**
 * This is a generic interface common for all assets
 * in a given Joining System. The purpose of this
 * interface is to provide a standard way of
 * identification and common information for all the
 * assets. 
 * This interface has a standard
 * MachineryItemIdentificationType add-in which can
 * be assigned with MachineIdentificationType or
 * MachineryComponentIdentificationType for a given
 * asset based on the requirement of the system.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IJoiningSystemAssetType i=1002                              |
 * |isAbstract      |true                                                        |
 */
export interface UAIJoiningSystemAsset_Base extends UABaseInterface_Base {
    /**
     * health
     * The Health Object is an instance of
     * 2:FunctionalGroupType to group health related
     * parameters for all the assets in a Joining System.
     */
    health?: UAIJoiningSystemAsset_health;
    /**
     * identification
     * The Identification Object, using the standardized
     * name defined in OPC 10000-100, provides
     * identification information about the asset. This
     * is a mandatory place holder and any asset
     * inheriting IJoiningSystemAssetType will replace
     * it with MachineIdentificationType or
     * MachineryComponentIdentificationType.
     */
    identification: UAIJoiningSystemAsset_identification;
    /**
     * lifetimeCounters
     * It provides an entry point to various lifetime
     * variables.
     */
    lifetimeCounters?: UAMachineryLifetimeCounter;
    machineryBuildingBlocks?: UAIJoiningSystemAsset_machineryBuildingBlocks;
    /**
     * maintenance
     * The Maintenance Object is an instance of
     * 2:FunctionalGroupType to group maintenance
     * related parameters for the given asset in a
     * Joining System.
     */
    maintenance?: UAIJoiningSystemAsset_maintenance;
    /**
     * operationCounters
     * It provides information about the duration
     * something is turned on and how long it performs
     * an activity.
     */
    operationCounters?: UAMachineryOperationCounter;
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters?: UAIJoiningSystemAsset_parameters;
}
export interface UAIJoiningSystemAsset extends UABaseInterface, UAIJoiningSystemAsset_Base {
}