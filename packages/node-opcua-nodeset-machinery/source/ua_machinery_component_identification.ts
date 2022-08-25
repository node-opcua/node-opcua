// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAMachineryItemIdentification, UAMachineryItemIdentification_Base } from "./ua_machinery_item_identification"
/**
 * Contains information about the identification and
 * nameplate of a component
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:MachineryComponentIdentificationType ns=8;i=1005|
 * |isAbstract      |false                                             |
 */
export interface UAMachineryComponentIdentification_Base extends UAMachineryItemIdentification_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * deviceRevision
     * A string representation of the overall revision
     * level of the component. Often, it is increased
     * when either the SoftwareRevision and / or the
     * HardwareRevision of the component is increased.
     * As an example, it can be used in ERP systems
     * together with the ProductCode.
     */
    deviceRevision?: UAProperty<UAString, DataType.String>;
}
export interface UAMachineryComponentIdentification extends UAMachineryItemIdentification, UAMachineryComponentIdentification_Base {
}