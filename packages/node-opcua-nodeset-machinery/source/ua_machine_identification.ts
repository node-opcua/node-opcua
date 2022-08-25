// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAMachineryItemIdentification, UAMachineryItemIdentification_Base } from "./ua_machinery_item_identification"
/**
 * Contains information about the identification and
 * nameplate of a machine
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:MachineIdentificationType ns=8;i=1012           |
 * |isAbstract      |false                                             |
 */
export interface UAMachineIdentification_Base extends UAMachineryItemIdentification_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
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
     * productInstanceUri
     * A globally unique resource identifier provided by
     * the manufacturer of the machine
     */
    productInstanceUri: UAProperty<UAString, DataType.String>;
}
export interface UAMachineIdentification extends Omit<UAMachineryItemIdentification, "productInstanceUri">, UAMachineIdentification_Base {
}