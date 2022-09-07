// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFunctionalGroup } from "./ua_functional_group"
import { UALockingServices } from "./ua_locking_services"
/**
 * Defines the basic information components for all
 * configurable elements in a device topology
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:TopologyElementType ns=1;i=1001                 |
 * |isAbstract      |true                                              |
 */
export interface UATopologyElement_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UAObject;
    /**
     * methodSet
     * Flat list of Methods
     */
    methodSet?: UAObject;
   // PlaceHolder for $GroupIdentifier$
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification?: UAFunctionalGroup;
    /**
     * lock
     * Used to lock the topology element.
     */
    lock?: UALockingServices;
}
export interface UATopologyElement extends UAObject, UATopologyElement_Base {
}