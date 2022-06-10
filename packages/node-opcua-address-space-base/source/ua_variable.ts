import { AttributeIds, CallbackT, PreciseClock, StatusCode, StatusCodeCallback, UInt32 } from "node-opcua-basic-types";
import { NodeClass, QualifiedNameLike } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { DataValue } from "node-opcua-data-value";
import { ExtensionObject } from "node-opcua-extension-object";
import { NumericRange } from "node-opcua-numeric-range";

import {
    WriteValueOptions,
    HistoryReadDetails,
    HistoryReadResult,
    ReadRawModifiedDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadAtTimeDetails
} from "node-opcua-types";
import { VariantLike } from "node-opcua-variant";

//
import { CloneOptions, CloneFilter, CloneExtraInfo } from "./clone_options";
import { BaseNode, IPropertyAndComponentHolder } from "./base_node";
import { ISessionContext, ContinuationData } from "./session_context";
import { UADataType } from "./ua_data_type";
import { UAVariableType } from "./ua_variable_type";
import { BindVariableOptions } from "./bind_variable";

export interface IVariableHistorian {
    /**
     * push a new value into the history for this variable
     * the method should take a very small amount of time and not
     * directly write to the underlying database
     * @param newDataValue
     */
    push(newDataValue: DataValue): Promise<void>;

    /**
     * Extract a series of dataValue from the History database for this value
     * @param historyReadRawModifiedDetails
     * @param maxNumberToExtract
     * @param isReversed
     * @param reverseDataValue
     * @param callback
     */
    extractDataValues(
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        maxNumberToExtract: number,
        isReversed: boolean,
        reverseDataValue: boolean,
        callback: (err: Error | null, dataValue?: DataValue[]) => void
    ): void;

    /*    extractDataValues(
          historyReadRawModifiedDetails: ReadRawModifiedDetails,
          maxNumberToExtract: number,
          isReversed: boolean,
          reverseDataValue: boolean
        ): Promise<DataValue[]>;
    */
}

export interface IVariableHistorianOptions {
    maxOnlineValues?: number;
    historian?: IVariableHistorian;
}
export type IHistoricalDataNodeOptions = IVariableHistorianOptions | { historian: IVariableHistorian };

export interface VariableAttributes {
    dataType: NodeId;
    valueRank: number;
    minimumSamplingInterval: number;
}
export interface EnumValue2 {
    name: string;
    value: number;
}
export interface BindExtensionObjectOptions {
    createMissingProp?: boolean;
    force?: boolean;
}

export interface UAVariable extends BaseNode, VariableAttributes, IPropertyAndComponentHolder {
    readonly nodeClass: NodeClass.Variable;
    readonly parent: BaseNode | null;
    readonly dataTypeObj: UADataType;
    semantic_version: number;

    $extensionObject?: any;

    get typeDefinitionObj(): UAVariableType;
    get typeDefinition(): NodeId;

    // variable attributes
    dataType: NodeId;

    /**
     * The **AccessLevel Attribute** is used to indicate how the Value of a Variable can be accessed
     * (read/write) and if it contains current and/or historic data.
     *
     * The AccessLevel does not take any user access rights into account, i.e. although the Variable is
     * writable this may be restricted to a certain user / user group.
     *
     * The {{link:AccessLevelType}}
     */
    accessLevel: number;
    /**
     * The UserAccessLevel Attribute is used to indicate how the Value of a Variable can be accessed
     * (read/write) and if it contains current or historic data taking user access rights into account.
     *
     * The AccessLevelType is defined in 8.57.
     */
    userAccessLevel?: number;

    /**
     * This Attribute indicates whether the Value Attribute of the Variable is an array and how many dimensions
     * the array has.
     * It may have the following values:
     *
     *  * n > 1                     : the Value is an array with the specified number of dimensions.
     *  * OneDimension (1):           The value is an array with one dimension.
     *  * OneOrMoreDimensions (0):    The value is an array with one or more dimensions.
     *  * Scalar (-1):                The value is not an array.
     *  * Any (-2):                   The value can be a scalar or an array with any number of dimensions.
     *  * ScalarOrOneDimension (-3):  The value can be a scalar or a one dimensional array.
     *
     *  NOTE:
     *  * All DataTypes are considered to be scalar, even if they have array-like semantics like ByteString and String.
     */
    valueRank: number;

    /**
     * The MinimumSamplingInterval Attribute indicates how 'current' the Value of the Variable will
     * be kept.
     *
     * It specifies (in milliseconds) how fast the Server can reasonably sample the value
     * for changes (see Part 4 for a detailed description of sampling interval).
     *
     * A MinimumSamplingInterval of 0 indicates that the Server is to monitor the item continuously.
     *
     * A MinimumSamplingInterval of -1 means indeterminate.
     */
    minimumSamplingInterval: number;

    /**
     * This Attribute specifies the length of each dimension for an array value.
     *
     * - The Attribute is intended to describe the capability of the Variable, not the current size.
     * - The number of elements shall be equal to the value of the `valueRank` Attribute.
     * - Shall be null if `valueRank` <=0.
     * - A value of 0 for an individual dimension indicates that the dimension has a variable length.
     *
     *  **example**
     *
     *
     *   For example, if a Variable is defined by the following javascript array with 346 Int32 elements:
     *
     *   `const myArray = new Array(346).fill(0);`
     *
     *   then:
     *   * `DataType` would point to an `Int32`
     *   * the Variable's `valueRank` has the value 1 and,
     *   * the `arrayDimensions` is an array with one entry having the value 346.
     *
     *  ```javascript
     *  {
     *    dataType: "Int32",
     *    valueRank: 1,
     *    arrayDimensions: [346]
     * }
     *  ```
     *
     *
     * **Note**: the maximum length of an array transferred on the wire is 2147483647 (max Int32)
     *     and a multidimensional array is encoded as a one dimensional array.
     *
     */
    arrayDimensions: UInt32[] | null;

    /**
     * The `historizing` attribute indicates whether the server is actively collecting data for the
     * history of the variable.
     *
     * This differs from the `accessLevel` Attribute which identifies if the variable has any historical data.
     *
     * A value of **true** indicates that the server is actively collecting data.
     *
     * A value of **false** indicates the server is not actively collecting data.
     *
     * Default value is **false**.
     */
    historizing: boolean;

    /**
     * returns true if the `accessLevel` flag allows the variable to be readable in the specified context.
     * @param context
     */
    isReadable(context: ISessionContext): boolean;

    /**
     * returns true if the `userAccessLevel` flag allows the variable to be readable in the specified context.
     * @param context
     */
    isUserReadable(context: ISessionContext): boolean;

    /**
     * returns true if the `accessLevel` flag allows the variable to be writeable in the specified context.
     * @param context
     */
    isWritable(context: ISessionContext): boolean;

    /**
     * returns true if the `userAccessLevel` flag allows the variable to be writeable in the specified context.
     * @param context
     */
    isUserWritable(context: ISessionContext): boolean;

    /***
     * from OPC.UA.Spec 1.02 part 4
     *  5.10.2.4 StatusCodes
     *  Table 51 defines values for the operation level statusCode contained in the DataValue structure of
     *  each values element. Common StatusCodes are defined in Table 166.
     *
     *  **Read Operation Level Result Codes**
     *
     *  |Symbolic Id                 | Description|
     *  |----------------------------|----------------------------------------|
     *  |BadNodeIdInvalid            | The syntax of the node id is not valid.|
     *  |BadNodeIdUnknown            | The node id refers to a node that does not exist in the server address space.|
     *  |BadAttributeIdInvalid       | BadAttributeIdInvalid The attribute is not supported for the specified node.|
     *  |BadIndexRangeInvalid        | The syntax of the index range parameter is invalid.|
     *  |BadIndexRangeNoData         | No data exists within the range of indexes specified.|
     *  |BadDataEncodingInvalid      | The data encoding is invalid. This result is used if no dataEncoding can be applied because an Attribute other than Value was requested or the DataType of the Value Attribute is not a subtype of the Structure DataType. |
     *  |BadDataEncodingUnsupported  | The server does not support the requested data encoding for the node. This result is used if a dataEncoding can be applied but the passed data encoding is not known to the Server.|
     *  |BadNotReadable              | The access level does not allow reading or subscribing to the Node.|
     *  |BadUserAccessDenied         | User does not have permission to perform the requested operation. (table 165)|
     *  | BadSecurityModeInsufficient | The operation is not permitted over the current secure channel. |
     *  | BadInsufficientPrivileges   | The user does not have enough privileges to perform the requested operation.
     */
    readValue(context?: ISessionContext | null, indexRange?: NumericRange, dataEncoding?: QualifiedNameLike | null): DataValue;

    readValueAsync(context: ISessionContext | null): Promise<DataValue>;
    readValueAsync(context: ISessionContext | null, callback: CallbackT<DataValue>): void;

    isEnumeration(): boolean;

    isExtensionObject(): boolean;

    /**
     *
     */
    readEnumValue(): EnumValue2;

    /**
     *
     * @precondition UAVariable must have a dataType deriving from "Enumeration"
     */
    writeEnumValue(value: string | number): void;

    readAttribute(
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    setValueFromSource(value: VariantLike, statusCode?: StatusCode, sourceTimestamp?: Date): void;

    writeValue(
        context: ISessionContext,
        dataValue: DataValue,
        indexRange: string | NumericRange | null,
        callback: StatusCodeCallback
    ): void;

    writeValue(context: ISessionContext, dataValue: DataValue, callback: StatusCodeCallback): void;

    writeValue(context: ISessionContext, dataValue: DataValue, indexRange?: string | NumericRange | null): Promise<StatusCode>;

    asyncRefresh(oldestDate: Date, callback: CallbackT<DataValue>): void;

    asyncRefresh(oldestDate: Date): Promise<DataValue>;

    /**
     * write a variable attribute (callback version)
     * @param context
     * @param writeValue
     * @param callback
     *
     * **example**
     *
     *  ```javascript
     *    const writeValue = {
     *       attributeId: AttributeIds.Value,
     *       dataValue: new DataValue({
     *           statusCode: StatusCodes.Good,
     *           sourceTimestamp: new Date(),
     *           value: new Variant({ dataType: DataType.Double, value: 3.14 })
     *       }),
     *       nodeId
     *    };
     *  myVariable.writeAttribute(context,writeValue,(err, statusCode) => {
     *     if (err) { console.log("Write has failed"); return; }
     *     console.log("write statusCode = ",statusCode.toString());
     *  });
     *  ```
     *
     */
    writeAttribute(context: ISessionContext | null, writeValue: WriteValueOptions, callback: StatusCodeCallback): void;
    /**
     * write a variable attribute (async/await version)
     * @param context
     * @param writeValue
     *
     *
     * **example**
     *
     * ```javascript
     * try {
     *    const writeValue = {
     *       attributeId: AttributeIds.Value,
     *       dataValue: new DataValue({
     *           statusCode: StatusCodes.Good,
     *           sourceTimestamp: new Date(),
     *           value: new Variant({ dataType: DataType.Double, value: 3.14 })
     *       }),
     *       nodeId
     *    };
     *    const statusCode = await myVariable.writeAttribute(context,writeValue);
     * } catch(err) {
     *   console.log("Write has failed");
     *   return;
     * }
     * console.log("write statusCode = ", statusCode.toString());
     *  ```
     *
     */
    writeAttribute(context: ISessionContext | null, writeValue: WriteValueOptions): Promise<StatusCode>;

    // advanced
    touchValue(updateNow?: PreciseClock): void;

    bindVariable(options?: BindVariableOptions, overwrite?: boolean): void;

    bindExtensionObject(
        optionalExtensionObject?: ExtensionObject | ExtensionObject[],
        options?: BindExtensionObjectOptions
    ): ExtensionObject | ExtensionObject[] | null;

    bindExtensionObjectScalar(
        optionalExtensionObject: ExtensionObject,
        options?: BindExtensionObjectOptions
    ): ExtensionObject | null;

    bindExtensionObjectArray(
        optionalExtensionObjectArray: ExtensionObject[],
        options?: BindExtensionObjectOptions
    ): ExtensionObject[] | null;

    installExtensionObjectVariables(): void;

    historyRead(
        context: ISessionContext,
        historyReadDetails:
            | HistoryReadDetails
            | ReadRawModifiedDetails
            | ReadEventDetails
            | ReadProcessedDetails
            | ReadAtTimeDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationData: ContinuationData
    ): Promise<HistoryReadResult>;

    historyRead(
        context: ISessionContext,
        historyReadDetails:
            | HistoryReadDetails
            | ReadRawModifiedDetails
            | ReadEventDetails
            | ReadProcessedDetails
            | ReadAtTimeDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationData: ContinuationData,
        callback: CallbackT<HistoryReadResult>
    ): void;

    clone(options: CloneOptions, optionalFilter?: CloneFilter, extraInfo?: CloneExtraInfo): UAVariable;

    // ----------------- Event handlers

    on(eventName: "semantic_changed", eventHandler: () => void): this;

    on(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): this;

    once(eventName: "semantic_changed", eventHandler: () => void): this;

    once(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): this;
}
