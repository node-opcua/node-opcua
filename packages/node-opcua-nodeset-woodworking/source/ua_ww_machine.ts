// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAUIElement } from "node-opcua-nodeset-di/source/ua_ui_element"
import { UAMachineIdentification } from "node-opcua-nodeset-machinery/source/ua_machine_identification"
import { UAWwEventsDispatcher } from "./ua_ww_events_dispatcher"
export interface UAWwMachine_identification extends Omit<UAMachineIdentification, "assetId"|"componentName"|"deviceClass"|"hardwareRevision"|"initialOperationDate"|"location"|"manufacturer"|"manufacturerUri"|"model"|"monthOfConstruction"|"productCode"|"productInstanceUri"|"serialNumber"|"softwareRevision"|"uiElement"|"yearOfConstruction"> { // Object
      /**
       * assetId
       * To be used by end users to store a unique
       * identification in the context of their overall
       * application. Servers shall support at least 40
       * Unicode characters for the clients writing this
       * value, this means clients can expect to be able
       * to write strings with a length of 40 Unicode
       * characters into that field.
       */
      assetId?: UAProperty<UAString, DataType.String>;
      /**
       * componentName
       * To be used by end users to store a human-readable
       * localized text for the MachineryItem. The minimum
       * number of locales supported for this property
       * shall be two. Servers shall support at least 40
       * Unicode characters for the clients writing the
       * text part of each locale, this means clients can
       * expect to be able to write texts with a length of
       * 40 Unicode characters into that field.
       */
      componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * customerCompanyName
       * The CustomerCompanyName provides the customer
       * name of the Woodworking manufacturer.
       */
      customerCompanyName?: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * deviceClass
       * Indicates in which domain or for what purpose the
       * MachineryItem is used.
       */
      deviceClass: UAProperty<UAString, DataType.String>;
      /**
       * hardwareRevision
       * A string representation of the revision level of
       * the hardware of a MachineryItem. Hardware is
       * physical equipment, as opposed to programs,
       * procedures, rules and associated documentation.
       * Many machines will not provide such information
       * due to the modular and configurable nature of the
       * machine.
       */
      hardwareRevision?: UAProperty<UAString, DataType.String>;
      /**
       * initialOperationDate
       * The date, when the MachineryItem was switched on
       * the first time after it has left the manufacturer
       * plant.
       */
      initialOperationDate?: UAProperty<Date, DataType.DateTime>;
      /**
       * location
       * To be used by end users to store the location of
       * the machine in a scheme specific to the end user.
       * Servers shall support at least 60 Unicode
       * characters for the clients writing this value,
       * this means clients can expect to be able to write
       * strings with a length of 60 Unicode characters
       * into that field.
       */
      location?: UAProperty<UAString, DataType.String>;
      /**
       * locationGPS
       * The LocationGPS provides the location of the
       * plant in GPS coordinates. The format is decimal
       * degrees with north and east coordinates. For
       * example, Hannover Messe has "52.3235858255059,
       * 9.804918108600956".
       * Southern latitudes have a negative value, western
       * longitudes as well. For example, Quito has the
       * coordinates “-0.21975073282167099,
       * -78.51255572531042”.
       */
      locationGPS?: UAProperty<UAString, DataType.String>;
      /**
       * locationPlant
       * The LocationPlant provides the location of the
       * plant.
       */
      locationPlant?: UAProperty<UAString, DataType.String>;
      /**
       * manufacturer
       * A human-readable, localized name of the
       * manufacturer of the MachineryItem.
       */
      manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * manufacturerUri
       * A globally unique identifier of the manufacturer
       * of the MachineryItem.
       */
      manufacturerUri?: UAProperty<UAString, DataType.String>;
      /**
       * model
       * A human-readable, localized name of the model of
       * the MachineryItem.
       */
      model: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * monthOfConstruction
       * The month in which the manufacturing process of
       * the MachineryItem has been completed. It shall be
       * a number between 1 and 12, representing the month
       * from January to December.
       */
      monthOfConstruction?: UAProperty<Byte, DataType.Byte>;
      /**
       * productCode
       * A machine-readable string of the model of the
       * MachineryItem, that might include options like
       * the hardware configuration of the model. This
       * information might be provided by the ERP system
       * of the vendor. For example, it can be used as
       * order information.
       */
      productCode?: UAProperty<UAString, DataType.String>;
      /**
       * productInstanceUri
       * A globally unique resource identifier provided by
       * the manufacturer of the machine
       */
      productInstanceUri: UAProperty<UAString, DataType.String>;
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
       * softwareRevision
       * A string representation of the revision level of
       * a MachineryItem. In most cases, MachineryItems
       * consist of several software components. In that
       * case, information about the software components
       * might be provided as additional information in
       * the address space, including individual revision
       * information. In that case, this property is
       * either not provided or provides an overall
       * software revision level. The value might change
       * during the life-cycle of a MachineryItem.
       */
      softwareRevision?: UAProperty<UAString, DataType.String>;
      /**
       * uiElement
       * A user interface element assigned to this group.
       */
      uiElement?: UAUIElement<any, any>;
      /**
       * yearOfConstruction
       * The year (Gregorian calendar) in which the
       * manufacturing process of the MachineryItem has
       * been completed. It shall be a four-digit number
       * and never change during the life-cycle of a
       * MachineryItem.
       */
      yearOfConstruction: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAWwMachine_state extends UAObject { // Object
      /**
       * machine
       * State of the whole machine.
       */
      machine: UAObject;
      /**
       * subUnits
       * The SubUnits Object is used when a machine has
       * multiple states. For example, a CNC machine can
       * have several places where independent jobs are
       * produced.
       */
      subUnits?: UAObject;
}
/**
 * The WwMachineType represents a woodworking machine
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:WwMachineType ns=12;i=2                        |
 * |isAbstract      |false                                             |
 */
export interface UAWwMachine_Base {
    /**
     * events
     * The Event Object provides events.
     */
    events?: UAWwEventsDispatcher;
    /**
     * identification
     * The Identification Object provides identification
     * information of the machine.
     */
    identification: UAWwMachine_identification;
    /**
     * manufacturerSpecific
     * The ManufacturerSpecific Object provides
     * manufacturer specific functionality.
     */
    manufacturerSpecific?: UAFolder;
    /**
     * state
     * The State Object provides information about the
     * states of the machine.
     */
    state: UAWwMachine_state;
}
export interface UAWwMachine extends UAObject, UAWwMachine_Base {
}