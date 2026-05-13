import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file";
import type { DataType } from "node-opcua-variant";

import type { DTFileFormat } from "./dt_file_format";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |InstructionType i=1003                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAInstruction_Base {
    plan: UAFile;
    planFileFormat: UAProperty<DTFileFormat, DataType.ExtensionObject>;
}
export interface UAInstruction extends UAObject, UAInstruction_Base {}