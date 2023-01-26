// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAMachineryItemIdentification } from "./ua_machinery_item_identification"
export interface UAMachineComponents_$Component$ extends UAObject { // Object
      /**
       * identification
       * Contains information about the identification and
       * nameplate of a MachineryItem
       */
      identification: UAMachineryItemIdentification;
}
/**
 * Contains all identifiable components of a machine
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:MachineComponentsType ns=8;i=1006               |
 * |isAbstract      |false                                             |
 */
export interface UAMachineComponents_Base {
   // PlaceHolder for $Component$
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
}
export interface UAMachineComponents extends UAObject, UAMachineComponents_Base {
}