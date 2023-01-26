// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Byte, UAString, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTErrorInformation } from "./dt_error_information"
/**
 * It is used report errors occurred in the system
 * which are outside the boundaries of the given
 * program.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:ErrorInformationType ns=14;i=2002              |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTErrorInformation ns=14;i=3006                   |
 * |isAbstract      |false                                             |
 */
export interface UAErrorInformation_Base<T extends DTErrorInformation>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * errorId
     * The optional ErrorId is the system-wide unique
     * identifier of the error in the system. This will
     * be useful if system wants to provide an
     * identifier where user can query the system and
     * get more information for troubleshooting. It can
     * also point to the respective EventId reported if
     * available.
     */
    errorId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * errorMessage
     * The optional ErrorMessage is user readable text
     * message to describe the error.
     */
    errorMessage?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    /**
     * errorType
     * The mandatory ErrorType is the classification of
     * type of errors due to external factors.
     */
    errorType: UABaseDataVariable<Byte, DataType.Byte>;
    /**
     * legacyError
     * The optional LegacyError is the application or
     * system specific error code.
     */
    legacyError?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAErrorInformation<T extends DTErrorInformation> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAErrorInformation_Base<T> {
}