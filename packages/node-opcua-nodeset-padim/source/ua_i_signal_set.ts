// ----- this file has been automatically generated - do not edit
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
import { UASignalSet } from "./ua_signal_set"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISignalSetType i=1052                                       |
 * |isAbstract      |true                                                        |
 */
export interface UAISignalSet_Base extends UABaseInterface_Base {
    signalSet?: UASignalSet;
}
export interface UAISignalSet extends UABaseInterface, UAISignalSet_Base {
}