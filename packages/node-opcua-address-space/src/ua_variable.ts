/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-bitwise
// tslint:disable:no-console
// tslint:disable:max-line-length
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";

import {
    isValidDataEncoding,
    convertAccessLevelFlagToByte,
    QualifiedNameLike,
    NodeClass,
    AccessLevelFlag,
    makeAccessLevelFlag,
    AttributeIds,
    isDataEncoding,
    AccessLevelFlagString
} from "node-opcua-data-model";
import { extractRange, sameDataValue, DataValue, DataValueLike } from "node-opcua-data-value";
import { coerceClock, getCurrentClock, PreciseClock } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { WriteValue, WriteValueOptions } from "node-opcua-service-write";
import { StatusCode, StatusCodes, CallbackT } from "node-opcua-status-code";
import {
    HistoryReadResult,
    PermissionType,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails,
    StructureDefinition
} from "node-opcua-types";
import * as utils from "node-opcua-utils";
import { lowerFirstLetter } from "node-opcua-utils";
import { Variant, VariantLike, DataType, sameVariant, VariantArrayType, adjustVariant } from "node-opcua-variant";
import { StatusCodeCallback } from "node-opcua-status-code";

import {
    AddressSpace,
    BindVariableOptions,
    BindVariableOptionsVariation1,
    BindVariableOptionsVariation2,
    BindVariableOptionsVariation3,
    ContinuationPoint,
    DataValueCallback,
    HistoricalDataConfiguration,
    IVariableHistorian,
    PseudoSession,
    UADataType as UADataTypePublic,
    UAVariable as UAVariablePublic,
    UAVariableType,
} from "../source";
import { BaseNode, InternalBaseNodeOptions } from "./base_node";
import {
    _clone,
    apply_condition_refresh,
    BaseNode_toString,
    ToStringBuilder,
    UAVariable_toString,
    valueRankToString
} from "./base_node_private";
import { SessionContext } from "./session_context";
import { EnumerationInfo, IEnumItem, UADataType } from "./ua_data_type";

const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = checkDebugFlag(__filename);
const errorLog = make_errorLog(__filename);

function isGoodish(statusCode: StatusCode) {
    return statusCode.value < 0x10000000;
}

export function adjust_accessLevel(accessLevel: string | number | null): AccessLevelFlag {
    accessLevel = utils.isNullOrUndefined(accessLevel) ? "CurrentRead | CurrentWrite" : accessLevel;
    accessLevel = makeAccessLevelFlag(accessLevel);
    assert(isFinite(accessLevel));
    return accessLevel;
}

export function adjust_userAccessLevel(
    userAccessLevel: string | number | null | undefined, accessLevel: string | number | null
): AccessLevelFlag | undefined {
    if (userAccessLevel === undefined) {
        return undefined;
    }
    userAccessLevel = adjust_accessLevel(userAccessLevel);
    accessLevel = adjust_accessLevel(accessLevel);
    return makeAccessLevelFlag(accessLevel & userAccessLevel);
}

function adjust_samplingInterval(minimumSamplingInterval: number): number {
    assert(isFinite(minimumSamplingInterval));
    if (minimumSamplingInterval < 0) {
        return -1; // only -1 is a valid negative value for samplingInterval and means "unspecified"
    }
    return minimumSamplingInterval;
}

function is_Variant(v: any): boolean {
    return v instanceof Variant;
}

function is_StatusCode(v: any): boolean {
    return (
        v &&
        v.constructor &&
        (v.constructor.name === "ConstantStatusCode" ||
            v.constructor.name === "StatusCode" ||
            v.constructor.name === "ModifiableStatusCode")
    );
}

function is_Variant_or_StatusCode(v: any): boolean {
    if (is_Variant(v)) {
        // /@@assert(v.isValid());
    }
    return is_Variant(v) || is_StatusCode(v);
}

function _dataType_toUADataType(addressSpace: AddressSpace, dataType: DataType): UADataType {
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
    nodeId: NodeId,
    allowNulls: boolean
): boolean {
    if (variantDataType === DataType.ExtensionObject) {
        return true;
    }
    if (variantDataType === DataType.Null && allowNulls) {
        return true;
    }
    if (variantDataType === DataType.Null && !allowNulls) {
        return false;
    }
    let builtInType: string;
    let builtInUADataType: UADataTypePublic;

    const destUADataType = addressSpace.findNode(dataTypeNodeId) as UADataType;
    assert(destUADataType instanceof UADataType);

    if (destUADataType.isAbstract || destUADataType.nodeId.namespace !== 0) {
        builtInUADataType = destUADataType;
    } else {
        builtInType = DataType[addressSpace.findCorrespondingBasicDataType(destUADataType)];
        builtInUADataType = addressSpace.findDataType(builtInType)!;
    }
    assert(builtInUADataType instanceof UADataType);

    const enumerationUADataType = addressSpace.findDataType("Enumeration");
    if (!enumerationUADataType) {
        throw new Error("cannot find Enumeration DataType node in standard address space");
    }
    if (destUADataType.isSupertypeOf(enumerationUADataType)) {
        // istanbul ignore next
        if (doDebug) {
            console.log("destUADataType.", destUADataType.browseName.toString(), destUADataType.nodeId.toString());
            console.log(
                "enumerationUADataType.",
                enumerationUADataType.browseName.toString(),
                enumerationUADataType.nodeId.toString()
            );
        }
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

    return dest_isSuperTypeOf_variant;
}

interface UAVariableOptions extends InternalBaseNodeOptions {
    value?: any;
    dataType: NodeId | string;
    valueRank?: number;
    arrayDimensions?: null | number[];
    accessLevel?: any;
    userAccessLevel?: any;
    minimumSamplingInterval?: number; // default -1
    historizing?: number;
}

export function verifyRankAndDimensions(options: { valueRank?: number; arrayDimensions?: number[] | null }) {
    // evaluate valueRank arrayDimensions is specified but valueRank is null
    if (options.arrayDimensions && options.valueRank === undefined) {
        options.valueRank = options.arrayDimensions.length;
    }
    options.valueRank = options.valueRank === undefined ? -1 : options.valueRank || 0; // UInt32
    assert(typeof options.valueRank === "number");

    options.arrayDimensions = options.arrayDimensions || null;
    assert(options.arrayDimensions === null || Array.isArray(options.arrayDimensions));

    if (options.arrayDimensions && options.valueRank <= 0) {
        throw new Error("[CONFORMANCE] arrayDimensions must be null if valueRank <=0");
    }
    // specify default arrayDimension if not provided
    if (options.valueRank > 0 && !options.arrayDimensions) {
        options.arrayDimensions = new Array(options.valueRank).fill(0);
    }
    if (!options.arrayDimensions && options.valueRank > 0) {
        throw new Error("[CONFORMANCE] arrayDimension must be specified  if valueRank >0 " + options.valueRank);
    }
    if (options.valueRank > 0 && options.arrayDimensions!.length !== options.valueRank) {
        throw new Error(
            "[CONFORMANCE] when valueRank> 0, arrayDimensions must have valueRank elements, this.valueRank =" +
            options.valueRank +
            "  whereas arrayDimensions.length =" +
            options.arrayDimensions!.length
        );
    }
}

type TimestampGetFunction1 = () => DataValue | Promise<DataValue>;
type TimestampGetFunction2 = (callback: (err: Error | null, dataValue?: DataValue) => void) => void;
type TimestampGetFunction = TimestampGetFunction1 | TimestampGetFunction2;

type TimestampSetFunction1 = (this: UAVariable, dataValue: DataValue, indexRange: NumericRange) => void | Promise<void>;
type TimestampSetFunction2 = (
    this: UAVariable,
    dataValue: DataValue,
    indexRange: NumericRange,
    callback: (err: Error | null, StatusCode: StatusCode) => void
) => void;
type TimestampSetFunction = TimestampSetFunction1 | TimestampSetFunction2;

/**
 * A OPCUA Variable Node
 *
 * @class UAVariable
 * @constructor
 * @extends  BaseNode
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
    public userAccessLevel?: number;
    public valueRank: number;
    public minimumSamplingInterval: number;
    public historizing: boolean;
    public semantic_version: number;
    public arrayDimensions: null | number[];

    public $extensionObject?: any;
    public _timestamped_get_func?: TimestampGetFunction | null;
    public _timestamped_set_func?: TimestampSetFunction | null;
    public _get_func: any;
    public _set_func: any;
    public refreshFunc?: (callback: DataValueCallback) => void;
    public __waiting_callbacks?: any[];

    get typeDefinitionObj(): UAVariableType {
        return super.typeDefinitionObj as UAVariableType;
    }

    constructor(options: UAVariableOptions) {
        super(options);

        verifyRankAndDimensions(options);
        this.valueRank = options.valueRank!;
        this.arrayDimensions = options.arrayDimensions!;

        this.dataType = this.resolveNodeId(options.dataType); // DataType (NodeId)

        this.accessLevel = adjust_accessLevel(options.accessLevel);

        this.userAccessLevel = adjust_userAccessLevel(options.userAccessLevel, this.accessLevel);

        this.minimumSamplingInterval = adjust_samplingInterval(options.minimumSamplingInterval || 0);

        this.historizing = !!options.historizing; // coerced to boolean

        this._dataValue = new DataValue({ statusCode: StatusCodes.UncertainInitialValue, value: {} });

        // xx options.value = options.value || { dataType: DataType.Null };

        if (options.value) {
            this.bindVariable(options.value);
        }

        this.setMaxListeners(5000);

        this.semantic_version = 0;
    }

    private checkPermissionAndAccessLevelPrivate(context: SessionContext, permission: PermissionType, accessLevel: AccessLevelFlag) {
        assert(context instanceof SessionContext);
        if (context.checkPermission) {
            assert(context.checkPermission instanceof Function);
            if (!context.checkPermission(this, permission)) {
                return false;
            }
        }
        if (this.userAccessLevel === undefined) {
            return true;
        }
        return (this.userAccessLevel & accessLevel) === accessLevel;
    }

    public isReadable(context: SessionContext): boolean {
        return (this.accessLevel & AccessLevelFlag.CurrentRead) === AccessLevelFlag.CurrentRead;
    }

    public isUserReadable(context: SessionContext): boolean {
        if (!this.isReadable(context)) { return false; }
        return this.checkPermissionAndAccessLevelPrivate(context, PermissionType.Read, AccessLevelFlag.CurrentRead);
    }

    public isWritable(context: SessionContext): boolean {
        return (this.accessLevel & AccessLevelFlag.CurrentWrite) === AccessLevelFlag.CurrentWrite;
    }

    public isUserWritable(context: SessionContext): boolean {
        if (!this.isWritable(context)) { return false; }
        return this.checkPermissionAndAccessLevelPrivate(context, PermissionType.Write, AccessLevelFlag.CurrentWrite);
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

        if(context.isAccessRestricted(this)) {
            return new DataValue({ statusCode: StatusCodes.BadSecurityModeInsufficient});
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
            if (this._timestamped_get_func.length === 0) {
                this._dataValue = (this._timestamped_get_func as TimestampGetFunction1)() as DataValue;
            }
        }

        let dataValue = this._dataValue;

        if (isGoodish(dataValue.statusCode)) {
            // note : extractRange will clone the dataValue
            dataValue = extractRange(dataValue, indexRange);
        }

        /* istanbul ignore next */
        if (
            dataValue.statusCode.equals(StatusCodes.BadWaitingForInitialData) ||
            dataValue.statusCode.equals(StatusCodes.UncertainInitialValue)
        ) {
            debugLog(
                chalk.red(" Warning:  UAVariable#readValue ") +
                chalk.cyan(this.browseName.toString()) +
                " (" +
                chalk.yellow(this.nodeId.toString()) +
                ") exists but dataValue has not been defined"
            );
        }
        return dataValue;
    }

    public isEnumeration(): boolean {
        return this.addressSpace.isEnumeration(this.dataType);
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
        assert(oldestDate instanceof Date);
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

        if (this._dataValue.serverTimestamp && oldestDate.getTime() <= this._dataValue.serverTimestamp!.getTime()) {
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

        if (typeof value === "string") {
            if (!enumInfo.nameIndex.hasOwnProperty(value)) {
                const possibleValues = Object.keys(enumInfo.nameIndex).join(",");
                throw new Error("UAVariable#writeEnumValue: cannot find value " + value + " in [" + possibleValues + "]");
            }
            const valueIndex = enumInfo.nameIndex[value].value;
            value = valueIndex;
        }
        if (isFinite(value)) {
            const possibleValues = Object.keys(enumInfo.nameIndex).join(",");

            if (!enumInfo.valueIndex[value]) {
                throw new Error("UAVariable#writeEnumValue : value out of range " + value + " in [" + possibleValues + "]");
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
        context = context || SessionContext.defaultContext;
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

            case AttributeIds.AccessLevelEx:
                return this._readAccessLevelEx(context);
            default:
                return BaseNode.prototype.readAttribute.call(this, context, attributeId);
        }
    }

    public adjustVariant(variant: Variant): Variant {
        const addressSpace = this.addressSpace;
        const dataTypeNodeId = addressSpace.findCorrespondingBasicDataType(this.dataType);
        return adjustVariant(variant, this.valueRank, dataTypeNodeId);
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
    public setValueFromSource(variant: VariantLike, statusCode?: StatusCode, sourceTimestamp?: Date) {
        statusCode = statusCode || StatusCodes.Good;
        // istanbul ignore next
        if (variant.hasOwnProperty("value")) {
            if (variant.dataType === null || variant.dataType === undefined) {
                throw new Error("Variant must provide a valid dataType" + variant.toString());
            }
            if (
                variant.dataType === DataType.Boolean &&
                (this.dataType.namespace !== 0 || this.dataType.value !== DataType.Boolean)
            ) {
                throw new Error("Variant must provide a valid Boolean" + variant.toString());
            }
            if (
                this.dataType.namespace === 0 &&
                this.dataType.value === DataType.LocalizedText &&
                variant.dataType !== DataType.LocalizedText
            ) {
                throw new Error("Variant must provide a valid LocalizedText" + variant.toString());
            }
        }

        variant = Variant.coerce(variant);

        const now = coerceClock(sourceTimestamp, 0);

        const dataValue = new DataValue(null);
        dataValue.serverPicoseconds = now.picoseconds;
        dataValue.serverTimestamp = now.timestamp;
        dataValue.sourcePicoseconds = now.picoseconds;
        dataValue.sourceTimestamp = now.timestamp;
        dataValue.statusCode = statusCode;
        dataValue.value = variant as Variant;
        this._internal_set_dataValue(dataValue);
    }

    public writeValue(context: SessionContext, dataValue: DataValue, ...args: any[]): any {
        context = context || SessionContext.defaultContext;
        assert(context instanceof SessionContext);

        if (!dataValue.sourceTimestamp) {
            // source timestamp was not specified by the caller
            // we will set the timestamp ourself with the current clock
            if (context.currentTime) {
                dataValue.sourceTimestamp = context.currentTime.timestamp;
                dataValue.sourcePicoseconds = context.currentTime.picoseconds;
            } else {
                const { timestamp, picoseconds } = getCurrentClock();
                dataValue.sourceTimestamp = timestamp;
                dataValue.sourcePicoseconds = picoseconds;
            }
        }

        if (context.currentTime && !dataValue.serverTimestamp) {
            dataValue.serverTimestamp = context.currentTime.timestamp;
            dataValue.serverPicoseconds = context.currentTime.picoseconds;
        }

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

        assert(typeof callback === "function");
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
        const variant = adjustVariant2.call(this, dataValue.value);

        const statusCode = this.checkVariantCompatibility(variant);
        if (statusCode.isNot(StatusCodes.Good)) {
            return callback!(null, statusCode);
        }

        function default_func(this: UAVariable,
            dataValue1: DataValue,
            indexRange1: NumericRange,
            callback1: (err: Error | null, statusCode: StatusCode, dataValue?: DataValue | null | undefined) => void
        ) {
            // xx assert(!indexRange,"indexRange Not Implemented");
            return _default_writable_timestamped_set_func.call(this, dataValue1, callback1);
        }
        const write_func = (this._timestamped_set_func || default_func) as any;


        if (!write_func) {
            console.log(" warning " + this.nodeId.toString() + " " + this.browseName.toString() + " has no setter. \n");
            console.log("Please make sure to bind the variable or to pass a valid value: new Variant({}) during construction time");
            return callback!(null, StatusCodes.BadNotWritable);
        }
        assert(write_func);

        write_func.call(
            this,
            dataValue,
            indexRange,
            (err: Error | null, statusCode1?: StatusCode, correctedDataValue?: DataValue) => {
                if (!err) {
                    correctedDataValue = correctedDataValue || dataValue;
                    assert(correctedDataValue instanceof DataValue);
                    // xx assert(correctedDataValue.serverTimestamp);

                    if (indexRange && !indexRange.isEmpty()) {
                        if (!indexRange.isValid()) {
                            return callback!(null, StatusCodes.BadIndexRangeInvalid);
                        }

                        const newArrayOrMatrix = correctedDataValue.value.value;

                        if (correctedDataValue.value.arrayType === VariantArrayType.Array) {
                            if (this._dataValue.value.arrayType !== VariantArrayType.Array) {
                                return callback(null, StatusCodes.BadTypeMismatch);
                            }
                            // check that destination data is also an array
                            assert(check_valid_array(this._dataValue.value.dataType, this._dataValue.value.value));
                            const destArr = this._dataValue.value.value;
                            const result = indexRange.set_values(destArr, newArrayOrMatrix);

                            if (result.statusCode.isNot(StatusCodes.Good)) {
                                return callback!(null, result.statusCode);
                            }
                            correctedDataValue.value.value = result.array;

                            // scrap original array so we detect range
                            this._dataValue.value.value = null;
                        } else if (correctedDataValue.value.arrayType === VariantArrayType.Matrix) {
                            const dimensions = this._dataValue.value.dimensions;
                            if (this._dataValue.value.arrayType !== VariantArrayType.Matrix || !dimensions) {
                                // not a matrix !
                                return callback!(null, StatusCodes.BadTypeMismatch);
                            }
                            const matrix = this._dataValue.value.value;
                            const result = indexRange.set_values_matrix(
                                {
                                    matrix,
                                    dimensions
                                },
                                newArrayOrMatrix
                            );
                            if (result.statusCode.isNot(StatusCodes.Good)) {
                                return callback!(null, result.statusCode);
                            }
                            correctedDataValue.value.dimensions = this._dataValue.value.dimensions;
                            correctedDataValue.value.value = result.matrix;

                            // scrap original array so we detect range
                            this._dataValue.value.value = null;
                        } else {
                            return callback!(null, StatusCodes.BadTypeMismatch);
                        }
                    }
                    this._internal_set_dataValue(correctedDataValue, indexRange);
                }
                callback!(err, statusCode1);
            }
        );
    }

    public writeAttribute(
        context: SessionContext | null,
        writeValueOptions: WriteValueOptions | WriteValue,
        callback?: (err: Error | null, statusCode?: StatusCode) => void
    ): any {
        // istanbul ignore next
        if (!callback) {
            throw new Error("Internal error");
        }
        const writeValue: WriteValue =
            writeValueOptions instanceof WriteValue ? (writeValueOptions as WriteValue) : new WriteValue(writeValueOptions);

        context = context || SessionContext.defaultContext;

        assert(context instanceof SessionContext);
        assert(writeValue instanceof WriteValue);
        assert(writeValue.value instanceof DataValue);
        assert(writeValue.value!.value instanceof Variant);
        assert(typeof callback === "function");

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
    public bindVariable(options?: BindVariableOptions | VariantLike, overwrite?: boolean): void {
        if (overwrite) {
            this._timestamped_set_func = null;
            this._timestamped_get_func = null;
            this._get_func = null;
            this._set_func = null;
            this.refreshFunc = undefined;
            this._historyRead = UAVariable.prototype._historyRead;
        }

        options = options || {};

        assert(typeof this._timestamped_set_func !== "function", "UAVariable already bound");
        assert(typeof this._timestamped_get_func !== "function", "UAVariable already bound");
        bind_getter.call(this, options as GetterOptions);
        bind_setter.call(this, options as SetterOptions);

        const _historyRead = (options as BindVariableOptionsVariation1).historyRead;
        if (_historyRead) {
            assert(typeof this._historyRead !== "function" || this._historyRead === UAVariable.prototype._historyRead);
            assert(typeof _historyRead === "function");

            this._historyRead = _historyRead;
            assert(this._historyRead.length === 6);
        }

        assert(typeof this._timestamped_set_func === "function");
        assert(this._timestamped_set_func!.length === 3);
    }

    /**
     * @method readValueAsync
     */
    public readValueAsync(context: SessionContext | null, callback: CallbackT<DataValue>): void;
    public readValueAsync(context: SessionContext | null): Promise<DataValue>;
    public readValueAsync(context: SessionContext | null, callback?: any): any {
        if (!context) {
            context = SessionContext.defaultContext;
        }
        assert(callback instanceof Function);

        this.__waiting_callbacks = this.__waiting_callbacks || [];
        this.__waiting_callbacks.push(callback);

        const _readValueAsync_in_progress = this.__waiting_callbacks.length >= 2;
        if (_readValueAsync_in_progress) {
            return;
        }

        const readImmediate = (innerCallback: (err: Error | null, dataValue: DataValue) => void) => {
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
            func = typeof this.refreshFunc === "function" ? this.asyncRefresh.bind(this, new Date()) : readImmediate;
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

    public clone(options?: any, optionalFilter?: any, extraInfo?: any): UAVariable {
        options = options || {};
        options = {
            ...options,
            // check this eventNotifier: this.eventNotifier,
            // check this symbolicName: this.symbolicName,

            accessLevel: this.accessLevel,
            arrayDimensions: this.arrayDimensions,
            dataType: this.dataType,
            historizing: this.historizing,
            minimumSamplingInterval: this.minimumSamplingInterval,
            userAccessLevel: this.userAccessLevel,
            valueRank: this.valueRank
        };

        const newVariable = _clone.call(this, UAVariable, options, optionalFilter, extraInfo) as UAVariable;

        newVariable.bindVariable();

        assert(typeof newVariable._timestamped_set_func === "function");

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

    public checkExtensionObjectIsCorrect(extObj: ExtensionObject | ExtensionObject[] | null): boolean {
        if (!extObj) {
            return true;
        }
        const addressSpace = this.addressSpace;
        if (!(extObj && extObj.constructor)) {
            console.log(extObj);
            throw new Error("expecting an valid extension object");
        }
        const dataType = addressSpace.findDataType(this.dataType);
        if (!dataType) {
            // may be we are in the process of loading a xml file and the corresponding dataType
            // has not yet been loaded !
            return true;
        }
        try {
            const Constructor = addressSpace.getExtensionObjectConstructor(this.dataType);
            if (extObj instanceof Array) {
                for (const e of extObj) {
                    if (!e) {
                        continue;
                    }
                    if (e.constructor.name !== Constructor.name) {
                        debugLog("extObj.constructor.name ", e.constructor.name, "expected", Constructor.name);
                        return false;
                    }
                }
                return true;
            } else {
                return extObj.constructor.name === Constructor.name;
            }
        } catch (err) {
            console.log(err);
            return false;
        }
    }
    /**
     * @method bindExtensionObject
     * @return {ExtensionObject}
     */
    public bindExtensionObject(optionalExtensionObject?: ExtensionObject): ExtensionObject | null {
        const addressSpace = this.addressSpace;
        const structure = addressSpace.findDataType("Structure");
        let extensionObject_;

        if (!structure) {
            // the addressSpace is limited and doesn't provide extension object
            // bindExtensionObject cannot be performed and shall finish here.
            return null;
        }

        // istanbul ignore next
        if (doDebug) {
            console.log(" ------------------------------ binding ", this.browseName.toString(), this.nodeId.toString());
        }
        assert(structure && structure.browseName.toString() === "Structure", "expecting DataType Structure to be in AddressSpace");

        const dt = this.getDataTypeNode();
        if (!dt.isSupertypeOf(structure)) {
            return null;
        }

        // the namespace for the structure browse name elements
        const structureNamespace = dt.nodeId.namespace;

        // -------------------- make sure we do not bind a variable twice ....
        if (this.$extensionObject) {
            // istanbul ignore next
            // if (!force && !utils.isNullOrUndefined(optionalExtensionObject)) {
            //     throw new Error(
            //         "bindExtensionObject: unsupported case : $extensionObject already exists on " +
            //             this.browseName.toString() +
            //             " " +
            //             this.nodeId.toString()
            //     );
            // }
            // istanbul ignore next
            if (!this.checkExtensionObjectIsCorrect(this.$extensionObject!)) {
                console.log(
                    "on node : ",
                    this.browseName.toString(),
                    this.nodeId.toString(),
                    "dataType=",
                    this.dataType.toString({ addressSpace: this.addressSpace })
                );
                console.log(this.$extensionObject?.toString());
                throw new Error(
                    "bindExtensionObject: $extensionObject is incorrect: we are expecting a " +
                    this.dataType.toString({ addressSpace: this.addressSpace }) +
                    " but we got a " +
                    this.$extensionObject?.constructor.name
                );
            }
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

        const bindProperty = (propertyNode: UAVariable, name: any, extensionObject: any, dataTypeNodeId: any) => {
            const dataTypeAsString = DataType[dataTypeNodeId];

            /*
            property.setValueFromSource(new Variant({
                dataType: dataType,
                value: prepareVariantValue(dataType, this.$extensionObject[name])
            }));
             */

            assert(propertyNode.readValue().statusCode.equals(StatusCodes.Good));

            const self = this;
            propertyNode.bindVariable(
                {
                    timestamped_get() {
                        const prop = self.$extensionObject[name];

                        if (prop === undefined) {
                            propertyNode._dataValue.value.dataType = DataType.Null;
                            propertyNode._dataValue.statusCode = StatusCodes.Good;
                            propertyNode._dataValue.value.value = null;
                            return new DataValue(propertyNode._dataValue);
                        }
                        const value = prepareVariantValue(dataTypeNodeId, prop);
                        propertyNode._dataValue.statusCode = StatusCodes.Good;
                        propertyNode._dataValue.value.value = value;
                        return new DataValue(propertyNode._dataValue);
                    },
                    timestamped_set(dataValue: DataValue, callback: CallbackT<StatusCode>) {
                        callback(null, StatusCodes.BadNotWritable);
                    }
                },
                true
            );
        };
        const components = this.getComponents();

        // ------------------------------------------------------
        // make sure we have a structure
        // ------------------------------------------------------
        const s = this.readValue();
        // istanbul ignore next
        if (this.dataTypeObj.isAbstract) {
            console.log("Warning the DataType associated with this Variable is abstract ", this.dataTypeObj.browseName.toString());
            console.log("You need to provide a extension object yourself ");
            throw new Error("bindExtensionObject requires a extensionObject as associated dataType is only abstract");
        }
        if (s.value && (s.value.dataType === DataType.Null || (s.value.dataType === DataType.ExtensionObject && !s.value.value))) {
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
            this.bindVariable(
                {
                    timestamped_get() {
                        self._dataValue.value.value = self.$extensionObject;
                        const d = new DataValue(self._dataValue);
                        d.value = new Variant(d.value);
                        return d;
                    },
                    timestamped_set(dataValue: DataValue, callback: CallbackT<StatusCode>) {
                        const ext = dataValue.value.value;
                        if (!self.checkExtensionObjectIsCorrect(ext)) {
                            return callback(null, StatusCodes.BadInvalidArgument);
                        }

                        self.$extensionObject = new Proxy(ext, makeHandler(self));
                        self.touchValue();
                        callback(null, StatusCodes.Good);
                    }
                },
                true
            );
        } else {
            // verify that variant has the correct type
            assert(s.value.dataType === DataType.ExtensionObject);
            this.$extensionObject = s.value.value;
            assert(this.checkExtensionObjectIsCorrect(this.$extensionObject!));
            assert(s.statusCode.equals(StatusCodes.Good));
        }

        let property: any;
        let camelCaseName: any;
        // ------------------------------------------------------
        // now bind each member
        // ------------------------------------------------------
        const definition = dt._getDefinition(false) as StructureDefinition;

        // istanbul ignore next
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
                // todo: Handle array appropriately...
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

            // istanbul ignore next
            if (doDebug) {
                const x = addressSpace.findNode(field.dataType)!.browseName.toString();
                const basicType = addressSpace.findCorrespondingBasicDataType(field.dataType);
                debugLog(
                    chalk.cyan("xxx"),
                    " dataType",
                    w(field.dataType.toString(), 8),
                    w(field.name!, 35),
                    "valueRank",
                    chalk.cyan(w(valueRankToString(field.valueRank), 10)),
                    chalk.green(w(x, 25)),
                    "basicType = ",
                    chalk.yellow(w(basicType.toString(), 20)),
                    property.nodeId.toString(),
                    property.readValue().statusCode.toString()
                );
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
                        dataType: DataType.Null
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
                    self.touchValue();
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
            callback = (continuationPoint as any) as CallbackT<HistoryReadResult>;
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
        historyReadDetails: ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
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
        return validateDataType(this.addressSpace, this.dataType, variantDataType, this.nodeId, /* allow Nulls */ false);
    }

    public _internal_set_dataValue(dataValue: DataValue, indexRange?: NumericRange | null) {
        assert(dataValue, "expecting a dataValue");
        assert(dataValue instanceof DataValue, "expecting dataValue to be a DataValue");
        assert(dataValue !== this._dataValue, "expecting dataValue to be different from previous DataValue instance");

        // istanbul ignore next
        if (dataValue.value.arrayType === VariantArrayType.Matrix) {
            if (dataValue.value.value.length !== 0 && dataValue.value.value.length !== dataValue.value.dimensions![0] * dataValue.value.dimensions![1]) {
                warningLog("Internal Error: matrix dimension doesn't match : ", dataValue.toString());
            }
        }
        if (dataValue.value.dataType === DataType.ExtensionObject) {
            if (!this.checkExtensionObjectIsCorrect(dataValue.value.value)) {
                console.log(dataValue.toString());
                console.log("on nodeId =", this.nodeId.toString());
                throw new Error("Invalid Extension Object");
            }
        }
        // istanbul ignore next
        if (this.dataType.namespace === 0) {
            if (this.dataType.value === DataType.LocalizedText && dataValue.value.dataType !== DataType.LocalizedText) {
                throw new Error("Invalid dataValue provided (expecting a LocalizedText) but got " + dataValue.toString());
            }
        }

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
        assert(Array.isArray(this.arrayDimensions) || this.arrayDimensions === null);
        assert(!this.arrayDimensions || this.valueRank > 0, "arrayDimension must be null if valueRank <0");
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

    private _readAccessLevelEx(context: SessionContext): DataValue {
        assert(context instanceof SessionContext);
        const options = {
            statusCode: StatusCodes.Good,
            // Extra flags are not supported yet. to do: 
            value: { dataType: DataType.UInt32, value: convertAccessLevelFlagToByte(this.accessLevel) }
        };
        return new DataValue(options);
    }

    private _readUserAccessLevel(context: SessionContext): DataValue {
        assert(context instanceof SessionContext);

        const effectiveUserAccessLevel = _calculateEffectiveUserAccessLevelFromPermission(this, context, this.userAccessLevel);

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
        assert(typeof this.historizing === "boolean");
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
    if (Array.isArray(array)) {
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

function unsetFlag(flags: number, mask: number): number {
    return flags & ~mask;
}
function setFlag(flags: number, mask: number): number {
    return flags | mask;
}

function _calculateEffectiveUserAccessLevelFromPermission(
    node: UAVariable,
    context: SessionContext,
    userAccessLevel: AccessLevelFlag | undefined
): AccessLevelFlag {
    function __adjustFlag(permissionType: PermissionType, access: AccessLevelFlag, userAccessLevel1: AccessLevelFlag): AccessLevelFlag {

        if ((node.accessLevel & access) === 0 || (userAccessLevel1 & access) === 0) {
            userAccessLevel1 = unsetFlag(userAccessLevel1, access);
        } else {
            if (!context.checkPermission(node, permissionType)) {
                userAccessLevel1 = unsetFlag(userAccessLevel1, access);
            }
        }
        return userAccessLevel1;
    }
    userAccessLevel = node.userAccessLevel === undefined ? node.accessLevel : (node.userAccessLevel & node.accessLevel);
    if (context.checkPermission) {

        assert(context.checkPermission instanceof Function);
        userAccessLevel = __adjustFlag(PermissionType.Read, AccessLevelFlag.CurrentRead, userAccessLevel);
        userAccessLevel = __adjustFlag(PermissionType.Write, AccessLevelFlag.CurrentWrite, userAccessLevel);
        userAccessLevel = __adjustFlag(PermissionType.Write, AccessLevelFlag.StatusWrite, userAccessLevel);
        userAccessLevel = __adjustFlag(PermissionType.Write, AccessLevelFlag.TimestampWrite, userAccessLevel);
        userAccessLevel = __adjustFlag(PermissionType.ReadHistory, AccessLevelFlag.HistoryRead, userAccessLevel);
        userAccessLevel = __adjustFlag(PermissionType.DeleteHistory, AccessLevelFlag.HistoryWrite, userAccessLevel);
        return userAccessLevel;
    } else {
        return userAccessLevel;
    }
}

function adjustVariant2(this: UAVariable, variant: Variant): Variant {
    // convert Variant( Scalar|ByteString) =>  Variant(Array|ByteArray)
    const addressSpace = this.addressSpace;
    const basicType = addressSpace.findCorrespondingBasicDataType(this.dataType);
    variant = adjustVariant(variant, this.valueRank, basicType);
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

function turn_sync_to_async<T, D, R>(f: (this: T, data: D) => R, numberOfArgs: number) {
    if (f.length <= numberOfArgs) {
        return function (this: T, data: D, callback: (err: Error | null, r?: R) => void) {
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

    assert(typeof options.refreshFunc === "function");
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
function _Variable_bind_with_timestamped_get(this: UAVariable, options: any) {
    /* jshint validthis: true */
    assert(this instanceof UAVariable);
    assert(typeof options.timestamped_get === "function");
    assert(!options.get, "should not specify 'get' when 'timestamped_get' exists ");
    assert(!this._timestamped_get_func);

    const async_refresh_func = (callback: (err: Error | null, dataValue?: DataValue) => void) => {
        Promise.resolve((this._timestamped_get_func! as TimestampGetFunction1).call(this))
            .then((dataValue) => callback(null, dataValue))
            .catch((err) => callback(err));
    };

    if (options.timestamped_get.length === 0) {
        const timestamped_get = options.timestamped_get as TimestampGetFunction1;
        // sync version | Promise version
        this._timestamped_get_func = timestamped_get;

        const dataValue_verify = timestamped_get!.call(this);
        // dataValue_verify should be a DataValue or a Promise
        /* istanbul ignore next */
        if (!(dataValue_verify instanceof DataValue) && typeof dataValue_verify.then !== "function") {
            errorLog(
                chalk.red(" Bind variable error: "),
                " the timestamped_get function must return a DataValue or a Promise<DataValue>" +
                "\n value_check.constructor.name ",
                dataValue_verify ? dataValue_verify.constructor.name : "null"
            );

            throw new Error(" Bind variable error: " + " the timestamped_get function must return a DataValue");
        }
        _Variable_bind_with_async_refresh.call(this, { refreshFunc: async_refresh_func });
    } else if (options.timestamped_get.length === 1) {
        _Variable_bind_with_async_refresh.call(this, { refreshFunc: options.timestamped_get });
    } else {
        errorLog("timestamped_get has a invalid number of argument , should be 0 or 1  ");
        throw new Error("timestamped_get has a invalid number of argument , should be 0 or 1  ");
    }
}

// variation 1
function _Variable_bind_with_simple_get(this: UAVariable, options: any) {
    /* jshint validthis: true */
    assert(this instanceof UAVariable);
    assert(typeof options.get === "function", "should specify get function");
    assert(options.get.length === 0, "get function should not have arguments");
    assert(!options.timestamped_get, "should not specify a timestamped_get function when get is specified");
    assert(!this._timestamped_get_func);
    assert(!this._get_func);

    this._get_func = options.get;

    const timestamped_get_func_from__Variable_bind_with_simple_get = () => {
        const value = this._get_func();

        /* istanbul ignore next */
        if (!is_Variant_or_StatusCode(value)) {
            errorLog(
                chalk.red(" Bind variable error: "),
                " : the getter must return a Variant or a StatusCode" + "\nvalue_check.constructor.name ",
                value ? value.constructor.name : "null"
            );
            throw new Error(
                " bindVariable : the value getter function returns a invalid result ( expecting a Variant or a StatusCode !!!"
            );
        }
        if (is_StatusCode(value)) {
            return new DataValue({ statusCode: value });
        } else {
            if (!this._dataValue || !isGoodish(this._dataValue.statusCode) || !sameVariant(this._dataValue.value, value)) {
                this.setValueFromSource(value, StatusCodes.Good);
            } else {
                // XX console.log("YYYYYYYYYYYYYYYYYYYYYYYYYY",this.browseName.toString());
            }
            return this._dataValue;
        }
    };

    _Variable_bind_with_timestamped_get.call(this, {
        timestamped_get: timestamped_get_func_from__Variable_bind_with_simple_get
    });
}

function _Variable_bind_with_simple_set(this: UAVariable, options: any) {
    assert(this instanceof UAVariable);
    assert(typeof options.set === "function", "should specify set function");
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
                console.log(
                    chalk.red("UAVariable Binding Error _set_func must return a StatusCode, check the bindVariable parameters")
                );
                console.log(chalk.yellow("StatusCode.Good is assumed"));
                return callback(err, StatusCodes.Good, timestamped_value);
            }
            callback(err, statusCode, timestamped_value);
        });
    };
}

function _Variable_bind_with_timestamped_set(this: UAVariable, options: any) {
    assert(this instanceof UAVariable);
    assert(typeof options.timestamped_set === "function");
    assert(
        options.timestamped_set.length === 2,
        "timestamped_set must have 2 parameters  timestamped_set: function(dataValue,callback){}"
    );
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

interface SetterOptions {
    set?: any;
    timestamped_set?: any;
    timestamped_get?: any;
}
function bind_setter(this: UAVariable, options: SetterOptions) {
    if (typeof options.set === "function") {
        // variation 1
        _Variable_bind_with_simple_set.call(this, options);
    } else if (typeof options.timestamped_set === "function") {
        // variation 2
        assert(typeof options.timestamped_get === "function", "timestamped_set must be used with timestamped_get ");
        _Variable_bind_with_timestamped_set.call(this, options);
    } else if (typeof options.timestamped_get === "function") {
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

interface GetterOptions {
    get?: any;
    timestamped_get?: any;
    refreshFunc?: any;
    dataType?: DataType;
    value?: any;
}
function bind_getter(this: UAVariable, options: GetterOptions) {
    if (typeof options.get === "function") {
        // variation 1
        _Variable_bind_with_simple_get.call(this, options);
    } else if (typeof options.timestamped_get === "function") {
        // variation 2
        _Variable_bind_with_timestamped_get.call(this, options);
    } else if (typeof options.refreshFunc === "function") {
        // variation 3
        _Variable_bind_with_async_refresh.call(this, options);
    } else {
        assert(!options.hasOwnProperty("set"), "getter is missing : a getter must be provided if a setter is provided");
        // xx bind_variant.call(this,options);
        if (options.dataType !== undefined) {
            // if (options.dataType !== DataType.ExtensionObject) {
            this.setValueFromSource(options as VariantLike);
            // }
        }
    }
}

function w(str: string, n: number): string {
    return (str + "                                                              ").substr(0, n);
}

function _getter(target: any, key: string /*, receiver*/) {
    if (target[key] === undefined) {
        return undefined;
    }
    return target[key];
}

function _setter(variable: UAVariable, target: any, key: string, value: any /*, receiver*/) {
    target[key] = value;
    const child = (variable as any)[key] as UAVariable | null;
    if (child && child.touchValue) {
        child.touchValue();
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

function setExtensionObjectValue(node: UAVariable, partialObject: any) {
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
