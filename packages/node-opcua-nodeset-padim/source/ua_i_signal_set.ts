// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UASignalSet } from "./ua_signal_set"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:ISignalSetType ns=20;i=1052                    |
 * |isAbstract      |true                                              |
 */
export interface UAISignalSet_Base extends UABaseInterface_Base {
    signalSet?: UASignalSet;
}
export interface UAISignalSet extends UABaseInterface, UAISignalSet_Base {
}