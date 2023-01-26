// ----- this file has been automatically generated - do not edit
import { UATopologyElement, UATopologyElement_Base } from "./ua_topology_element"
import { UAFunctionalGroup } from "./ua_functional_group"
/**
 * Represents the interface (interface card) of a
 * Device to a Network.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:ConnectionPointType ns=1;i=6308                 |
 * |isAbstract      |true                                              |
 */
export interface UAConnectionPoint_Base extends UATopologyElement_Base {
    /**
     * networkAddress
     * The address of the device on this network.
     */
    networkAddress: UAFunctionalGroup;
   // PlaceHolder for $ProfileIdentifier$
}
export interface UAConnectionPoint extends UATopologyElement, UAConnectionPoint_Base {
}