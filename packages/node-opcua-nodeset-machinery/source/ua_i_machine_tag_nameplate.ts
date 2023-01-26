// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAITagNameplate, UAITagNameplate_Base } from "node-opcua-nodeset-di/source/ua_i_tag_nameplate"
/**
 * Interface containing information of the
 * identification of a machine set by the customer
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:IMachineTagNameplateType ns=8;i=1011            |
 * |isAbstract      |true                                              |
 */
export interface UAIMachineTagNameplate_Base extends UAITagNameplate_Base {
    /**
     * location
     * To be used by end users to store the location of
     * the machine in a scheme specific to the end user
     * Servers shall support at least 60 Unicode
     * characters for the clients writing this value,
     * this means clients can expect to be able to write
     * strings with a length of 60 Unicode characters
     * into that field.
     */
    location?: UAProperty<UAString, DataType.String>;
}
export interface UAIMachineTagNameplate extends UAITagNameplate, UAIMachineTagNameplate_Base {
}