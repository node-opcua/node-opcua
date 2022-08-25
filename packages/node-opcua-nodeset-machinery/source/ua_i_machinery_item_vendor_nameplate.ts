// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UAIVendorNameplate, UAIVendorNameplate_Base } from "node-opcua-nodeset-di/source/ua_i_vendor_nameplate"
/**
 * Interface containing identification and nameplate
 * information for a MachineryItem provided by the
 * vendor
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:IMachineryItemVendorNameplateType ns=8;i=1003   |
 * |isAbstract      |true                                              |
 */
export interface UAIMachineryItemVendorNameplate_Base extends UAIVendorNameplate_Base {
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
     * monthOfConstruction
     * The month in which the manufacturing process of
     * the MachineryItem has been completed. It shall be
     * a number between 1 and 12, representing the month
     * from January to December.
     */
    monthOfConstruction?: UAProperty<Byte, DataType.Byte>;
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
     * yearOfConstruction
     * The year (Gregorian calendar) in which the
     * manufacturing process of the MachineryItem has
     * been completed. It shall be a four-digit number
     * and never change during the life-cycle of a
     * MachineryItem.
     */
    yearOfConstruction?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIMachineryItemVendorNameplate extends Omit<UAIVendorNameplate, "manufacturer"|"serialNumber">, UAIMachineryItemVendorNameplate_Base {
}