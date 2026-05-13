import type { UAFunctionalGroup } from "./ua_functional_group";
import type { UATopologyElement, UATopologyElement_Base } from "./ua_topology_element";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionPointType i=6308                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAConnectionPoint_Base extends UATopologyElement_Base {
    networkAddress: UAFunctionalGroup;
   // PlaceHolder for $ProfileIdentifier$
}
export interface UAConnectionPoint extends UATopologyElement, UAConnectionPoint_Base {}