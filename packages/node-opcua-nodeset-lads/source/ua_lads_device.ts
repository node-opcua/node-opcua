import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { EnumDeviceHealth } from "node-opcua-nodeset-di/dist/enum_device_health";
import type { UADevice, UADevice_Base } from "node-opcua-nodeset-di/dist/ua_device";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UAMachineIdentification } from "node-opcua-nodeset-machinery/dist/ua_machine_identification";
import type { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine";
import type { UAMachineryLifetimeCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_lifetime_counter";
import type { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { UAFunctionalUnitSet } from "./ua_functional_unit_set";
import type { UALADSComponents } from "./ua_lads_components";
import type { UALADSDeviceStateMachine } from "./ua_lads_device_state_machine";
import type { UALADSOperationModeStateMachine } from "./ua_lads_operation_mode_state_machine";
import type { UAMaintenanceSet } from "./ua_maintenance_set";

// ----- this file has been automatically generated - do not edit

export interface UALADSDevice_functionalUnitSet extends Omit<UAFunctionalUnitSet, "nodeVersion"> { // Object
      /**
       * nodeVersion
       * NodeVersion and the GeneralModelChangeEventType
       * are mechanisms to notify clients that the content
       * of the set has changed and shall be used as
       * defined in OPC 10000-3.
       */
      nodeVersion: UAProperty<UAString, DataType.String>;
}
export interface UALADSDevice_identification extends Omit<UAFunctionalGroup, "manufacturer"|"model"|"softwareRevision"|"serialNumber"|"assetId"|"componentName"|"hardwareRevision"|"manufacturerUri"|"productCode"|"productInstanceUri"> { // Object
      /**
       * revisionCounter
       * An incremental counter indicating the number of
       * times the static data within the Device has been
       * modified
       */
      revisionCounter: UAProperty<Int32, DataType.Int32>;
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
       * deviceManual
       * DeviceManual allows specifying an address of the
       * user manual. It may be a pathname in the file
       * system or a URL (Web address).
       */
      deviceManual: UAProperty<UAString, DataType.String>;
      /**
       * deviceRevision
       * Overall revision level of the device
       */
      deviceRevision: UAProperty<UAString, DataType.String>;
      /**
       * softwareRevision
       * Revision level of the software/firmware of the
       * device
       */
      softwareRevision: UAProperty<UAString, DataType.String>;
      /**
       * serialNumber
       * Identifier that uniquely identifies, within a
       * manufacturer, a device instance
       */
      serialNumber: UAProperty<UAString, DataType.String>;
      /**
       * assetId
       * AssetId is a user writable alphanumeric character
       * sequence uniquely identifying a component. The ID
       * is provided by the integrator or user of the
       * device.
       */
      assetId: UAProperty<UAString, DataType.String>;
      /**
       * componentName
       * ComponentName is a user writable name provided by
       * the integrator or user of the component.
       */
      componentName: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * hardwareRevision
       * Revision level of the hardware of the device
       */
      hardwareRevision: UAProperty<UAString, DataType.String>;
      /**
       * manufacturerUri
       * ManufacturerUri provides a unique identifier for
       * this company. This identifier should be a fully
       * qualified domain name; however, it may be a GUID
       * or similar construct that ensures global
       * uniqueness.
       */
      manufacturerUri?: UAProperty<UAString, DataType.String>;
      /**
       * productCode
       * ProductCode provides a unique combination of
       * numbers and letters used to identify the product.
       * It may be the order information displayed on type
       * shields or in ERP systems.
       */
      productCode?: UAProperty<UAString, DataType.String>;
      /**
       * productInstanceUri
       * ProductInstanceUri is a globally unique resource
       * identifier provided by the manufacturer. This is
       * often stamped on the outside of a physical
       * component and may be used for traceability and
       * warranty purposes.
       */
      productInstanceUri: UAProperty<UAString, DataType.String>;
      /**
       * operationalLocation
       * OperationalLocation provides the operational
       * location of the Device or Component. The
       * structure within the string may expose several
       * levels. How this is exposed, which delimiters are
       * used, etc. is vendor-specific. Examples of such
       * strings are “Warehouse1/Sheet3” or
       * “StainlessSteelTote3” (see OPC UA OPC 10000-110
       * for more details).
       */
      operationalLocation?: UAProperty<UAString, DataType.String>;
      /**
       * hierarchicalLocation
       * HierarchicalLocation provides the hierarchical
       * location of the LADSDevice.The structure within
       * the string may expose several levels. How this is
       * exposed, which delimiters are used, etc. is
       * vendor-specific. Examples of such strings are
       * “FactoryA/BuildingC/Floor1” or
       * “Area1-ProcessCell17-Unit4” (see OPC UA OPC
       * 10000-110 for more details).
       */
      hierarchicalLocation?: UAProperty<UAString, DataType.String>;
}
export interface UALADSDevice_maintenance extends Omit<UAMaintenanceSet, "nodeVersion"> { // Object
      /**
       * nodeVersion
       * NodeVersion and the GeneralModelChangeEventType
       * are mechanisms to notify clients that the content
       * of the set has changed and shall be used as
       * defined in OPC 10000-3.
       */
      nodeVersion: UAProperty<UAString, DataType.String>;
}
export interface UALADSDevice_machineryBuildingBlocks extends UAFolder { // Object
      /**
       * components
       * Components is used for structuring objects of
       * type LADSComponentsType in an unordered list
       * structure.
       */
      components?: UALADSComponents;
      /**
       * identification
       * Identification provides properties to identify a
       * device or component.
       */
      identification: UAMachineIdentification;
      /**
       * machineryItemState
       * MachineryItemState indicates the current state of
       * the device in conformance with the Machinery
       * Basics specification.
       */
      machineryItemState?: UAMachineryItemState_StateMachine;
      /**
       * machineryOperationMode
       * State machine representing the operation mode of
       * a laboratory device. Optional methods allow for
       * initiating changes of the operation mode from
       * remote.
       */
      machineryOperationMode?: UALADSOperationModeStateMachine;
      /**
       * lifetimeCounters
       * Lifetime Counter provides information about the
       * past and estimated remaining lifetime.
       */
      lifetimeCounters?: UAMachineryLifetimeCounter;
      /**
       * operationCounters
       * OperationCounters for monitoring the condition of
       * the device or component in conformance with the
       * Devices specification.
       */
      operationCounters?: UAMachineryOperationCounter;
}
/**
 * The LADSDeviceType provides a base class for
 * laboratory- and analytical devices.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LADSDeviceType i=1002                                       |
 * |isAbstract      |false                                                       |
 */
export interface UALADSDevice_Base extends UADevice_Base {
    /**
     * components
     * Components is used for structuring objects of
     * type LADSComponentsType in an unordered list
     * structure.
     */
    components?: UALADSComponents;
    /**
     * functionalUnitSet
     * The FunctionalUnitSetType provides a set of a
     * FunctionalUnit objects.
     */
    functionalUnitSet: UALADSDevice_functionalUnitSet;
    /**
     * identification
     * Identification provides properties to identify a
     * device or component.
     */
    identification: UALADSDevice_identification;
    /**
     * deviceState
     * DeviceState represents the Device’s state of
     * operation. It is inspired by the
     * AnalyserDeviceStateMachineType from the Analyzer
     * Devices Specification.
     */
    deviceState: UALADSDeviceStateMachine;
    /**
     * maintenance
     * The MaintenanceSetType is a set containing all
     * maintenance tasks for a Device or Component
     * according to the recommendations in OPC UA
     * 10000-110.
     */
    maintenance?: UALADSDevice_maintenance;
    /**
     * revisionCounter
     * An incremental counter indicating the number of
     * times the static data within the Device has been
     * modified
     */
    revisionCounter: UAProperty<Int32, DataType.Int32>;
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
     * deviceManual
     * DeviceManual allows specifying an address of the
     * user manual. It may be a pathname in the file
     * system or a URL (Web address).
     */
    deviceManual: UAProperty<UAString, DataType.String>;
    /**
     * deviceRevision
     * Overall revision level of the device
     */
    deviceRevision: UAProperty<UAString, DataType.String>;
    /**
     * softwareRevision
     * Revision level of the software/firmware of the
     * device
     */
    softwareRevision: UAProperty<UAString, DataType.String>;
    /**
     * serialNumber
     * Identifier that uniquely identifies, within a
     * manufacturer, a device instance
     */
    serialNumber: UAProperty<UAString, DataType.String>;
    /**
     * assetId
     * AssetId is a user writable alphanumeric character
     * sequence uniquely identifying a component. The ID
     * is provided by the integrator or user of the
     * device.
     */
    assetId: UAProperty<UAString, DataType.String>;
    /**
     * componentName
     * ComponentName is a user writable name provided by
     * the integrator or user of the component.
     */
    componentName: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * deviceClass
     * DeviceClass indicates in which domain or for what
     * purpose a certain item for which the Interface is
     * applied is used. Examples are
     * “ProgrammableController”, “RemoteIO”, and
     * “TemperatureSensor”.
     */
    deviceClass?: UAProperty<UAString, DataType.String>;
    /**
     * deviceHealth
     * DeviceHealth indicates the status as defined by
     * NAMUR Recommendation NE107. Clients can read or
     * monitor this Variable to determine the device
     * condition.
     */
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    /**
     * hardwareRevision
     * Revision level of the hardware of the device
     */
    hardwareRevision: UAProperty<UAString, DataType.String>;
    /**
     * manufacturerUri
     * ManufacturerUri provides a unique identifier for
     * this company. This identifier should be a fully
     * qualified domain name; however, it may be a GUID
     * or similar construct that ensures global
     * uniqueness.
     */
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    /**
     * productCode
     * ProductCode provides a unique combination of
     * numbers and letters used to identify the product.
     * It may be the order information displayed on type
     * shields or in ERP systems.
     */
    productCode?: UAProperty<UAString, DataType.String>;
    /**
     * productInstanceUri
     * ProductInstanceUri is a globally unique resource
     * identifier provided by the manufacturer. This is
     * often stamped on the outside of a physical
     * component and may be used for traceability and
     * warranty purposes.
     */
    productInstanceUri: UAProperty<UAString, DataType.String>;
    /**
     * operationalLocation
     * OperationalLocation provides the operational
     * location of the Device or Component. The
     * structure within the string may expose several
     * levels. How this is exposed, which delimiters are
     * used, etc. is vendor-specific. Examples of such
     * strings are “Warehouse1/Sheet3” or
     * “StainlessSteelTote3” (see OPC UA OPC 10000-110
     * for more details).
     */
    operationalLocation?: UAProperty<UAString, DataType.String>;
    /**
     * hierarchicalLocation
     * HierarchicalLocation provides the hierarchical
     * location of the LADSDevice.The structure within
     * the string may expose several levels. How this is
     * exposed, which delimiters are used, etc. is
     * vendor-specific. Examples of such strings are
     * “FactoryA/BuildingC/Floor1” or
     * “Area1-ProcessCell17-Unit4” (see OPC UA OPC
     * 10000-110 for more details).
     */
    hierarchicalLocation?: UAProperty<UAString, DataType.String>;
    /**
     * machineryItemState
     * MachineryItemState indicates the current state of
     * the device in conformance with the Machinery
     * Basics specification.
     */
    machineryItemState?: UAMachineryItemState_StateMachine;
    /**
     * machineryOperationMode
     * State machine representing the operation mode of
     * a laboratory device. Optional methods allow for
     * initiating changes of the operation mode from
     * remote.
     */
    machineryOperationMode?: UALADSOperationModeStateMachine;
    /**
     * lifetimeCounters
     * Lifetime Counter provides information about the
     * past and estimated remaining lifetime.
     */
    lifetimeCounters?: UAMachineryLifetimeCounter;
    /**
     * operationCounters
     * OperationCounters for monitoring the condition of
     * the device or component in conformance with the
     * Devices specification.
     */
    operationCounters?: UAMachineryOperationCounter;
    /**
     * machineryBuildingBlocks
     * The MachineryBuildingBlocks folder contains all
     * machinery building blocks, especially the
     * MachineryItemState, MachineryOperationMode,
     * OperationCounter and Lifetime Counters.
     */
    machineryBuildingBlocks?: UALADSDevice_machineryBuildingBlocks;
}
export interface UALADSDevice extends Omit<UADevice, "identification"|"revisionCounter"|"manufacturer"|"model"|"deviceManual"|"deviceRevision"|"softwareRevision"|"serialNumber"|"assetId"|"componentName"|"deviceClass"|"deviceHealth"|"hardwareRevision"|"manufacturerUri"|"productCode"|"productInstanceUri">, UALADSDevice_Base {}