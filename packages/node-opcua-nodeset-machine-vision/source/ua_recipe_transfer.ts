// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UATemporaryFileTransfer, UATemporaryFileTransfer_Base } from "node-opcua-nodeset-ua/source/ua_temporary_file_transfer"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:RecipeTransferType ns=4;i=1014                  |
 * |isAbstract      |false                                             |
 */
export interface UARecipeTransfer_Base extends UATemporaryFileTransfer_Base {
    generateFileForRead: UAMethod;
    generateFileForWrite: UAMethod;
}
export interface UARecipeTransfer extends Omit<UATemporaryFileTransfer, "generateFileForRead"|"generateFileForWrite">, UARecipeTransfer_Base {
}