// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Byte, UAString, Guid } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * It is used report errors occurred in the system
 * which are outside the boundaries of the given
 * program.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:ErrorInformationDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTErrorInformation extends DTStructure {
/** The mandatory ErrorType is the classification of type of errors due to external factors. Examples: Tool Trigger Lost is Operator error. Temperature overheat is hardware error, etc.*/
  errorType: Byte; // Byte ns=0;i=3
/** The optional ErrorId is the system-wide unique identifier of the error in the system. This will be useful if system wants to provide an identifier where user can query the system and get more information for troubleshooting. It can also point to the respective EventId reported if available.*/
  errorId: Guid; // Guid ns=0;i=14
/** The optional LegacyError is the application or system specific error code.*/
  legacyError: UAString; // String ns=0;i=12
/** The optional ErrorMessage is user readable text message to describe the error.*/
  errorMessage: LocalizedText; // LocalizedText ns=0;i=21
}