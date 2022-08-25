// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFile } from "node-opcua-nodeset-ua/source/ua_file"
import { DTFileFormat } from "./dt_file_format"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:InstructionType ns=13;i=1003                   |
 * |isAbstract      |false                                             |
 */
export interface UAInstruction_Base {
    plan: UAFile;
    planFileFormat: UAProperty<DTFileFormat, DataType.ExtensionObject>;
}
export interface UAInstruction extends UAObject, UAInstruction_Base {
}