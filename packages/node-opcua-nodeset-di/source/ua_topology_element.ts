// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UAFunctionalGroup } from "./ua_functional_group"
import { UALockingServices } from "./ua_locking_services"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TopologyElementType i=1001                                  |
 * |isAbstract      |true                                                        |
 */
export interface UATopologyElement_Base {
    parameterSet?: UAObject;
    methodSet?: UAObject;
   // PlaceHolder for $GroupIdentifier$
    identification?: UAFunctionalGroup;
    lock?: UALockingServices;
}
export interface UATopologyElement extends UAObject, UATopologyElement_Base {
}