import type { UAProperty } from "node-opcua-address-space-base";
import type { QualifiedName } from "node-opcua-data-model";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MachineryLifetimeCounterType i=1015                         |
 * |isAbstract      |false                                                       |
 */
export interface UAMachineryLifetimeCounter_Base extends UAFolder_Base {
   // PlaceHolder for $LifetimeVariable$
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
}
export interface UAMachineryLifetimeCounter extends UAFolder, UAMachineryLifetimeCounter_Base {}