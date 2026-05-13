import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";

import type { UASignalSet } from "./ua_signal_set";

// ----- this file has been automatically generated - do not edit

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
export interface UAISignalSet extends UABaseInterface, UAISignalSet_Base {}