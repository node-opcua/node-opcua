// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * This structure represents the errors occurred in
 * the system which are outside the boundaries of
 * the given program.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |ErrorInformationDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTErrorInformation extends DTStructure {
  /** It is the classification of type of errors due to external factors. Examples: Tool Trigger Lost is Operator error. Temperature overheat is hardware error, etc.*/
  errorType: Byte; // Byte ns=0;i=3
  /** It is the system-wide unique identifier of the error in the system. This will be useful if system wants to provide an identifier where user can query the system and get more information for troubleshooting. It can also point to the respective EventId reported if available.*/
  errorId?: UAString; // String ns=0;i=31918
  /** It is the application or system specific error code.*/
  legacyError?: UAString; // String ns=0;i=12
  /** It is user readable text message to describe the error.*/
  errorMessage?: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTErrorInformation extends ExtensionObject, DTErrorInformation {};