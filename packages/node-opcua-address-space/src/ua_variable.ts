/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-bitwise
// tslint:disable:no-console
// tslint:disable:max-line-length
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

import { isValidDataEncoding } from "node-opcua-data-model";
import { convertAccessLevelFlagToByte, QualifiedNameLike } from "node-opcua-data-model";
import { NodeClass } from "node-opcua-data-model";
import { AccessLevelFlag } from "node-opcua-data-model";
import { makeAccessLevelFlag } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { isDataEncoding } from "node-opcua-data-model";
import { extractRange, sameDataValue } from "node-opcua-data-value";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { coerceClock, getCurrentClock, PreciseClock } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { findBuiltInType } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { WriteValue, WriteValueOptions } from "node-opcua-service-write";
import { StatusCode, StatusCodes, CallbackT } from "node-opcua-status-code";
import {
    EnumDefinition,
    EnumField,
    HistoryReadDetails,
    HistoryReadResult,
    HistoryReadResultOptions,
    Range,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails,
    StructureDefinition,
    StructureDescription
} from "node-opcua-types";
import * as utils from "node-opcua-utils";
import { lowerFirstLetter } from "node-opcua-utils";
import { Variant, VariantLike } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { sameVariant, VariantArrayType } from "node-opcua-variant";
import { StatusCodeCallback } from "node-opcua-status-code";

import {
    AddressSpace,
    BindVariableOptions,
    ContinuationPoint,
    DataValueCallback,
    HistoricalDataConfiguration,
    IVariableHistorian, Permissions,
    PseudoSession,
    UADataType as UADataTypePublic,
    UAVariable as UAVariablePublic, UAVariableType
} from "../source";
import { BaseNode } from "./base_node";
import { _clone, apply_condition_refresh, BaseNode_toString, ToStringBuilder, UAVariable_toString } from "./base_node_private";
import { SessionContext } from "./session_context";
import { EnumerationInfo, IEnumItem, UADataType } from "./ua_data_type";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function isGoodish(statusCode: StatusCode) {
    return statusCode.value < 0x10000000;
}

export function adjust_accessLevel(accessLevel: any): AccessLevelFlag {
    accessLevel = utils.isNullOrUndefined(accessLevel) ? "CurrentRead | CurrentWrite" : accessLevel;
    accessLevel = makeAccessLevelFlag(accessLevel);
    assert(_.isFinite(accessLevel));
    return accessLevel;
}

export function adjust_userAccessLevel(userAccessLevel: any, accessLevel: any): AccessLevelFlag {
    userAccessLevel = utils.isNullOrUndefined(userAccessLevel) ? "CurrentRead | CurrentWrite" : userAccessLevel;
    userAccessLevel = makeAccessLevelFlag(userAccessLevel);
    accessLevel = utils.isNullOrUndefined(accessLevel) ? "CurrentRead | CurrentWrite" : accessLevel;
    accessLevel = makeAccessLevelFlag(accessLevel);
    return makeAccessLevelFlag(accessLevel & userAccessLevel);
}

function adjust_samplingInterval(minimumSamplingInterval: number): number {
    assert(_.isFinite(minimumSamplingInterval));
    if (minimumSamplingInterval < 0) {
        return -1; // only -1 is a valid negative value for samplingInterval and means "unspecified"
    }
    return minimumSamplingInterval;
}

function is_Variant(v: any): boolean {
    return v instanceof Variant;
}

function is_StatusCode(v: any): boolean {
    return v && v.constructor &&
        (
            v.constructor.name === "ConstantStatusCode" ||
            v.constructor.name === "StatusCode" ||
            v.constructor.name === "ModifiableStatusCode"
        );
}

function is_Variant_or_StatusCode(v: any): boolean {
    if (is_Variant(v)) {
        // /@@assert(v.isValid());
    }
    return is_Variant(v) || is_StatusCode(v);
}

function _dataType_toUADataType(
    addressSpace: AddressSpace,
    dataType: DataType
): UADataType {

    assert(addressSpace);
    assert(dataType !== DataType.Null);

    const dataTypeNode = addressSpace.findDataType(DataType[dataType]);
    /* istanbul ignore next */
    if (!dataTypeNode) {
        throw new Error(" Cannot find DataType " + DataType[dataType] + " in address Space");
    }
    return dataTypeNode as UADataType;
}

/*=
 *
 * @param addressSpace
 * @param dataTypeNodeId : the nodeId matching the dataType of the destination variable.
 * @param variantDataType: the dataType of the variant to write to the destination variable
 * @param nodeId
 * @return {boolean} true if the variant dataType is compatible with the Variable DataType
 */
function validateDataType(
    addressSpace: AddressSpace,
    dataTypeNodeId: NodeId,
    variantDataType: DataType,
    nodeId: NodeId
): boolean {

    if (variantDataType === DataType.ExtensionObject) {
        return true;
    }
    if (variantDataType === DataType.Null) {
        return true;
    }

    let builtInType: string;
    let builtInUADataType: UADataTypePublic;

    const destUADataType = addressSpace.findNode(dataTypeNodeId) as UADataType;
    assert(destUADataType instanceof UADataType);

    if (destUADataType.isAbstract || destUADataType.nodeId.namespace !== 0) {
        builtInUADataType = destUADataType;
    } else {
        builtInType = findBuiltInType(destUADataType.symbolicName).name;
        builtInUADataType = addressSpace.findDataType(builtInType)!;
    }
    assert(builtInUADataType instanceof UADataType);

    const enumerationUADataType = addressSpace.findDataType("Enumeration");
    if (!enumerationUADataType) {
        throw new Error("cannot find Enumeration DataType node in standard address space");
    }
    if (destUADataType.isSupertypeOf(enumerationUADataType)) {
        return true;
    }

    // The value supplied for the attribute is not of the same type as the  value.
    const variantUADataType = _dataType_toUADataType(addressSpace, variantDataType);
    assert(variantUADataType instanceof UADataType);

    const dest_isSuperTypeOf_variant = variantUADataType.isSupertypeOf(builtInUADataType);

    /* istanbul ignore next */
    if (doDebug) {
        if (dest_isSuperTypeOf_variant) {
            /* istanbul ignore next*/
            console.log(chalk.green(" ---------- Type match !!! "), " on ", nodeId.toString());
        } else {
            /* istanbul ignore next*/
            console.log(chalk.red(" ---------- Type mismatch "), " on ", nodeId.toString());
        }
        console.log(chalk.cyan(" Variable data Type is    = "), destUADataType.browseName.toString());
        console.log(chalk.cyan(" which matches basic Type = "), builtInUADataType.browseName.toString());
        console.log(chalk.yellow("        Actual   dataType = "), variantUADataType.browseName.toString());
    }

    return (dest_isSuperTypeOf_variant);

}

/**
 * A OPCUA Variable Node
 *
 * @class UAVariable
 * @constructor
 * @extends  BaseNode
 * @param options  {Object}
 * @param options.value
 * @param options.browseName {string}
 * @param options.dataType   {NodeId|String}
 * @param options.valueRank  {Int32}
 * @param options.arrayDimensions {null|Array<Integer>}
 * @param options.accessLevel {AccessLevel}
 * @param options.userAccessLevel {AccessLevel}
 * @param [options.minimumSamplingInterval = -1]
 * @param [options.historizing = false] {Boolean}
 * @param [options.permissions] {Permissions}
 * @param options.parentNodeId {NodeId}
 *
 *  The AccessLevel Attribute is used to indicate how the Value of a Variable can be accessed (read/write) and if it
 *  contains current and/or historic data. The AccessLevel does not take any user access rights into account,
 *  i.e. although the Variable is writable this may be restricted to a certain user / user group.
 *  The AccessLevel is an 8-bit unsigned integer with the structure defined in the following table:
 *
 *  Field            Bit    Description
 *  CurrentRead      0      Indicates if the current value is readable
 *                          (0 means not readable, 1 means readable).
 *  CurrentWrite     1      Indicates if the current value is writable
 *                          (0 means not writable, 1 means writable).
 *  HistoryRead      2      Indicates if the history of the value is readable
 *                          (0 means not readable, 1 means readable).
 *  HistoryWrite     3      Indicates if the history of the value is writable (0 means not writable, 1 means writable).
 *  SemanticChange   4      Indicates if the Variable used as Property generates SemanticChangeEvents (see 9.31).
 *  Reserved         5:7    Reserved for future use. Shall always be zero.
 *
 *  The first two bits also indicate if a current value of this Variable is available and the second two bits
 *  indicates if the history of the Variable is available via the OPC UA server.
 *
 */

export class UAVariable extends BaseNode implements UAVariablePublic {

    public readonly nodeClass = NodeClass.Variable;
    public dataType: NodeId;

    public $historicalDataConfiguration?: HistoricalDataConfiguration;
    public varHistorian?: IVariableHistorian;

    /**
     * @internal
     */
    public _dataValue: DataValue;
    public accessLevel: number;
    public userAccessLevel: number;
    public valueRank: number;
    public minimumSamplingInterval: number;
    public historizing: boolean;
    public semantic_version: number;
    public _permissions: any | null;
    public arrayDimensions: null | number[];

    public $extensionObject?: any;
    public _timestamped_get_func: any;
    public _timestamped_set_func: any;
    public _get_func: any;
    public _set_func: any;
    public refreshFunc?: (callback: DataValueCallback) => void;
    public __waiting_callbacks?: any[];

    get typeDefinitionObj(): UAVariableType {
        return super.typeDefinitionObj as UAVariableType;
    }

    constructor(options: any) {

        super(options);

        this.dataType = this.resolveNodeId(options.dataType);    // DataType (NodeId)
        assert(this.dataType instanceof NodeId);

        this.valueRank = options.valueRank || 0;  // UInt32
        assert(typeof this.valueRank === "number");

        this.arrayDimensions = options.arrayDimensions || null;
        assert(_.isNull(this.arrayDimensions) || _.isArray(this.arrayDimensions));

        this.accessLevel = adjust_accessLevel(options.accessLevel);

        this.userAccessLevel = adjust_userAccessLevel(options.userAccessLevel, options.accessLevel);

        this.minimumSamplingInterval = adjust_samplingInterval(options.minimumSamplingInterval);

        this.historizing = !!options.historizing; // coerced to boolean

        this._dataValue = new DataValue({ statusCode: StatusCodes.UncertainInitialValue, value: {} });

        // xx options.value = options.value || { dataType: DataType.Null };

        if (options.value) {
            this.bindVariable(options.value);
        }

        this._permissions = null;
        if (options.permissions) {
            this.setPermissions(options.permissions);
        }
        this.setMaxListeners(5000);

        this.semantic_version = 0;

    }

    public isReadable(context: SessionContext): boolean {
        return (this.accessLevel & AccessLevelFlag.CurrentRead) === AccessLevelFlag.CurrentRead;
    }

    public isUserReadable(context: SessionContext): boolean {
        assert(context instanceof SessionContext);
        if (context.checkPermission) {
            assert(context.checkPermission instanceof Function);
            return context.checkPermission(this, "CurrentRead");
        }
        return (this.userAccessLevel & AccessLevelFlag.CurrentRead) === AccessLevelFlag.CurrentRead;
    }

    public isWritable(context: SessionContext): boolean {
        assert(context instanceof SessionContext);
        return ((this.accessLevel & AccessLevelFlag.CurrentWrite) === AccessLevelFlag.CurrentWrite);
    }

    public isUserWritable(context: SessionContext): boolean {
        assert(context instanceof SessionContext);
        if (context.checkPermission) {
            assert(context.checkPermission instanceof Function);
            return context.checkPermission(this, "CurrentWrite");
        }
        return ((this.userAccessLevel & AccessLevelFlag.CurrentWrite) === AccessLevelFlag.CurrentWrite);
    }

    /**
     *
     *
     * from OPC.UA.Spec 1.02 part 4
     *  5.10.2.4 StatusCodes
     *  Table 51 defines values for the operation level statusCode contained in the DataValue structure of
     *  each values element. Common StatusCodes are defined in Table 166.
     *
     * Table 51 Read Operation Level Result Codes
     *
     *  Symbolic Id                 Description
     *
     *  BadNodeIdInvalid            The syntax of the node id is not valid.
     *  BadNodeIdUnknown            The node id refers to a node that does not exist in the server address space.
     *  BadAttributeIdInvalid       BadAttributeIdInvalid The attribute is not supported for the specified node.
     *  BadIndexRangeInvalid        The syntax of the index range parameter is invalid.
     *  BadIndexRangeNoData         No data exists within the range of indexes specified.
     *  BadDataEncodingInvalid      The data encoding is invalid.
     *                              This result is used if no dataEncoding can be applied because an Attribute other
     *                              than Value was requested or the DataType of the Value Attribute is not a subtype
     *                              of the Structure DataType.
     *  BadDataEncodingUnsupported  The server does not support the requested data encoding for the node.
     *                              This result is used if a dataEncoding can be applied but the passed data encoding
     *                              is not known to the Server.
     *  BadNotReadable              The access level does not allow reading or subscribing to the Node.
     *  BadUserAccessDenied         User does not have permission to perform the requested operation. (table 165)
     */
    public readValue(context?: SessionContext | null, indexRange?: NumericRange, dataEncoding?: string) {

        if (!context) {
            context = SessionContext.defaultContext;
        }

        if (!this.isReadable(context)) {
            return new DataValue({ statusCode: StatusCodes.BadNotReadable });
        }
        if (!this.isUserReadable(context)) {
            return new DataValue({ statusCode: StatusCodes.BadUserAccessDenied });
        }
        if (!isValidDataEncoding(dataEncoding)) {
            return new DataValue({ statusCode: StatusCodes.BadDataEncodingInvalid });
        }

        if (this._timestamped_get_func) {
            assert(this._timestamped_get_func.length === 0);
            this._dataValue = this._timestamped_get_func();
        }

        let dataValue = this._dataValue;

        if (isGoodish(dataValue.statusCode)) {
            // note : extractRange will clone the dataValue
            dataValue = extractRange(dataValue, indexRange);
        }

        /* istanbul ignore next */
        if (dataValue.statusCode.equals(StatusCodes.BadWaitingForInitialData)
            || dataValue.statusCode.equals(StatusCodes.UncertainInitialValue)
        ) {
            debugLog(chalk.red(" Warning:  UAVariable#readValue ")
                + chalk.cyan(this.browseName.toString()) +
                " (" + chalk.yellow(this.nodeId.toString()) + ") exists but dataValue has not been defined");
        }
        return dataValue;
    }

    public isEnumeration(): boolean {
        // DataType must be one of Enumeration
        const dataTypeNode = this.addressSpace.findDataType(this.dataType) as UADataType;
        if (!dataTypeNode) {
            throw new Error(" Cannot find  DataType  " + this.dataType.toString() + " in standard address Space");
        }

        const enumerationNode = this.addressSpace.findDataType("Enumeration")!;
        if (!enumerationNode) {
            throw new Error(" Cannot find 'Enumeration' DataType in standard address Space");
        }
        return dataTypeNode.isSupertypeOf(enumerationNode);
    }

    public isExtensionObject(): boolean {
        // DataType must be one of Structure
        const dataTypeNode = this.addressSpace.findDataType(this.dataType) as UADataType;
        if (!dataTypeNode) {
            throw new Error(" Cannot find  DataType  " + this.dataType.toString() + " in standard address Space");
        }
        const structureNode = this.addressSpace.findDataType("Structure")!;
        if (!structureNode) {
            throw new Error(" Cannot find 'Structure' DataType in standard address Space");
        }
        return dataTypeNode.isSupertypeOf(structureNode);
    }

    public _getEnumerationInfo(): EnumerationInfo {
        // DataType must be one of Enumeration
        assert(this.isEnumeration(), "Variable is not an enumeration");
        const dataTypeNode = this.addressSpace.findDataType(this.dataType)! as UADataType;
        return dataTypeNode._getEnumerationInfo();
    }

    public asyncRefresh(...args: any[]): any {

        const oldestDate = args[0] as Date;
        const callback = args[1] as DataValueCallback;

        if (!this.refreshFunc) {
            // no refresh func
            const dataValue = this.readValue();
            dataValue.serverTimestamp = oldestDate;
            dataValue.serverPicoseconds = 0;
            if (oldestDate.getTime() <= dataValue.serverTimestamp!.getTime()) {
                return callback(null, dataValue);
            } else {
                // fake
                return callback(null, dataValue);
            }
        }

        if (this._dataValue.serverTimestamp && (oldestDate.getTime() <= this._dataValue.serverTimestamp!.getTime())) {
            const dataValue = this.readValue();
            dataValue.serverTimestamp = oldestDate;
            dataValue.serverPicoseconds = 0;
            return callback(null, dataValue);
        }

        this.refreshFunc.call(this, (err: Error | null, dataValue?: DataValueLike) => {
            if (err || !dataValue) {
                dataValue = { statusCode: StatusCodes.BadNoDataAvailable };
            }
            if (dataValue !== this._dataValue) {
                this._internal_set_dataValue(coerceDataValue(dataValue), null);
            }
            callback(err, this._dataValue);
        });
    }

    public readEnumValue(): IEnumItem {
        const value = this.readValue().value.value as number;
        const enumInfo = this._getEnumerationInfo();
        const enumV = enumInfo.valueIndex[value];
        return { value, name: enumV ? enumV.name : "?????" };
    }

    public writeEnumValue(value: string | number): void {

        const enumInfo = this._getEnumerationInfo();

        if (_.isString(value)) {

            if (!enumInfo.nameIndex.hasOwnProperty(value)) {

                const possibleValues = Object.keys(enumInfo.nameIndex).join(",");
                throw new Error("UAVariable#writeEnumValue: cannot find value " +
                    value + " in [" + possibleValues + "]");
            }
            const valueIndex = enumInfo.nameIndex[value].value;
            value = valueIndex;
        }
        if (_.isFinite(value)) {

            const possibleValues = Object.keys(enumInfo.nameIndex).join(",");

            if (!enumInfo.valueIndex[value]) {

                throw new Error("UAVariable#writeEnumValue : value out of range " + value +
                    " in [" + possibleValues + "]"
                );
            }
            this.setValueFromSource({
                dataType: DataType.Int32,
                value
            });
        } else {
            throw new Error("UAVariable#writeEnumValue:  value type mismatch");
        }
    }

    public readAttribute(
        context: SessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: string
    ): DataValue {

        if (!context) {
            context = SessionContext.defaultContext;
        }
        assert(context instanceof SessionContext);

        const options: DataValueLike = {};

        if (attributeId !== AttributeIds.Value) {
            if (indexRange && indexRange.isDefined()) {
                options.statusCode = StatusCodes.BadIndexRangeNoData;
                return new DataValue(options);
            }
            if (isDataEncoding(dataEncoding)) {
                options.statusCode = StatusCodes.BadDataEncodingInvalid;
                return new DataValue(options);
            }
        }

        switch (attributeId) {
            case AttributeIds.Value:
                return this.readValue(context, indexRange, dataEncoding);

            case AttributeIds.DataType:
                return this._readDataType();

            case AttributeIds.ValueRank:
                return this._readValueRank();

            case AttributeIds.ArrayDimensions:
                return this._readArrayDimensions();

            case AttributeIds.AccessLevel:
                return this._readAccessLevel(context);

            case AttributeIds.UserAccessLevel:
                return this._readUserAccessLevel(context);

            case AttributeIds.MinimumSamplingInterval:
                return this._readMinimumSamplingInterval();

            case AttributeIds.Historizing:
                return this._readHistorizing();

            default:
                return BaseNode.prototype.readAttribute.call(this, context, attributeId);
        }
    }

    /**
     * setValueFromSource is used to let the device sets the variable values
     * this method also records the current time as sourceTimestamp and serverTimestamp.
     * the method broadcasts an "value_changed" event
     * @method setValueFromSource
     * @param variant  {Variant}
     * @param [statusCode  {StatusCode} = StatusCodes.Good]
     * @param [sourceTimestamp= Now]
     */
    public setValueFromSource(
        variant: VariantLike,
        statusCode?: StatusCode,
        sourceTimestamp?: Date
    ) {

        // istanbul ignore next
        if (variant.hasOwnProperty("value")) {
            if (variant.dataType === null || variant.dataType === undefined) {
                throw new Error("Variant must provide a valid dataType" + variant.toString());
            }
        }

        // if (variant.hasOwnProperty("value")) {
        //     if (variant.dataType === DataType.UInt32) {
        //         if (!_.isFinite(variant.value)) {
        //             throw new Error("Expecting an number");
        //         }
        //     }
        // }

        variant = Variant.coerce(variant);

        const now = coerceClock(sourceTimestamp, 0);

        const dataValue = new DataValue({
            serverPicoseconds: now.picoseconds,
            serverTimestamp: now.timestamp,
            sourcePicoseconds: now.picoseconds,
            sourceTimestamp: now.timestamp,
            statusCode: statusCode || StatusCodes.Good
        });
        dataValue.value = variant as Variant;
        this._internal_set_dataValue(dataValue);
    }

    public writeValue(context: SessionContext, dataValue: DataValue, ...args: any[]): any {
        if (!context) {
            context = SessionContext.defaultContext;
        }

        console.log("xyxy DataValue = ", dataValue.toString());
        if (!dataValue.sourceTimestamp) {


            // source timestamp was not specified by the caller
            // we will set the timestamp ourself with the current clock
            if (context.currentTime) {
                dataValue.sourceTimestamp = context.currentTime;
                dataValue.sourcePicoseconds = 0;
            } else {
                const { timestamp, picoseconds } = getCurrentClock();
                dataValue.sourceTimestamp = timestamp;
                dataValue.sourcePicoseconds = picoseconds;
            }
        }

        if (context.currentTime && !dataValue.serverTimestamp) {
            dataValue.serverTimestamp = context.currentTime;
            dataValue.serverPicoseconds = 0;
        }
        assert(context instanceof SessionContext);

        // adjust arguments if optional indexRange Parameter is not given
        let indexRange: NumericRange | null = null;
        let callback: StatusCodeCallback;
        if (args.length === 1) {
            indexRange = new NumericRange();
            callback = args[0];
        } else if (args.length === 2) {
            indexRange = args[0];
            callback = args[1];
        } else {
            throw new Error("Invalid Number of args");
        }

        assert(_.isFunction(callback));
        assert(dataValue instanceof DataValue);
        // index range could be string
        indexRange = NumericRange.coerce(indexRange);

        // test write permission
        if (!this.isWritable(context)) {
            return callback!(null, StatusCodes.BadNotWritable);
        }
        if (!this.isUserWritable(context)) {
            return callback!(null, StatusCodes.BadUserAccessDenied);
        }

        // adjust special case
        const variant = adjustVariant.call(this, dataValue.value);

        const statusCode = this.checkVariantCompatibility(variant);
        if (statusCode.isNot(StatusCodes.Good)) {
            return callback!(null, statusCode);
        }

        const write_func = this._timestamped_set_func || ((
            dataValue1: DataValue,
            indexRange1: NumericRange,
            callback1: (err: Error | null, statusCode: StatusCode, dataValue?: DataValue | null | undefined) => void
        ) => {
            // xx assert(!indexRange,"indexRange Not Implemented");
            return _default_writable_timestamped_set_func.call(this, dataValue1, callback1);
        });

        if (!write_func) {
            console.log(" warning " + this.nodeId.toString() + " " + this.browseName.toString() + " has no setter. \n");
            console.log("Please make sure to bind the variable or to pass a valid value: new Variant({}) during construction time");
            return callback!(null, StatusCodes.BadNotWritable);
        }
        assert(write_func);

        write_func.call(this, dataValue, indexRange, (
            err: Error | null,
            statusCode1: StatusCode,
            correctedDataValue: DataValue) => {

            if (!err) {

                correctedDataValue = correctedDataValue || dataValue;
                assert(correctedDataValue instanceof DataValue);
                // xx assert(correctedDataValue.serverTimestamp);

                if (indexRange && !indexRange.isEmpty()) {

                    if (!indexRange.isValid()) {
                        return callback!(null, StatusCodes.BadIndexRangeInvalid);
                    }

                    const newArr = correctedDataValue.value.value;
                    // check that source data is an array
                    if (correctedDataValue.value.arrayType !== VariantArrayType.Array) {
                        return callback!(null, StatusCodes.BadTypeMismatch);
                    }

                    // check that destination data is also an array
                    assert(check_valid_array(this._dataValue.value.dataType, this._dataValue.value.value));
                    const destArr = this._dataValue.value.value;
                    const result = indexRange.set_values(destArr, newArr);

                    if (result.statusCode.isNot(StatusCodes.Good)) {
                        return callback!(null, result.statusCode);
                    }
                    correctedDataValue.value.value = result.array;

                    // scrap original array so we detect range
                    this._dataValue.value.value = null;
                }
                this._internal_set_dataValue(correctedDataValue, indexRange);
                // xx this._dataValue = correctedDataValue;
            }
            callback!(err, statusCode1);
        });
    }

    public writeAttribute(
        context: SessionContext,
        writeValueOptions: WriteValueOptions | WriteValue,
        callback?: (err: Error | null, statusCode?: StatusCode) => void
    ): any {

        if (!callback) {
            throw new Error("Internal error");
        }
        const writeValue: WriteValue = writeValueOptions instanceof WriteValue
            ? writeValueOptions as WriteValue
            : new WriteValue(writeValueOptions);

        assert(context instanceof SessionContext);
        assert(writeValue instanceof WriteValue);
        assert(writeValue.value instanceof DataValue);
        assert(writeValue.value!.value instanceof Variant);
        assert(_.isFunction(callback));

        // Spec 1.0.2 Part 4 page 58
        // If the SourceTimestamp or the ServerTimestamp is specified, the Server shall
        // use these values.

        // xx _apply_default_timestamps(writeValue.value);

        switch (writeValue.attributeId) {
            case AttributeIds.Value:
                this.writeValue(context, writeValue.value!, writeValue.indexRange!, callback);
                break;
            case AttributeIds.Historizing:
                if (writeValue.value!.value.dataType !== DataType.Boolean) {
                    return callback(null, StatusCodes.BadNotSupported);
                }
                // if the variable has no historizing in place reject
                if (!(this as any)["hA Configuration"]) {
                    return callback(null, StatusCodes.BadNotSupported);
                }
                // check if user is allowed to do that !
                // TODO

                this.historizing = !!writeValue.value!.value.value; // yes ! indeed !

                return callback(null, StatusCodes.Good);
            default:
                super.writeAttribute(context, writeValue, callback);
                break;
        }
    }

    /**
     * @method checkVariantCompatibility
     * note:
     *     this method is overridden in address-space-data-access
     * @return {StatusCode}
     */
    public checkVariantCompatibility(value: Variant): StatusCode {
        // test dataType
        if (!this._validate_DataType(value.dataType)) {
            return StatusCodes.BadTypeMismatch;
        }
        return StatusCodes.Good;
    }

    /**
     * @method touchValue
     * touch the source timestamp of a Variable and cascade up the change
     * to the parent variable if any.
     *
     * @param [optionalNow=null] {Object}
     * @param optionalNow.timestamp    {Date}
     * @param optionalNow.picoseconds  {Number}
     */
    public touchValue(optionalNow?: PreciseClock): void {
        const variable = this;
        const now = optionalNow || getCurrentClock();
        variable._dataValue.sourceTimestamp = now.timestamp;
        variable._dataValue.sourcePicoseconds = now.picoseconds;
        variable._dataValue.serverTimestamp = now.timestamp;
        variable._dataValue.serverPicoseconds = now.picoseconds;

        variable._dataValue.statusCode = StatusCodes.Good;

        if (variable.minimumSamplingInterval === 0) {
            // xx console.log("xxx touchValue = ",variable.browseName.toString(),variable._dataValue.value.value);
            if (variable.listenerCount("value_changed") > 0) {
                const clonedDataValue = variable.readValue();
                variable.emit("value_changed", clonedDataValue);
            }
        }
        if (variable.parent && variable.parent.nodeClass === NodeClass.Variable) {
            (variable.parent as UAVariable).touchValue(now);
        }
    }

    /**
     * setPermissions
     * set the role and permissions
     *
     * @example
     *
     *    const permissions = {
     *        CurrentRead:  [ "*" ], // all users can read
     *        CurrentWrite: [ "!*", "Administrator" ] // no one except administrator can write
     *    };
     *    node.setPermissions(permissions);
     */
    public setPermissions(permissions: Permissions): void {
        this._permissions = permissions;
    }

    /**
     * bind a variable with a get and set functions.
     *
     * @method bindVariable
     * @param options
     * @param [options.dataType=null]    the nodeId of the dataType
     * @param [options.accessLevel]      AccessLevelFlagItem
     * @param [options.userAccessLevel]  AccessLevelFlagItem
     * @param [options.set]              the variable setter function
     * @param [options.get]              the variable getter function. the function must return a Variant or a status code
     * @param [options.timestamped_get]  the getter function. this function must return a object with the following
     * @param [options.historyRead]
     *
     *  properties:
     *    - value: a Variant or a status code
     *    - sourceTimestamp
     *    - sourcePicoseconds
     * @param [options.timestamped_set]
     * @param [options.refreshFunc]      the variable asynchronous getter function.
     * @param [overwrite {Boolean} = false] set overwrite to true to overwrite existing binding
     * @return void
     *
     *
     * ### Providing read access to the underlying value
     *
     * #### Variation 1
     *
     * In this variation, the user provides a function that returns a Variant with the current value.
     *
     * The sourceTimestamp will be set automatically.
     *
     * The get function is called synchronously.
     *
     * @example
     *
     *
     * ```javascript
     *     ...
     *     var options =  {
     *       get : () => {
     *          return new Variant({...});
     *       },
     *       set : function(variant) {
     *          // store the variant somewhere
     *          return StatusCodes.Good;
     *       }
     *    };
     *    ...
     *    engine.bindVariable(nodeId,options):
     *    ...
     * ```
     *
     *
     * #### Variation 2:
     *
     * This variation can be used when the user wants to specify a specific '''sourceTimestamp''' associated
     * with the current value of the UAVariable.
     *
     * The provided ```timestamped_get``` function should return an object with three properties:
     * * value: containing the variant value or a error StatusCode,
     * * sourceTimestamp
     * * sourcePicoseconds
     *
     * ```javascript
     * ...
     * var myDataValue = new DataValue({
     *   value: {dataType: DataType.Double , value: 10.0},
     *   sourceTimestamp : new Date(),
     *   sourcePicoseconds: 0
     * });
     * ...
     * var options =  {
     *   timestamped_get : () => { return myDataValue;  }
     * };
     * ...
     * engine.bindVariable(nodeId,options):
     * ...
     * // record a new value
     * myDataValue.value.value = 5.0;
     * myDataValue.sourceTimestamp = new Date();
     * ...
     * ```
     *
     *
     * #### Variation 3:
     *
     * This variation can be used when the value associated with the variables requires a asynchronous function call to be
     * extracted. In this case, the user should provide an async method ```refreshFunc```.
     *
     *
     * The ```refreshFunc``` shall do whatever is necessary to fetch the most up to date version of the variable value, and
     * call the ```callback``` function when the data is ready.
     *
     *
     * The ```callback``` function follow the standard callback function signature:
     * * the first argument shall be **null** or **Error**, depending of the outcome of the fetch operation,
     * * the second argument shall be a DataValue with the new UAVariable Value,  a StatusCode, and time stamps.
     *
     *
     * Optionally, it is possible to pass a sourceTimestamp and a sourcePicoseconds value as a third and fourth arguments
     * of the callback. When sourceTimestamp and sourcePicoseconds are missing, the system will set their default value
     * to the current time..
     *
     *
     * ```javascript
     * ...
     * var options =  {
     *    refreshFunc : function(callback) {
     *      ... do_some_async_stuff_to_get_the_new_variable_value
     *      var dataValue = new DataValue({
     *          value: new Variant({...}),
     *          statusCode: StatusCodes.Good,
     *          sourceTimestamp: new Date()
     *      });
     *      callback(null,dataValue);
     *    }
     * };
     * ...
     * variable.bindVariable(nodeId,options):
     * ...
     * ```
     *
     * ### Providing write access to the underlying value
     *
     * #### Variation1 - provide a simple synchronous set function
     *
     *
     * #### Notes
     *   to do : explain return StatusCodes.GoodCompletesAsynchronously;
     *
     */
    public bindVariable(
        options?: BindVariableOptions,
        overwrite?: boolean
    ): void {

        if (overwrite) {
            this._timestamped_set_func = null;
            this._timestamped_get_func = null;
            this._get_func = null;
            this._set_func = null;
            this.refreshFunc = undefined;
            this._historyRead = UAVariable.prototype._historyRead;
        }

        options = options || {};

        assert(!_.isFunction(this._timestamped_set_func), "UAVariable already bound");
        assert(!_.isFunction(this._timestamped_get_func), "UAVariable already bound");
        bind_getter.call(this, options);
        bind_setter.call(this, options);

        if (options.historyRead) {
            assert(!_.isFunction(this._historyRead) ||
                this._historyRead === UAVariable.prototype._historyRead);
            assert(_.isFunction(options.historyRead));

            this._historyRead = options.historyRead;
            assert(this._historyRead.length === 6);
        }

        assert(_.isFunction(this._timestamped_set_func));
        assert(this._timestamped_set_func.length === 3);
    }

    /**
     * @method readValueAsync
     * @param context
     * @param callback
     * @param callback.err
     * @param callback.dataValue
     * @async
     */
    public readValueAsync(
        context?: SessionContext | null,
        callback?: any
    ): any {

        if (!context) {
            context = SessionContext.defaultContext;
        }
        assert(context instanceof SessionContext);
        assert(callback instanceof Function);

        this.__waiting_callbacks = this.__waiting_callbacks || [];
        this.__waiting_callbacks.push(callback);

        const _readValueAsync_in_progress = this.__waiting_callbacks.length >= 2;
        if (_readValueAsync_in_progress) {
            return;
        }

        const readImmediate = (
            innerCallback: (err: Error | null, dataValue: DataValue) => void
        ) => {
            assert(this._dataValue instanceof DataValue);
            const dataValue = this.readValue();
            innerCallback(null, dataValue);
        };

        let func: (innerCallback: (err: Error | null, dataValue: DataValue) => void) => void;

        if (!this.isReadable(context)) {
            func = (innerCallback: (err: Error | null, dataValue: DataValue) => void) => {
                const dataValue = new DataValue({ statusCode: StatusCodes.BadNotReadable });
                innerCallback(null, dataValue);
            };
        } else if (!this.isUserReadable(context)) {
            func = (innerCallback: (err: Error | null, dataValue: DataValue) => void) => {
                const dataValue = new DataValue({ statusCode: StatusCodes.BadUserAccessDenied });
                innerCallback(null, dataValue);
            };
        } else {
            func = _.isFunction(this.refreshFunc) ? this.asyncRefresh.bind(this, new Date()) : readImmediate;
        }

        const satisfy_callbacks = (err: Error | null, dataValue?: DataValue) => {
            // now call all pending callbacks
            const callbacks = this.__waiting_callbacks || [];
            this.__waiting_callbacks = [];
            const n = callbacks.length;
            for (const callback1 of callbacks) {
                callback1.call(this, err, dataValue);
            }
        };

        try {
            func.call(this, satisfy_callbacks);
        } catch (err) {
            // istanbul ignore next
            if (doDebug) {
                debugLog(chalk.red("func readValueAsync has failed "));
                debugLog(" stack", err.stack);
            }
            satisfy_callbacks(err);
        }
    }

    public getWriteMask(): number {
        return super.getWriteMask();
    }

    public getUserWriteMask(): number {
        return super.getUserWriteMask();
    }

    public clone(
        options?: any,
        optionalFilter?: any,
        extraInfo?: any): UAVariable {

        options = options || {};
        options = _.extend(_.clone(options), {

            // check this eventNotifier: this.eventNotifier,
            // check this symbolicName: this.symbolicName,

            accessLevel: this.accessLevel,
            arrayDimensions: this.arrayDimensions,
            dataType: this.dataType,
            historizing: this.historizing,
            minimumSamplingInterval: this.minimumSamplingInterval,
            userAccessLevel: this.userAccessLevel,
            valueRank: this.valueRank,
        });

        const newVariable = _clone.call(this, UAVariable, options, optionalFilter, extraInfo) as UAVariable;

        newVariable.bindVariable();

        assert(_.isFunction(newVariable._timestamped_set_func));

        assert(newVariable.dataType === this.dataType);
        newVariable._dataValue = this._dataValue.clone();
        return newVariable;
    }

    public getDataTypeNode(): UADataType {
        const addressSpace = this.addressSpace;
        const dt = addressSpace.findNode(this.dataType);
        // istanbul ignore next
        if (!dt) {
            throw new Error("cannot find dataType " + this.dataType.toString());
        }
        return dt as UADataType;
    }

    public get dataTypeObj() {
        return this.getDataTypeNode();
    }

    /**
     * @method bindExtensionObject
     * @return {ExtensionObject}
     */
    public bindExtensionObject(optionalExtensionObject?: ExtensionObject): ExtensionObject | null {

        const addressSpace = this.addressSpace;
        const structure = addressSpace.findDataType("Structure");
        let Constructor;
        let extensionObject_;

        if (!structure) {
            // the addressSpace is limited and doesn't provide extension object
            // bindExtensionObject cannot be performed and shall finish here.
            return null;
        }

        if (doDebug) {
            console.log(" ------------------------------ binding ", this.browseName.toString(), this.nodeId.toString());
        }
        assert(structure && structure.browseName.toString() === "Structure",
            "expecting DataType Structure to be in AddressSpace");

        const dt = this.getDataTypeNode();
        if (!dt.isSupertypeOf(structure)) {
            return null;
        }

        // the namespace for the structure browse name elements
        const structureNamespace = dt.nodeId.namespace;

        // -------------------- make sure we do not bind a variable twice ....
        if (this.$extensionObject) {
            assert(utils.isNullOrUndefined(optionalExtensionObject), "unsupported case");
            Constructor = addressSpace.getExtensionObjectConstructor(this.dataType);
            extensionObject_ = this.readValue().value.value;
            assert(extensionObject_.constructor.name === Constructor.name);
            assert(this.$extensionObject.constructor.name === Constructor.name);
            return this.$extensionObject;
            // throw new Error("Variable already bound");
        }
        this.$extensionObject = optionalExtensionObject;

        // ------------------------------------------------------------------

        function prepareVariantValue(dataType: DataType | string, value: VariantLike): VariantLike {
            if (typeof dataType === "string") {
                dataType = (DataType as any)[dataType];
            }
            if ((dataType === DataType.Int32 || dataType === DataType.UInt32) && value && (value as any).key) {
                value = value.value;
            }
            return value;
        }

        const bindProperty = (
            propertyNode: UAVariable,
            name: any,
            extensionObject: any,
            dataTypeNodeId: any
        ) => {

            const dataTypeAsString = DataType[dataTypeNodeId];

            /*
            property.setValueFromSource(new Variant({
                dataType: dataType,
                value: prepareVariantValue(dataType, this.$extensionObject[name])
            }));
             */

            assert(propertyNode.readValue().statusCode.equals(StatusCodes.Good));

            const self = this;
            propertyNode.bindVariable({
                timestamped_get() {
                    const prop = self.$extensionObject[name];
                    if (prop === undefined) {
                        propertyNode._dataValue.value.dataType = DataType.Null
                        propertyNode._dataValue.statusCode = StatusCodes.Good;
                        propertyNode._dataValue.value.value = null;
                        return new DataValue(propertyNode._dataValue);
                    }
                    const value = prepareVariantValue(dataTypeNodeId, prop);
                    propertyNode._dataValue.statusCode = StatusCodes.Good;
                    propertyNode._dataValue.value.value = value;
                    return new DataValue(propertyNode._dataValue);
                },
                timestamped_set(dataValue, callback) {
                    callback(null, StatusCodes.BadNotWritable);
                }
            }, true);
        };

        const components = this.getComponents();

        // ------------------------------------------------------
        // make sure we have a structure
        // ------------------------------------------------------
        const s = this.readValue();
        if (this.dataTypeObj.isAbstract) {
            console.log("Warning the DataType associated with this Variable is abstract ", this.dataTypeObj.browseName.toString());
            console.log("You need to provide a extension object yourself ");
            throw new Error("bindExtensionObject requires a extensionObject as associated dataType is only abstract");
        }
        if (s.value && s.value.dataType === DataType.Null) {

            // create a structure and bind it
            extensionObject_ = this.$extensionObject || addressSpace.constructExtensionObject(this.dataType);
            extensionObject_ = new Proxy(extensionObject_, makeHandler(this));
            this.$extensionObject = extensionObject_;

            const theValue = new Variant({
                dataType: DataType.ExtensionObject,
                value: this.$extensionObject
            });
            this.setValueFromSource(theValue, StatusCodes.Good);

            const self = this;
            this.bindVariable({
                timestamped_get() {
                    self._dataValue.value.value = self.$extensionObject;
                    const d = new DataValue(self._dataValue);
                    d.value = new Variant(d.value);
                    return d;
                },
                timestamped_set(dataValue, callback) {
                    callback(null, StatusCodes.BadNotWritable);
                }
            }, true);

        } else {
            // verify that variant has the correct type
            assert(s.value.dataType === DataType.ExtensionObject);
            this.$extensionObject = s.value.value;
            assert(this.$extensionObject && this.$extensionObject.constructor, "expecting an valid extension object");
            assert(s.statusCode.equals(StatusCodes.Good));

            Constructor = addressSpace.getExtensionObjectConstructor(this.dataType);
            assert(Constructor);
            if (this.$extensionObject.constructor.name !== Constructor.name) {
                throw new Error("Expecting " + Constructor.name + " but got a " + this.$extensionObject.constructor.name);
            }
        }

        let property: any;
        let camelCaseName: any;
        // ------------------------------------------------------
        // now bind each member
        // ------------------------------------------------------
        const definition = dt._getDefinition() as StructureDefinition;

        if (!definition) {
            console.log("xx definition missing in ", dt.toString());
        }

        for (const field of definition?.fields || []) {

            camelCaseName = lowerFirstLetter(field.name!);
            const component = components.filter((f) => f.browseName.name!.toString() === field.name);
            if (component.length === 1) {
                property = component[0];
                /* istanbul ignore next */
            } else {
                assert(component.length === 0);
                // create a variable (Note we may use ns=1;s=parentName/0:PropertyName)
                property = this.namespace.addVariable({
                    browseName: { namespaceIndex: structureNamespace, name: field.name!.toString() },
                    componentOf: this,
                    dataType: field.dataType,
                    minimumSamplingInterval: this.minimumSamplingInterval
                });
                assert(property.minimumSamplingInterval === this.minimumSamplingInterval);
            }

            property._dataValue.statusCode = StatusCodes.Good;
            property.touchValue();

            if (NodeId.sameNodeId(NodeId.nullNodeId, field.dataType)) {
                debugLog("field.dataType is null ! " + field.name + " " + field.description?.text);
                debugLog(" dataType replaced with BaseDataType ");
                field.dataType = this.resolveNodeId("BaseDataType");
            }
            const dataTypeNodeId = addressSpace.findCorrespondingBasicDataType(field.dataType);
            assert(this.$extensionObject.hasOwnProperty(camelCaseName));

            if (doDebug) {
                const x = addressSpace.findNode(field.dataType)!.browseName.toString();
                const basicType = addressSpace.findCorrespondingBasicDataType(field.dataType);
                debugLog(chalk.cyan("xxx"), " dataType",
                    w(field.dataType.toString(), 8),
                    w(field.name!, 35),
                    "valueRank", chalk.cyan(w(field.valueRank.toString(), 3)),
                    chalk.green(w(x, 25)),
                    "basicType = ", chalk.yellow(w(basicType.toString(), 20)),
                    property.nodeId.toString(), property.readValue().statusCode.toString());
            }

            if (this.$extensionObject[camelCaseName] !== undefined && dataTypeNodeId === DataType.ExtensionObject) {
                assert(this.$extensionObject[camelCaseName] instanceof Object);
                this.$extensionObject[camelCaseName] = new Proxy(this.$extensionObject[camelCaseName], makeHandler(property));
                property._dataValue.value = new Variant({
                    dataType: DataType.ExtensionObject,
                    value: this.$extensionObject[camelCaseName]
                });
                property.bindExtensionObject();
                property.$extensionObject = this.$extensionObject[camelCaseName];

            } else {

                const dataTypeAsString = DataType[dataTypeNodeId];
                assert(typeof dataTypeAsString === "string");
                const prop = this.$extensionObject[camelCaseName];

                if (prop === undefined) {
                    property._dataValue.value = new Variant({
                        dataType: DataType.Null,
                    });

                } else {
                    const preparedValue = prepareVariantValue(dataTypeNodeId, prop);
                    property._dataValue.value = new Variant({
                        dataType: dataTypeAsString,
                        value: preparedValue
                    });
                }

                const self = this;
                property.camelCaseName = camelCaseName;
                property.setValueFromSource = function (this: any, variant: VariantLike) {
                    const inner_this = this;
                    variant = Variant.coerce(variant);
                    // xx console.log("PropertySetValueFromSource this", inner_this.nodeId.toString(), inner_this.browseName.toString(), variant.toString(), inner_this.dataType.toString());
                    // xx assert(variant.dataType === this.dataType);
                    self.$extensionObject[inner_this.camelCaseName] = variant.value;
                };
            }
            assert(property.readValue().statusCode.equals(StatusCodes.Good));
            bindProperty(property, camelCaseName, this.$extensionObject, dataTypeNodeId);
        }
        assert(this.$extensionObject instanceof Object);
        return this.$extensionObject;
    }

    public updateExtensionObjectPartial(partialExtensionObject: any) {
        setExtensionObjectValue(this, partialExtensionObject);
        return this.$extensionObject;
    }

    public incrementExtensionObjectPartial(path: any) {

        let name;
        if (typeof path === "string") {
            path = path.split(".");
        }
        assert(path instanceof Array);
        const extensionObject = this.constructExtensionObjectFromComponents();
        let i;
        // read partial value
        const partialData: any = {};
        let p: any = partialData;
        for (i = 0; i < path.length - 1; i++) {
            name = path[i];
            p[name] = {};
            p = p[name];
        }
        name = path[path.length - 1];
        p[name] = 0;

        let c1 = partialData;
        let c2 = extensionObject;

        for (i = 0; i < path.length - 1; i++) {
            name = path[i];
            c1 = partialData[name];
            c2 = extensionObject[name];
        }
        name = path[path.length - 1];
        c1[name] = c2[name];
        c1[name] += 1;

        // xx console.log(partialData);
        setExtensionObjectValue(this, partialData);
    }

    public constructExtensionObjectFromComponents() {
        return this.readValue().value.value;
    }

    public toString() {
        const options = new ToStringBuilder();
        UAVariable_toString.call(this, options);
        return options.toString();
    }

    // ---------------------------------------------------------------------------------------------------
    // History
    // ---------------------------------------------------------------------------------------------------
    public historyRead(
        context: SessionContext,
        historyReadDetails: ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationPoint?: ContinuationPoint | null,
        callback?: CallbackT<HistoryReadResult>
    ): any {

        if (!callback) {
            callback = continuationPoint as any as CallbackT<HistoryReadResult>;
            continuationPoint = undefined;
        }
        assert(context instanceof SessionContext);
        assert(callback instanceof Function);
        if (typeof this._historyRead !== "function") {
            return callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadNotReadable }));
        }
        this._historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint || null, callback);
    }

    public _historyReadRaw(
        context: SessionContext,
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationPoint: ContinuationPoint | null,
        callback: CallbackT<HistoryReadResult>
    ): void {
        throw new Error("");
    }

    public _historyReadRawModify(
        context: SessionContext,
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationPoint?: ContinuationPoint | null,
        callback?: CallbackT<HistoryReadResult>
    ): any {
        throw new Error("");
    }

    public _historyRead(
        context: SessionContext,
        historyReadDetails:
            ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationPoint: ContinuationPoint | null,
        callback: CallbackT<HistoryReadResult>
    ): any {
        const result = new HistoryReadResult({
            statusCode: StatusCodes.BadHistoryOperationUnsupported
        });
        callback(null, result);
    }

    public _historyPush(newDataValue: DataValue): any {
        throw new Error("");
    }

    public _historyReadRawAsync(
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        maxNumberToExtract: number,
        isReversed: boolean,
        reverseDataValue: boolean,
        callback: CallbackT<DataValue[]>
    ): any {
        throw new Error("");
    }

    public _historyReadModify(
        context: SessionContext,
        historyReadRawModifiedDetails: any,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationPoint: ContinuationPoint | null,
        callback: CallbackT<HistoryReadResult>
    ): any {
        throw new Error("");
    }

    public _update_startOfOnlineArchive(newDate: Date): void {
        // please install
        throw new Error("");
    }

    public _update_startOfArchive(newDate: Date): void {
        throw new Error("");
    }

    public _validate_DataType(variantDataType: DataType): boolean {
        return validateDataType(this.addressSpace, this.dataType, variantDataType, this.nodeId);
    }

    public _internal_set_dataValue(
        dataValue: DataValue,
        indexRange?: NumericRange | null
    ) {
        assert(dataValue, "expecting a dataValue");
        assert(dataValue instanceof DataValue, "expecting dataValue to be a DataValue");
        assert(dataValue !== this._dataValue, "expecting dataValue to be different from previous DataValue instance");

        const old_dataValue = this._dataValue;

        this._dataValue = dataValue;
        this._dataValue.statusCode = this._dataValue.statusCode || StatusCodes.Good;

        // repair missing timestamps
        if (!dataValue.serverTimestamp) {
            this._dataValue.serverTimestamp = old_dataValue.serverTimestamp;
            this._dataValue.serverPicoseconds = old_dataValue.serverPicoseconds;
        }
        if (!dataValue.sourceTimestamp) {
            this._dataValue.sourceTimestamp = old_dataValue.sourceTimestamp;
            this._dataValue.sourcePicoseconds = old_dataValue.sourcePicoseconds;
        }

        if (!sameDataValue(old_dataValue, dataValue)) {
            this.emit("value_changed", this._dataValue, indexRange);
        }
    }

    public _conditionRefresh(_cache?: any) {
        apply_condition_refresh.call(this, _cache);
    }

    public handle_semantic_changed() {
        this.semantic_version = this.semantic_version + 1;
        this.emit("semantic_changed");
    }

    private _readDataType(): DataValue {
        assert(this.dataType instanceof NodeId);
        const options = {
            statusCode: StatusCodes.Good,
            value: {
                dataType: DataType.NodeId,
                value: this.dataType
            }
        };
        return new DataValue(options);
    }

    private _readValueRank(): DataValue {
        assert(typeof this.valueRank === "number");
        const options = {
            statusCode: StatusCodes.Good,
            value: { dataType: DataType.Int32, value: this.valueRank }
        };
        return new DataValue(options);
    }

    private _readArrayDimensions(): DataValue {
        assert(_.isArray(this.arrayDimensions) || this.arrayDimensions === null);
        const options = {
            statusCode: StatusCodes.Good,
            value: { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: this.arrayDimensions }
        };
        return new DataValue(options);
    }

    private _readAccessLevel(context: SessionContext): DataValue {
        assert(context instanceof SessionContext);
        const options = {
            statusCode: StatusCodes.Good,
            value: { dataType: DataType.Byte, value: convertAccessLevelFlagToByte(this.accessLevel) }
        };
        return new DataValue(options);
    }

    private _readUserAccessLevel(context: SessionContext): DataValue {

        assert(context instanceof SessionContext);

        const effectiveUserAccessLevel = _calculateEffectiveUserAccessLevelFromPermission(
            this,
            context,
            this.userAccessLevel
        );

        const options = {
            value: {
                dataType: DataType.Byte,
                statusCode: StatusCodes.Good,
                value: convertAccessLevelFlagToByte(effectiveUserAccessLevel)
            }
        };
        return new DataValue(options);
    }

    private _readMinimumSamplingInterval(): DataValue {
        // expect a Duration => Double
        const options: DataValueLike = {};
        if (this.minimumSamplingInterval === undefined) {
            options.statusCode = StatusCodes.BadAttributeIdInvalid;
        } else {
            options.value = { dataType: DataType.Double, value: this.minimumSamplingInterval };
            options.statusCode = StatusCodes.Good;
        }
        return new DataValue(options);
    }

    private _readHistorizing(): DataValue {
        assert(typeof (this.historizing) === "boolean");
        const options = {
            statusCode: StatusCodes.Good,
            value: { dataType: DataType.Boolean, value: !!this.historizing }
        };
        return new DataValue(options);
    }
}

// tslint:disable:no-var-requires
const thenify = require("thenify");
UAVariable.prototype.asyncRefresh = thenify.withCallback(UAVariable.prototype.asyncRefresh);
UAVariable.prototype.writeValue = thenify.withCallback(UAVariable.prototype.writeValue);
UAVariable.prototype.writeAttribute = thenify.withCallback(UAVariable.prototype.writeAttribute);
UAVariable.prototype.historyRead = thenify.withCallback(UAVariable.prototype.historyRead);
UAVariable.prototype.readValueAsync = thenify.withCallback(UAVariable.prototype.readValueAsync);

export interface UAVariable {
    $$variableType?: any;
    $$dataType?: any;
    $$getElementBrowseName: any;
    $$extensionObjectArray: any;
    $$indexPropertyName: any;

}

function check_valid_array(dataType: DataType, array: any): boolean {
    if (_.isArray(array)) {
        return true;
    }
    switch (dataType) {
        case DataType.Double:
            return array instanceof Float64Array;
        case DataType.Float:
            return array instanceof Float32Array;
        case DataType.Int32:
            return array instanceof Int32Array;
        case DataType.Int16:
            return array instanceof Int16Array;
        case DataType.SByte:
            return array instanceof Int8Array;
        case DataType.UInt32:
            return array instanceof Uint32Array;
        case DataType.UInt16:
            return array instanceof Uint16Array;
        case DataType.Byte:
            return array instanceof Uint8Array || array instanceof Buffer;
    }
    return false;
}

function _apply_default_timestamps(dataValue: DataValue): void {
    const now = getCurrentClock();
    assert(dataValue instanceof DataValue);

    if (!dataValue.sourceTimestamp) {
        dataValue.sourceTimestamp = now.timestamp;
        dataValue.sourcePicoseconds = now.picoseconds;
    }
    if (!dataValue.serverTimestamp) {
        dataValue.serverTimestamp = now.timestamp;
        dataValue.serverPicoseconds = now.picoseconds;
    }
}

function _calculateEffectiveUserAccessLevelFromPermission(
    node: BaseNode,
    context: SessionContext,
    userAccessLevel: AccessLevelFlag
) {

    function __adjustFlag(flagName: string, userAccessLevel1: AccessLevelFlag): AccessLevelFlag {
        assert(AccessLevelFlag.hasOwnProperty(flagName));
        // xx if (userAccessLevel & AccessLevelFlag[flagName] === AccessLevelFlag[flagName]) {
        if (context.checkPermission(node, flagName)) {
            userAccessLevel1 = userAccessLevel1 | (AccessLevelFlag as any)[flagName];
        }
        // xx }
        return userAccessLevel1;
    }

    if (context.checkPermission) {
        userAccessLevel = 0;
        assert(context.checkPermission instanceof Function);
        userAccessLevel = __adjustFlag("CurrentRead", userAccessLevel);
        userAccessLevel = __adjustFlag("CurrentWrite", userAccessLevel);
        userAccessLevel = __adjustFlag("HistoryRead", userAccessLevel);
        userAccessLevel = __adjustFlag("HistoryWrite", userAccessLevel);
        userAccessLevel = __adjustFlag("SemanticChange", userAccessLevel);
        userAccessLevel = __adjustFlag("StatusWrite", userAccessLevel);
        userAccessLevel = __adjustFlag("TimestampWrite", userAccessLevel);
    }
    return userAccessLevel;
}

function adjustVariant(this: UAVariable, variant: Variant): Variant {

    // convert Variant( Scalar|ByteString) =>  Variant(Array|ByteArray)
    const addressSpace = this.addressSpace;

    const basicType = addressSpace.findCorrespondingBasicDataType(this.dataType);

    if (basicType === DataType.Byte && this.valueRank === 1) {
        if (variant.arrayType === VariantArrayType.Scalar && variant.dataType === DataType.ByteString) {

            if ((this.dataType.value === DataType.Byte) && (this.dataType.namespace === 0)) { // Byte
                variant.arrayType = VariantArrayType.Array;
                variant.dataType = DataType.Byte;
                assert(variant.dataType === DataType.Byte);
                assert(!variant.value || variant.value instanceof Buffer);
            }
        }
    }
    if (basicType === DataType.ByteString && this.valueRank === -1 /* Scalar*/) {

        if (variant.arrayType === VariantArrayType.Array && variant.dataType === DataType.Byte) {
            if ((this.dataType.value === DataType.ByteString) && (this.dataType.namespace === 0)) { // Byte
                variant.arrayType = VariantArrayType.Scalar;
                variant.dataType = DataType.ByteString;
                assert(variant.dataType === DataType.ByteString);
                assert(!variant.value || variant.value instanceof Buffer);
            }
        }
    }

    return variant;

}

function _not_writable_timestamped_set_func(
    dataValue: DataValue,
    callback: (err: Error | null, statusCode: StatusCode, dataValue?: DataValue | null) => void
) {
    assert(dataValue instanceof DataValue);
    callback(null, StatusCodes.BadNotWritable, null);
}

function _default_writable_timestamped_set_func(
    dataValue: DataValue,
    callback: (err: Error | null, statusCode: StatusCode, dataValue?: DataValue | null) => void
) {
    /* jshint validthis: true */
    assert(dataValue instanceof DataValue);
    callback(null, StatusCodes.Good, dataValue);
}

function turn_sync_to_async<T, D, R>(
    f: (this: T, data: D) => R,
    numberOfArgs: number
) {
    if (f.length <= numberOfArgs) {
        return function (
            this: T,
            data: D,
            callback: (err: Error | null, r?: R) => void
        ) {
            const r = f.call(this, data);
            setImmediate(() => {
                return callback(null, r);
            });
        };
    } else {
        assert(f.length === numberOfArgs + 1);
        return f;
    }
}

const _default_minimumSamplingInterval = 1000;

function coerceDataValue(dataValue: DataValue | DataValueLike): DataValue {
    if (dataValue instanceof DataValue) {
        return dataValue;
    }
    return new DataValue(dataValue);
}

// variation #3 :
function _Variable_bind_with_async_refresh(this: UAVariable, options: any) {
    /* jshint validthis: true */
    assert(this instanceof UAVariable);

    assert(_.isFunction(options.refreshFunc));
    assert(!options.get, "a getter shall not be specified when refreshFunc is set");
    assert(!options.timestamped_get, "a getter shall not be specified when refreshFunc is set");

    assert(!this.refreshFunc);

    this.refreshFunc = options.refreshFunc;

    // assert(this.readValue().statusCode === StatusCodes.BadNodeIdUnknown);
    this._dataValue.statusCode = StatusCodes.UncertainInitialValue;

    // TO DO : REVISIT THIS ASSUMPTION
    if (false && this.minimumSamplingInterval === 0) {
        // when a getter /timestamped_getter or async_getter is provided
        // samplingInterval cannot be 0, as the item value must be scanned to be updated.
        this.minimumSamplingInterval = _default_minimumSamplingInterval; // MonitoredItem.minimumSamplingInterval;
        debugLog("adapting minimumSamplingInterval on " + this.browseName.toString() + " to " + this.minimumSamplingInterval);
    }

}

// variation 2
function _Variable_bind_with_timestamped_get(
    this: UAVariable,
    options: any
) {
    /* jshint validthis: true */
    assert(this instanceof UAVariable);
    assert(_.isFunction(options.timestamped_get));
    assert(!options.get, "should not specify 'get' when 'timestamped_get' exists ");
    assert(!this._timestamped_get_func);

    const async_refresh_func = (callback: (err: Error | null, dataValue: DataValue) => void) => {
        const dataValue = this._timestamped_get_func();
        callback(null, dataValue);
    };

    if (options.timestamped_get.length === 0) {
        // sync version
        this._timestamped_get_func = options.timestamped_get;

        const dataValue_verify = this._timestamped_get_func();
        /* istanbul ignore next */
        if (!(dataValue_verify instanceof DataValue)) {
            console.log(
                chalk.red(" Bind variable error: "),
                " the timestamped_get function must return a DataValue");
            console.log("value_check.constructor.name ", dataValue_verify ? dataValue_verify.constructor.name : "null");
            throw new Error(
                " Bind variable error: " +
                " the timestamped_get function must return a DataValue");
        }
        _Variable_bind_with_async_refresh.call(this, { refreshFunc: async_refresh_func });

    } else if (options.timestamped_get.length === 1) {

        _Variable_bind_with_async_refresh.call(this, { refreshFunc: options.timestamped_get });

    } else {
        throw new Error("timestamped_get has a invalid number of argument , should be 0 or 1  ");
    }

}

// variation 1
function _Variable_bind_with_simple_get(
    this: UAVariable,
    options: any
) {
    /* jshint validthis: true */
    assert(this instanceof UAVariable);
    assert(_.isFunction(options.get), "should specify get function");
    assert(options.get.length === 0, "get function should not have arguments");
    assert(!options.timestamped_get, "should not specify a timestamped_get function when get is specified");
    assert(!this._timestamped_get_func);
    assert(!this._get_func);

    this._get_func = options.get;

    const timestamped_get_func_from__Variable_bind_with_simple_get = () => {

        const value = this._get_func();

        /* istanbul ignore next */
        if (!is_Variant_or_StatusCode(value)) {
            console.log(chalk.red(" Bind variable error: "), " : the getter must return a Variant or a StatusCode");
            console.log("value_check.constructor.name ", value ? value.constructor.name : "null");
            throw new Error(" bindVariable : the value getter function returns a invalid result ( expecting a Variant or a StatusCode !!!");
        }
        if (is_StatusCode(value)) {
            return new DataValue({ statusCode: value });

        } else {
            if (!this._dataValue || !isGoodish(this._dataValue.statusCode) || !sameVariant(this._dataValue.value, value)) {

                this.setValueFromSource(value, StatusCodes.Good);
            } else {
                // XXXY console.log("YYYYYYYYYYYYYYYYYYYYYYYYYY",this.browseName.toString());
            }
            return this._dataValue;
        }
    };

    _Variable_bind_with_timestamped_get.call(this, { timestamped_get: timestamped_get_func_from__Variable_bind_with_simple_get });
}

function _Variable_bind_with_simple_set(
    this: UAVariable,
    options: any
) {
    assert(this instanceof UAVariable);
    assert(_.isFunction(options.set), "should specify set function");
    assert(!options.timestamped_set, "should not specify a timestamped_set function");

    assert(!this._timestamped_set_func);
    assert(!this._set_func);

    this._set_func = turn_sync_to_async(options.set, 1);
    assert(this._set_func.length === 2, " set function must have 2 arguments ( variant, callback)");

    this._timestamped_set_func = (
        timestamped_value: DataValue,
        indexRange: NumericRange,
        callback: (err: Error | null, statusCode: StatusCode, dataValue: DataValue) => void
    ) => {
        assert(timestamped_value instanceof DataValue);
        this._set_func(timestamped_value.value, (err: Error | null, statusCode: StatusCode) => {
            if (!err && !statusCode) {
                console.log(chalk.red("UAVariable Binding Error _set_func must return a StatusCode, check the bindVariable parameters"));
                console.log(chalk.yellow("StatusCode.Good is assumed"));
                return callback(err, StatusCodes.Good, timestamped_value);
            }
            callback(err, statusCode, timestamped_value);
        });
    };
}

function _Variable_bind_with_timestamped_set(
    this: UAVariable,
    options: any
) {
    assert(this instanceof UAVariable);
    assert(_.isFunction(options.timestamped_set));
    assert(options.timestamped_set.length === 2, "timestamped_set must have 2 parameters  timestamped_set: function(dataValue,callback){}");
    assert(!options.set, "should not specify set when timestamped_set_func exists ");
    this._timestamped_set_func = (
        dataValue: DataValue,
        indexRange: NumericRange,
        callback: (err: Error | null, statusCode: StatusCode, dataValue: DataValue) => void
    ) => {
        // xx assert(!indexRange,"indexRange Not Implemented");
        return options.timestamped_set.call(this, dataValue, callback);
    };
}

function bind_setter(
    this: UAVariable,
    options: any
) {

    if (_.isFunction(options.set)) {                                    // variation 1
        _Variable_bind_with_simple_set.call(this, options);

    } else if (_.isFunction(options.timestamped_set)) {                 // variation 2
        assert(_.isFunction(options.timestamped_get), "timestamped_set must be used with timestamped_get ");
        _Variable_bind_with_timestamped_set.call(this, options);

    } else if (_.isFunction(options.timestamped_get)) {
        // timestamped_get is  specified but timestamped_set is not
        // => Value is read-only
        _Variable_bind_with_timestamped_set.call(this, {
            timestamped_set: _not_writable_timestamped_set_func
        });

    } else {
        _Variable_bind_with_timestamped_set.call(this, {
            timestamped_set: _default_writable_timestamped_set_func
        });
    }
}

function bind_getter(
    this: UAVariable,
    options: any
) {

    if (_.isFunction(options.get)) {                                   // variation 1
        _Variable_bind_with_simple_get.call(this, options);

    } else if (_.isFunction(options.timestamped_get)) {                // variation 2
        _Variable_bind_with_timestamped_get.call(this, options);

    } else if (_.isFunction(options.refreshFunc)) {                     // variation 3
        _Variable_bind_with_async_refresh.call(this, options);

    } else {
        assert(!options.set, "getter is missing : a getter must be provided if a setter is provided");
        // xx bind_variant.call(this,options);
        if (options.dataType !== undefined) {
            this.setValueFromSource(options);
        }
    }
}

function w(str: string, n: number): string {
    return (str + "                                                              ").substr(0, n);
}

function _getter(
    target: any,
    key: string/*, receiver*/
) {
    if (target[key] === undefined) {
        return undefined;
    }
    return target[key];
}

function _setter(
    variable: any,
    target: any,
    key: string,
    value: any/*, receiver*/
) {
    target[key] = value;
    if (variable[key] && variable[key].touchValue) {
        variable[key].touchValue();
    }
    return true; // true means the set operation has succeeded
}

function makeHandler(variable: UAVariable) {
    const handler = {
        get: _getter,
        set: _setter.bind(null, variable)
    };
    return handler;
}

function setExtensionObjectValue(
    node: UAVariable,
    partialObject: any
) {

    const extensionObject = node.$extensionObject;
    if (!extensionObject) {
        throw new Error("setExtensionObjectValue node has no extension object " + node.browseName.toString());
    }

    function _update_extension_object(extObject: any, partialObject1: any) {
        const keys = Object.keys(partialObject1);
        for (const prop of keys) {
            if (extObject[prop] instanceof Object) {
                _update_extension_object(extObject[prop], partialObject1[prop]);
            } else {
                extObject[prop] = partialObject1[prop];
            }
        }
    }

    _update_extension_object(extensionObject, partialObject);
}

// x TO DO
// require("./data_access/ua_variable_data_access");
// require("./historical_access/ua_variable_history");
