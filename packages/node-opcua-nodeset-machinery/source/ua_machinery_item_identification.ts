// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UAFunctionalGroup, UAFunctionalGroup_Base } from "node-opcua-nodeset-di/source/ua_functional_group"
/**
 * Contains information about the identification and
 * nameplate of a MachineryItem
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:MachineryItemIdentificationType ns=8;i=1004     |
 * |isAbstract      |true                                              |
 */
export interface UAMachineryItemIdentification_Base extends UAFunctionalGroup_Base {
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
     * deviceClass
     * Indicates in which domain or for what purpose the
     * MachineryItem is used.
     */
    deviceClass?: UAProperty<UAString, DataType.String>;
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
    model?: UAProperty<LocalizedText, DataType.LocalizedText>;
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
     * the manufacturer of the MachineryItem.
     */
    productInstanceUri?: UAProperty<UAString, DataType.String>;
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
     * yearOfConstruction
     * The year (Gregorian calendar) in which the
     * manufacturing process of the MachineryItem has
     * been completed. It shall be a four-digit number
     * and never change during the life-cycle of a
     * MachineryItem.
     */
    yearOfConstruction?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAMachineryItemIdentification extends UAFunctionalGroup, UAMachineryItemIdentification_Base {
}