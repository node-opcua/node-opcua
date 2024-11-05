// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UACyclicProcessValue } from "./ua_cyclic_process_value"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FormingPositionsType i=1003                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAFormingPositions_Base {
    BDC?: UACyclicProcessValue;
    retract?: UACyclicProcessValue;
    start?: UACyclicProcessValue;
    TDC?: UACyclicProcessValue;
    touch?: UACyclicProcessValue;
}
export interface UAFormingPositions extends UAObject, UAFormingPositions_Base {
}