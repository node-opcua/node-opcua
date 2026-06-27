import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { EnumDeviceHealth } from "node-opcua-nodeset-di/dist/enum_device_health";
import type { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UAMachineryLifetimeCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_lifetime_counter";
import type { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { UALADSComponents } from "./ua_lads_components";
import type { UAMaintenanceSet } from "./ua_maintenance_set";

// ----- this file has been automatically generated - do not edit

export interface UALADSComponent_identification extends Omit<UAFunctionalGroup, "assetId"|"componentName"|"deviceClass"|"deviceRevision"|"hardwareRevision"|"manufacturer"|"manufacturerUri"|"model"|"productCode"|"productInstanceUri"|"serialNumber"|"softwareRevision"> { // Object
      /**
       * assetId
       * AssetId is a user writable alphanumeric character
       * sequence uniquely identifying a component. The ID
       * is provided by the integrator or user of the
       * device.
       */
      assetId?: UAProperty<UAString, DataType.String>;
      /**
       * componentName
       * ComponentName is a user writable name provided by
       * the integrator or user of the component.
       */
      componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
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
       * deviceManual
       * DeviceManual allows specifying an address of the
       * user manual. It may be a pathname in the file
       * system or a URL (Web address).
       */
      deviceManual?: UAProperty<UAString, DataType.String>;
      /**
       * deviceRevision
       * DeviceRevision provides the overall revision
       * level of a hardware component or the Device. As
       * an example, this Property can be used in ERP
       * systems together with the ProductCode Property.
       */
      deviceRevision?: UAProperty<UAString, DataType.String>;
      /**
       * hardwareRevision
       * HardwareRevision provides the revision level of
       * the hardware.
       */
      hardwareRevision?: UAProperty<UAString, DataType.String>;
      manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
      manufacturerUri?: UAProperty<UAString, DataType.String>;
      model?: UAProperty<LocalizedText, DataType.LocalizedText>;
      productCode?: UAProperty<UAString, DataType.String>;
      productInstanceUri?: UAProperty<UAString, DataType.String>;
      revisionCounter?: UAProperty<Int32, DataType.Int32>;
      serialNumber: UAProperty<UAString, DataType.String>;
      softwareRevision?: UAProperty<UAString, DataType.String>;
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
       * location of the LADS Device.The structure inside
       * the string may expose several levels. How this is
       * exposed, which delimiters are used, etc. is
       * vendor-specific. Examples of such strings are
       * “FactoryA/BuildingC/Floor1” or
       * “Area1-ProcessCell17-Unit4” (see OPC UA OPC
       * 10000-110 for more Details).
       */
      hierarchicalLocation?: UAProperty<UAString, DataType.String>;
}
export interface UALADSComponent_maintenance extends Omit<UAMaintenanceSet, "nodeVersion"> { // Object
      /**
       * nodeVersion
       * NodeVersion and the GeneralModelChangeEventType
       * are mechanisms to notify clients that the content
       * of the set has changed and shall be used as
       * defined in OPC 10000-3.
       */
      nodeVersion: UAProperty<UAString, DataType.String>;
}
export interface UALADSComponent_machineryBuildingBlocks extends UAFolder { // Object
      /**
       * components
       * Components is used for structuring objects of
       * type LADSComponentsType in an unordered list
       * structure.
       */
      components?: UALADSComponents;
      /**
       * lifetimeCounters
       * Lifetime Counter provides information about the
       * past and estimated remaining lifetime.
       */
      lifetimeCounters?: UAMachineryLifetimeCounter;
      operationCounters?: UAMachineryOperationCounter;
}
/**
 * Devices may be composed of tangible
 * sub-components. A component is represented by the
 * LADSComponentType. A component itself may also
 * have sub-components.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LADSComponentType i=1024                                    |
 * |isAbstract      |false                                                       |
 */
export interface UALADSComponent_Base extends UAComponent_Base {
    /**
     * deviceHealth
     * DeviceHealth indicates the health status of a
     * device as defined by NAMUR Recommendation NE 107.
     */
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    /**
     * deviceHealthAlarms
     * DeviceHealthAlarms groups all instances of device
     * health related alarms.
     */
    deviceHealthAlarms?: UAFolder;
    /**
     * identification
     * Identification provides properties to identify a
     * device or component.
     */
    identification: UALADSComponent_identification;
    /**
     * maintenance
     * The MaintenanceSetType is a set containing all
     * maintenance tasks for a Device or Component
     * according to the recommendations in OPC UA
     * 10000-110.
     */
    maintenance?: UALADSComponent_maintenance;
    /**
     * assetId
     * AssetId is a user writable alphanumeric character
     * sequence uniquely identifying a component. The ID
     * is provided by the integrator or user of the
     * device.
     */
    assetId?: UAProperty<UAString, DataType.String>;
    /**
     * componentName
     * ComponentName is a user writable name provided by
     * the integrator or user of the component.
     */
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
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
     * deviceManual
     * DeviceManual allows specifying an address of the
     * user manual. It may be a pathname in the file
     * system or a URL (Web address).
     */
    deviceManual?: UAProperty<UAString, DataType.String>;
    /**
     * deviceRevision
     * DeviceRevision provides the overall revision
     * level of a hardware component or the Device. As
     * an example, this Property can be used in ERP
     * systems together with the ProductCode Property.
     */
    deviceRevision?: UAProperty<UAString, DataType.String>;
    /**
     * hardwareRevision
     * HardwareRevision provides the revision level of
     * the hardware.
     */
    hardwareRevision?: UAProperty<UAString, DataType.String>;
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    model?: UAProperty<LocalizedText, DataType.LocalizedText>;
    productCode?: UAProperty<UAString, DataType.String>;
    productInstanceUri?: UAProperty<UAString, DataType.String>;
    revisionCounter?: UAProperty<Int32, DataType.Int32>;
    serialNumber: UAProperty<UAString, DataType.String>;
    softwareRevision?: UAProperty<UAString, DataType.String>;
    /**
     * components
     * Components is used for structuring objects of
     * type LADSComponentsType in an unordered list
     * structure.
     */
    components?: UALADSComponents;
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
     * location of the LADS Device.The structure inside
     * the string may expose several levels. How this is
     * exposed, which delimiters are used, etc. is
     * vendor-specific. Examples of such strings are
     * “FactoryA/BuildingC/Floor1” or
     * “Area1-ProcessCell17-Unit4” (see OPC UA OPC
     * 10000-110 for more Details).
     */
    hierarchicalLocation?: UAProperty<UAString, DataType.String>;
    /**
     * lifetimeCounters
     * Lifetime Counter provides information about the
     * past and estimated remaining lifetime.
     */
    lifetimeCounters?: UAMachineryLifetimeCounter;
    operationCounters?: UAMachineryOperationCounter;
    /**
     * machineryBuildingBlocks
     * The MachineryBuildingBlocks folder contains all
     * machinery building blocks, especially the
     * MachineryItemState, MachineryOperationMode,
     * OperationCounter and Lifetime Counters.
     */
    machineryBuildingBlocks?: UALADSComponent_machineryBuildingBlocks;
}
export interface UALADSComponent extends Omit<UAComponent, "identification"|"assetId"|"componentName"|"deviceClass"|"deviceManual"|"deviceRevision"|"hardwareRevision"|"manufacturer"|"manufacturerUri"|"model"|"productCode"|"productInstanceUri"|"revisionCounter"|"serialNumber"|"softwareRevision">, UALADSComponent_Base {}