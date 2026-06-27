import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAMachineComponents, UAMachineComponents_Base } from "node-opcua-nodeset-machinery/dist/ua_machine_components";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The LADSComponentsType is a type used for
 * structuring objects of type LADSComponentsType in
 * an unordered list structure.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LADSComponentsType i=1025                                   |
 * |isAbstract      |false                                                       |
 */
export interface UALADSComponents_Base extends UAMachineComponents_Base {
    nodeVersion?: UAProperty<UAString, DataType.String>;
   // PlaceHolder for $Component$
}
export interface UALADSComponents extends Omit<UAMachineComponents, "$Component$">, UALADSComponents_Base {}