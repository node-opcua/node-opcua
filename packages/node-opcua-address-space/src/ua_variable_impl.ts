/* eslint-disable max-statements */
/* eslint-disable complexity */
/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-bitwise
// tslint:disable:no-console
// tslint:disable:max-line-length
import * as chalk from "chalk";

import {
    BindExtensionObjectOptions,
    CloneExtraInfo,
    ContinuationData,
    defaultCloneExtraInfo,
    defaultCloneFilter,
    GetFunc,
    SetFunc,
    VariableDataValueGetterCallback,
    VariableDataValueGetterPromise,
    VariableDataValueGetterSync,
    VariableDataValueSetterWithCallback,
    VariableDataValueSetterWithPromise
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import {
    isValidDataEncoding,
    convertAccessLevelFlagToByte,
    QualifiedNameLike,
    NodeClass,
    AccessLevelFlag,
    makeAccessLevelFlag,
    AttributeIds,
    isDataEncoding
} from "node-opcua-data-model";
import { extractRange, sameDataValue, DataValue, DataValueLike, DataValueT } from "node-opcua-data-value";
import { coerceClock, getCurrentClock, PreciseClock } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { WriteValue } from "node-opcua-service-write";
import { StatusCode, StatusCodes, CallbackT } from "node-opcua-status-code";
import {
    HistoryReadDetails,
    HistoryReadResult,
    PermissionType,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails,
    StructureDefinition,
    StructureField,
    WriteValueOptions
} from "node-opcua-types";
import * as utils from "node-opcua-utils";
import { lowerFirstLetter } from "node-opcua-utils";
import {
    Variant,
    VariantLike,
    DataType,
    sameVariant,
    VariantArrayType,
    adjustVariant,
    verifyRankAndDimensions
} from "node-opcua-variant";
import { StatusCodeCallback } from "node-opcua-status-code";
import {
    IAddressSpace,
    BindVariableOptions,
    ContinuationPoint,
    IVariableHistorian,
    TimestampGetFunc,
    TimestampSetFunc,
    UADataType,
    UAVariable,
    UAVariableType,
    CloneOptions,
    CloneFilter,
    ISessionContext,
    BaseNode,
    UAVariableT
} from "node-opcua-address-space-base";
import { EnumFilterOperator, UAHistoricalDataConfiguration } from "node-opcua-nodeset-ua";

import { SessionContext } from "../source/session_context";
import { convertToCallbackFunction1 } from "../source/helpers/multiform_func";
import { BaseNodeImpl, InternalBaseNodeOptions } from "./base_node_impl";
import { _clone, ToStringBuilder, UAVariable_toString, valueRankToString } from "./base_node_private";
import { EnumerationInfo, IEnumItem, UADataTypeImpl } from "./ua_data_type_impl";
import { apply_condition_refresh, ConditionRefreshCache } from "./apply_condition_refresh";
import {
    extractPartialData,
    propagateTouchValueUpward,
    setExtensionObjectValue,
    _bindExtensionObject,
    _installExtensionObjectBindingOnProperties,
    _setExtensionObject,
    _touchValue
} from "./ua_variable_impl_ext_obj";

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
    userAccessLevel: string | number | null | undefined,
    accessLevel: string | number | null
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

function _dataType_toUADataType(addressSpace: IAddressSpace, dataType: DataType): UADataType {
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
    addressSpace: IAddressSpace,
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
    let builtInType: DataType;
    let builtInUADataType: UADataType;

    const destUADataType = addressSpace.findDataType(dataTypeNodeId)!;
    assert(destUADataType instanceof UADataTypeImpl);

    if (destUADataType.isAbstract || destUADataType.nodeId.namespace !== 0) {
        builtInUADataType = destUADataType;
    } else {
        builtInType = addressSpace.findCorrespondingBasicDataType(destUADataType);
        builtInUADataType = addressSpace.findDataType(builtInType)!;
    }
    assert(builtInUADataType instanceof UADataTypeImpl);

    const enumerationUADataType = addressSpace.findDataType("Enumeration");
    if (!enumerationUADataType) {
        throw new Error("cannot find Enumeration DataType node in standard address space");
    }
    if (destUADataType.isSupertypeOf(enumerationUADataType)) {
        // istanbul ignore next
        if (doDebug) {
            debugLog("destUADataType.", destUADataType.browseName.toString(), destUADataType.nodeId.toString());
            debugLog(
                "enumerationUADataType.",
                enumerationUADataType.browseName.toString(),
                enumerationUADataType.nodeId.toString()
            );
        }
        return true;
    }

    // The value supplied for the attribute is not of the same type as the  value.
    const variantUADataType = _dataType_toUADataType(addressSpace, variantDataType);
    assert(variantUADataType instanceof UADataTypeImpl);

    const dest_isSuperTypeOf_variant = variantUADataType.isSupertypeOf(builtInUADataType);

    /* istanbul ignore next */
    if (doDebug) {
        if (dest_isSuperTypeOf_variant) {
            /* istanbul ignore next*/
            debugLog(chalk.green(" ---------- Type match !!! "), " on ", nodeId.toString());
        } else {
            /* istanbul ignore next*/
            debugLog(chalk.red(" ---------- Type mismatch "), " on ", nodeId.toString());
        }
        debugLog(chalk.cyan(" Variable data Type is    = "), destUADataType.browseName.toString());
        debugLog(chalk.cyan(" which matches basic Type = "), builtInUADataType.browseName.toString());
        debugLog(chalk.yellow("        Actual   dataType = "), variantUADataType.browseName.toString());
    }

    return dest_isSuperTypeOf_variant;
}

function default_func(this: UAVariable, dataValue1: DataValue, callback1: CallbackT<StatusCode>) {
    return _default_writable_timestamped_set_func.call(this, dataValue1, callback1);
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
export class UAVariableImpl extends BaseNodeImpl implements UAVariable {
    public readonly nodeClass = NodeClass.Variable;

    public dataType: NodeId;
    private _basicDataType?: DataType;

    public $extensionObject?: any;

    public $historicalDataConfiguration?: UAHistoricalDataConfiguration;
    public varHistorian?: IVariableHistorian;

    /**
     * @internal @private
     */
    public $dataValue: DataValue;
    public accessLevel: number;
    public userAccessLevel?: number;
    public valueRank: number;
    public minimumSamplingInterval: number;
    public historizing: boolean;
    public semantic_version: number;
    public arrayDimensions: null | number[];

    public _timestamped_get_func?: TimestampGetFunc | null;
    public _timestamped_set_func?: VariableDataValueSetterWithCallback | null;
    public _get_func: any;
    public _set_func: any;
    public refreshFunc?: (callback: CallbackT<DataValue>) => void;
    public __waiting_callbacks?: any[];

    get typeDefinitionObj(): UAVariableType {
        return super.typeDefinitionObj as UAVariableType;
    }
    get typeDefinition(): NodeId {
        return super.typeDefinition;
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

        this.historizing = !!options.historizing; // coerced to boolean"

        this.$dataValue = new DataValue({ statusCode: StatusCodes.UncertainInitialValue, value: { dataType: DataType.Null } });

        if (options.value) {
            this.bindVariable(options.value);
        }

        this.setMaxListeners(5000);

        this.semantic_version = 0;
    }

    private checkPermissionAndAccessLevelPrivate(
        context: ISessionContext,
        permission: PermissionType,
        accessLevel: AccessLevelFlag
    ) {
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

    public isReadable(context: ISessionContext): boolean {
        return (this.accessLevel & AccessLevelFlag.CurrentRead) === AccessLevelFlag.CurrentRead;
    }

    public isUserReadable(context: ISessionContext): boolean {
        if (!this.isReadable(context)) {
            return false;
        }
        return this.checkPermissionAndAccessLevelPrivate(context, PermissionType.Read, AccessLevelFlag.CurrentRead);
    }

    public isWritable(context: ISessionContext): boolean {
        return (this.accessLevel & AccessLevelFlag.CurrentWrite) === AccessLevelFlag.CurrentWrite;
    }

    public isUserWritable(context: ISessionContext): boolean {
        if (!this.isWritable(context)) {
            return false;
        }
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
    public readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue {
        if (!context) {
            context = SessionContext.defaultContext;
        }

        if (context.isAccessRestricted(this)) {
            return new DataValue({ statusCode: StatusCodes.BadSecurityModeInsufficient });
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
                const dataValueOrPromise = (this._timestamped_get_func as VariableDataValueGetterSync)();
                if (!Object.prototype.hasOwnProperty.call(dataValueOrPromise, "then")) {
                    this.$dataValue = dataValueOrPromise as DataValue;
                    this.verifyVariantCompatibility(this.$dataValue.value);
                } else {
                    errorLog("Unsupported: _timestamped_get_func returns a Promise !");
                }
            }
        }

        let dataValue = this.$dataValue;

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
        return this.addressSpacePrivate.isEnumeration(this.dataType);
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
        const dataTypeNode = this.addressSpace.findDataType(this.dataType)! as UADataTypeImpl;
        return dataTypeNode._getEnumerationInfo();
    }

    public asyncRefresh(oldestDate: Date, callback: CallbackT<DataValue>): void;
    public asyncRefresh(oldestDate: Date): Promise<DataValue>;
    public asyncRefresh(...args: any[]): any {
        if (isGoodish(this.$dataValue.statusCode)) {
            this.verifyVariantCompatibility(this.$dataValue.value);
        }

        const oldestDate = args[0] as Date;
        assert(oldestDate instanceof Date);
        const callback = args[1] as CallbackT<DataValue>;

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

        if (this.$dataValue.serverTimestamp && oldestDate.getTime() <= this.$dataValue.serverTimestamp!.getTime()) {
            const dataValue = this.readValue();
            dataValue.serverTimestamp = oldestDate;
            dataValue.serverPicoseconds = 0;
            return callback(null, dataValue);
        }

        try {
            this.refreshFunc.call(this, (err: Error | null, dataValue?: DataValueLike) => {
                if (err || !dataValue) {
                    errorLog(
                        "-------------- refresh call failed",
                        this.browseName.toString(),
                        this.nodeId.toString(),
                        err?.message
                    );
                    dataValue = { statusCode: StatusCodes.BadNoDataAvailable };
                }
                if (dataValue !== this.$dataValue) {
                    this._internal_set_dataValue(coerceDataValue(dataValue), null);
                }
                callback(err, this.$dataValue);
            });
        } catch (err) {
            errorLog("-------------- refresh call failed 2", this.browseName.toString(), this.nodeId.toString());
            errorLog(err);
            const dataValue = new DataValue({ statusCode: StatusCodes.BadInternalError });
            this._internal_set_dataValue(dataValue, null);
            callback(err as Error, this.$dataValue);
        }
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
            if (!Object.prototype.hasOwnProperty.call(enumInfo.nameIndex, value)) {
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
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
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
                return BaseNodeImpl.prototype.readAttribute.call(this, context, attributeId);
        }
    }

    public getBasicDataType(): DataType {
        if (this._basicDataType) {
            return this._basicDataType;
        }
        if (this.dataType.namespace === 0 && this.dataType.value === 0) {
            return DataType.Null;
        }
        const addressSpace = this.addressSpace;
        if (!addressSpace) {
            // may be node has been deleted already
            return DataType.Null;
        }
        const dataTypeNode = addressSpace.findDataType(this.dataType)!;
        const basicDataType =
            dataTypeNode && dataTypeNode.nodeClass === NodeClass.DataType ? dataTypeNode.getBasicDataType() : DataType.Null;
        // const basicDataType = addressSpace.findCorrespondingBasicDataType(this.dataType);
        this._basicDataType = basicDataType;
        return basicDataType;
    }
    public adjustVariant(variant: Variant): Variant {
        return adjustVariant(variant, this.valueRank, this.getBasicDataType());
    }
    public verifyVariantCompatibility(variant: Variant): void {
        try {
            // istanbul ignore next
            if (Object.prototype.hasOwnProperty.call(variant, "value")) {
                if (variant.dataType === null || variant.dataType === undefined) {
                    throw new Error(
                        "Variant must provide a valid dataType : variant = " +
                            variant.toString() +
                            " this.dataType= " +
                            this.dataType.toString()
                    );
                }
                if (
                    variant.dataType === DataType.Boolean &&
                    (this.dataType.namespace !== 0 || this.dataType.value !== DataType.Boolean)
                ) {
                    throw new Error(
                        "Variant must provide a valid Boolean : variant = " +
                            variant.toString() +
                            " this.dataType= " +
                            this.dataType.toString()
                    );
                }
                if (
                    this.dataType.namespace === 0 &&
                    this.dataType.value === DataType.LocalizedText &&
                    variant.dataType !== DataType.LocalizedText &&
                    variant.dataType !== DataType.Null
                ) {
                    throw new Error(
                        "Variant must provide a valid LocalizedText : variant = " +
                            variant.toString() +
                            " this.dataType= " +
                            this.dataType.toString()
                    );
                }
            }
            const basicType = this.getBasicDataType();

            if (basicType === DataType.String && variant.dataType === DataType.ByteString) {
                return; // this is allowed
            }
            if (basicType === DataType.ByteString && variant.dataType === DataType.String) {
                return; // this is allowed
            }

            if (
                basicType !== DataType.Null &&
                basicType !== DataType.Variant &&
                variant.dataType !== DataType.Null &&
                variant.dataType !== basicType
            ) {
                const message =
                    "UAVariable.setValueFromSource " +
                    this.browseName.toString() +
                    " nodeId:" +
                    this.nodeId.toString() +
                    " dataType:" +
                    this.dataType.toString() +
                    ":\n" +
                    "the provided variant must have the expected dataType!\n" +
                    "   - the expected dataType is " +
                    chalk.cyan(DataType[basicType]) +
                    "\n" +
                    "   - the actual dataType   is " +
                    chalk.magenta(DataType[variant.dataType]) +
                    "\n" +
                    "   - " +
                    variant.toString();
                throw new Error(message);
            }
        } catch (err) {
            errorLog("UAVariable  ", (err as Error)?.message, this.browseName.toString(), " nodeId=", this.nodeId.toString());
            errorLog((err as Error).message);
            errorLog((err as Error).stack);
            throw err;
        }
    }
    /**
     * setValueFromSource is used to let the device sets the variable values
     * this method also records the current time as sourceTimestamp and serverTimestamp.
.     *
     * The method will raise an exception if the value is not compatible with the dataType and expected dimension
     *
     * @method setValueFromSource
     * @param variant  {Variant}
     * @param [statusCode  {StatusCode} = StatusCodes.Good]
     * @param [sourceTimestamp= Now]
     */
    public setValueFromSource(variant: VariantLike, statusCode?: StatusCode, sourceTimestamp?: Date): void {
        try {
            statusCode = statusCode || StatusCodes.Good;
            const variant1 = Variant.coerce(variant);
            this.verifyVariantCompatibility(variant1);
            const now = coerceClock(sourceTimestamp, 0);

            const dataValue = new DataValue(null);
            dataValue.serverPicoseconds = now.picoseconds;
            dataValue.serverTimestamp = now.timestamp;
            dataValue.sourcePicoseconds = now.picoseconds;
            dataValue.sourceTimestamp = now.timestamp;
            dataValue.statusCode = statusCode;
            dataValue.value = variant1;

            if (dataValue.value.dataType === DataType.ExtensionObject) {
                const valueIsCorrect = this.checkExtensionObjectIsCorrect(dataValue.value.value);
                if (!valueIsCorrect) {
                    errorLog("Invalid value !");
                    errorLog(this.toString());
                    errorLog(dataValue.toString());
                    this.checkExtensionObjectIsCorrect(dataValue.value.value);
                }
                this.$dataValue = dataValue;
                // ----------------------------------
                if (this.$extensionObject) {
                    // we have an extension object already bound to this node
                    // the client is asking us to replace the object entierly by a new one
                    const ext = dataValue.value.value;
                    _setExtensionObject(this, ext);
                    return;
                }
            } else {
                this._internal_set_dataValue(dataValue);
            }
        } catch (err) {
            errorLog("UAVariable#setValueFromString Error : ", this.browseName.toString(), this.nodeId.toString());
            errorLog((err as Error).message);
            errorLog(this.parent?.toString());
            throw err;
        }
    }

    public writeValue(
        context: ISessionContext,
        dataValue: DataValue,
        indexRange: string | NumericRange | null,
        callback: StatusCodeCallback
    ): void;
    public writeValue(context: ISessionContext, dataValue: DataValue, callback: StatusCodeCallback): void;
    public writeValue(
        context: ISessionContext,
        dataValue: DataValue,
        indexRange?: string | NumericRange | null
    ): Promise<StatusCode>;
    public writeValue(context: ISessionContext, dataValue: DataValue, ...args: any[]): any {
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

        const write_func = this._timestamped_set_func || default_func;

        if (!write_func) {
            warningLog(" warning " + this.nodeId.toString() + " " + this.browseName.toString() + " has no setter. \n");
            warningLog("Please make sure to bind the variable or to pass a valid value: new Variant({}) during construction time");
            return callback!(null, StatusCodes.BadNotWritable);
        }
        assert(write_func);

        write_func.call(this, dataValue, (err?: Error | null, statusCode1?: StatusCode) => {
            if (!err) {
                dataValue && this.verifyVariantCompatibility(dataValue.value);

                if (indexRange && !indexRange.isEmpty()) {
                    if (!indexRange.isValid()) {
                        return callback!(null, StatusCodes.BadIndexRangeInvalid);
                    }

                    const newArrayOrMatrix = dataValue.value.value;

                    if (dataValue.value.arrayType === VariantArrayType.Array) {
                        if (this.$dataValue.value.arrayType !== VariantArrayType.Array) {
                            return callback(null, StatusCodes.BadTypeMismatch);
                        }
                        // check that destination data is also an array
                        assert(check_valid_array(this.$dataValue.value.dataType, this.$dataValue.value.value));
                        const destArr = this.$dataValue.value.value;
                        const result = indexRange.set_values(destArr, newArrayOrMatrix);

                        if (result.statusCode.isNot(StatusCodes.Good)) {
                            return callback!(null, result.statusCode);
                        }
                        dataValue.value.value = result.array;

                        // scrap original array so we detect range
                        this.$dataValue.value.value = null;
                    } else if (dataValue.value.arrayType === VariantArrayType.Matrix) {
                        const dimensions = this.$dataValue.value.dimensions;
                        if (this.$dataValue.value.arrayType !== VariantArrayType.Matrix || !dimensions) {
                            // not a matrix !
                            return callback!(null, StatusCodes.BadTypeMismatch);
                        }
                        const matrix = this.$dataValue.value.value;
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
                        dataValue.value.dimensions = this.$dataValue.value.dimensions;
                        dataValue.value.value = result.matrix;

                        // scrap original array so we detect range
                        this.$dataValue.value.value = null;
                    } else {
                        return callback!(null, StatusCodes.BadTypeMismatch);
                    }
                }
                try {
                    this._internal_set_dataValue(dataValue, indexRange);
                } catch (err) {
                    if (err instanceof Error) {
                        warningLog(err.message);
                    }
                    return callback!(null, StatusCodes.BadInternalError);
                }
            }
            callback!(err || null, statusCode1);
        });
    }

    public writeAttribute(context: ISessionContext | null, writeValue: WriteValueOptions, callback: StatusCodeCallback): void;
    public writeAttribute(context: ISessionContext | null, writeValue: WriteValueOptions): Promise<StatusCode>;
    public writeAttribute(
        context: ISessionContext | null,
        writeValueOptions: WriteValueOptions,
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
        try {
            this.verifyVariantCompatibility(value);
        } catch (err) {
            return StatusCodes.BadTypeMismatch;
        }
        return StatusCodes.Good;
    }

    /**
     * touch the source timestamp of a Variable and cascade up the change
     * to the parent variable if any.
     */
    public touchValue(optionalNow?: PreciseClock): void {
        const now = optionalNow || getCurrentClock();
        propagateTouchValueUpward(this, now);
    }

    /**
     * bind a variable with a get and set functions.
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
    public bindVariable(options?: BindVariableOptions, overwrite?: boolean): void {
        if (overwrite) {
            this._timestamped_set_func = null;
            this._timestamped_get_func = null;
            this._get_func = null;
            this._set_func = null;
            this.refreshFunc = undefined;
            this._historyRead = UAVariableImpl.prototype._historyRead;
        }

        options = options || {};

        assert(typeof this._timestamped_set_func !== "function", "UAVariable already bound");
        assert(typeof this._timestamped_get_func !== "function", "UAVariable already bound");

        bind_getter.call(this, options);
        bind_setter.call(this, options);

        const _historyRead = options.historyRead;
        if (_historyRead) {
            assert(typeof this._historyRead !== "function" || this._historyRead === UAVariableImpl.prototype._historyRead);
            assert(typeof _historyRead === "function");

            this._historyRead = _historyRead;
            assert(this._historyRead.length === 6);
        }
        // post conditions
        assert(typeof this._timestamped_set_func === "function");
        assert(this._timestamped_set_func!.length === 2, "expecting 2 parameters");
    }

    /**
     * @method readValueAsync
     */
    public readValueAsync(context: ISessionContext | null, callback: CallbackT<DataValue>): void;
    public readValueAsync(context: ISessionContext | null): Promise<DataValue>;
    public readValueAsync(context: ISessionContext | null, callback?: CallbackT<DataValue>): any {
        if (!context) {
            context = SessionContext.defaultContext;
        }
        assert(typeof callback === "function");

        this.__waiting_callbacks = this.__waiting_callbacks || [];
        this.__waiting_callbacks.push(callback);

        const _readValueAsync_in_progress = this.__waiting_callbacks.length >= 2;
        if (_readValueAsync_in_progress) {
            return;
        }

        const readImmediate = (innerCallback: (err: Error | null, dataValue: DataValue) => void) => {
            assert(this.$dataValue instanceof DataValue);
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
                if (err instanceof Error) {
                    debugLog(" stack", err.stack);
                }
            }
            satisfy_callbacks(err as Error);
        }
    }

    public getWriteMask(): number {
        return super.getWriteMask();
    }

    public getUserWriteMask(): number {
        return super.getUserWriteMask();
    }

    public clone(options: CloneOptions, optionalFilter?: CloneFilter, extraInfo?: CloneExtraInfo): UAVariable {
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

        const newVariable = _clone.call(
            this,
            UAVariableImpl,
            options,
            optionalFilter || defaultCloneFilter,
            extraInfo || defaultCloneExtraInfo
        ) as UAVariableImpl;

        newVariable.bindVariable();

        assert(typeof newVariable._timestamped_set_func === "function");

        assert(newVariable.dataType === this.dataType);
        newVariable.$dataValue = this.$dataValue.clone();

        // also bind extension object
        const v = newVariable.$dataValue.value;
        if (v.dataType === DataType.ExtensionObject && v.value && v.arrayType === VariantArrayType.Scalar) {
            try {
                newVariable.bindExtensionObject(newVariable.$dataValue.value.value);
            } catch (err) {
                errorLog("Errro binding extension objects");
                errorLog((err as Error).message);
                errorLog(this.toString());
                errorLog("---------------------------------------");
                errorLog(this.$dataValue.toString());
                errorLog("---------------------------------------");
                errorLog(newVariable.$dataValue.toString());
                throw err;
            }
        }
        return newVariable;
    }

    public getDataTypeNode(): UADataType {
        const addressSpace = this.addressSpace;
        const dt = addressSpace.findNode(this.dataType);
        // istanbul ignore next
        if (!dt) {
            throw new Error("getDataTypeNode: cannot find dataType " + this.dataType.toString());
        }
        return dt as UADataType;
    }

    public get dataTypeObj(): UADataType {
        return this.getDataTypeNode();
    }

    public checkExtensionObjectIsCorrect(extObj: ExtensionObject | ExtensionObject[] | null): boolean {
        if (!extObj) {
            return true;
        }
        const addressSpace = this.addressSpace;
        const dataType = addressSpace.findDataType(this.dataType);
        if (!dataType) {
            // may be we are in the process of loading a xml file and the corresponding dataType
            // has not yet been loaded !
            return true;
        }

        const Constructor = addressSpace.getExtensionObjectConstructor(this.dataType);

        if (this.valueRank === -1) {
            /** Scalar */
            if (extObj instanceof Array) {
                return false;
            }
            return checkExtensionObjectIsCorrectScalar.call(this, extObj);
        } else if (this.valueRank === 1) {
            /** array */
            if (!(extObj instanceof Array)) {
                // let's coerce this scalar into an 1-element array if it is a valid extension object
                if (checkExtensionObjectIsCorrectScalar.call(this, extObj)) {
                    warningLog(
                        `checkExtensionObjectIsCorrect : expecting a array but got a scalar (value rank of ${this.browseName.toString()} is 1)`
                    );
                    extObj = [extObj];
                } else {
                    return false;
                }
            }
            return checkExtensionObjectIsCorrectArray.call(this, extObj);
        } else if (this.valueRank === 0) {
            // Scalar or Array
            const isCorrectScalar = !Array.isArray(extObj) && checkExtensionObjectIsCorrectScalar.call(this, extObj);
            const isCorrectArray =
                Array.isArray(extObj) && checkExtensionObjectIsCorrectArray.call(this, extObj as ExtensionObject[]);
            return isCorrectArray || isCorrectScalar;
        } else {
            throw new Error(
                `checkExtensionObjectIsCorrect: Not Implemented case, please contact sterfive : this.valueRank =${this.valueRank}`
            );
        }
        function checkExtensionObjectIsCorrectScalar(
            this: UAVariableImpl,
            extObj: ExtensionObject | ExtensionObject[] | null
        ): boolean {
            // istanbul ignore next
            if (!(extObj && extObj.constructor)) {
                errorLog(extObj);
                throw new Error("expecting an valid extension object");
            }
            return extObj.constructor.name === Constructor.name;
        }

        function checkExtensionObjectIsCorrectArray(this: UAVariableImpl, extObjArray: ExtensionObject[]): boolean {
            // istanbul ignore next
            for (const extObj of extObjArray) {
                if (!(extObj && extObj.constructor)) {
                    errorLog(extObj);
                    throw new Error("expecting an valid extension object");
                }
            }
            try {
                for (const e of extObjArray) {
                    if (!e) {
                        continue;
                    }
                    if (e.constructor.name !== Constructor.name) {
                        debugLog("extObj.constructor.name ", e.constructor.name, "expected", Constructor.name);
                        return false;
                    }
                }
                return true;
            } catch (err) {
                errorLog(err);
                return false;
            }
        }
    }

    /**
     * @private
     * install UAVariable to exposed th
     *
     * precondition:
     */
    public installExtensionObjectVariables(): void {
        _installExtensionObjectBindingOnProperties(this, { createMissingProp: true });
        // now recursively install extension object on children
        for (const child of this.getComponents()) {
            if (child.nodeClass === NodeClass.Variable && child instanceof UAVariableImpl) {
                if (child.isExtensionObject()) {
                    child.installExtensionObjectVariables();
                }
            }
        }
    }
    /**
     * @method bindExtensionObject
     * @return {ExtensionObject}
     */
    public bindExtensionObjectScalar(
        optionalExtensionObject: ExtensionObject,
        options?: BindExtensionObjectOptions
    ): ExtensionObject | null {
        return this.bindExtensionObject(optionalExtensionObject, options) as ExtensionObject | null;
    }

    public bindExtensionObjectArray(
        optionalExtensionObject: ExtensionObject[],
        options?: BindExtensionObjectOptions
    ): ExtensionObject[] | null {
        return this.bindExtensionObject(optionalExtensionObject, options) as ExtensionObject[] | null;
    }

    public bindExtensionObject(
        optionalExtensionObject?: ExtensionObject | ExtensionObject[],
        options?: BindExtensionObjectOptions
    ): ExtensionObject | ExtensionObject[] | null {
        return _bindExtensionObject(this, optionalExtensionObject, options);
    }

    public updateExtensionObjectPartial(partialExtensionObject?: { [key: string]: any }): ExtensionObject {
        setExtensionObjectValue(this, partialExtensionObject);
        return this.$extensionObject;
    }

    public incrementExtensionObjectPartial(path: string | string[]): void {
        const extensionObject = this.readValue().value.value as ExtensionObject;
        const partialData = extractPartialData(path, extensionObject);
        setExtensionObjectValue(this, partialData);
    }

    public toString(): string {
        const options = new ToStringBuilder();
        UAVariable_toString.call(this, options);
        return options.toString();
    }

    // ---------------------------------------------------------------------------------------------------
    // History
    // ---------------------------------------------------------------------------------------------------

    public historyRead(
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

    public historyRead(
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
    public historyRead(
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
        callback?: CallbackT<HistoryReadResult>
    ): any {
        assert(context instanceof SessionContext);
        assert(typeof callback === "function");
        if (typeof this._historyRead !== "function") {
            return callback!(null, new HistoryReadResult({ statusCode: StatusCodes.BadNotReadable }));
        }
        this._historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationData, callback!);
    }

    public _historyReadRaw(
        context: ISessionContext,
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationData: ContinuationData,
        callback: CallbackT<HistoryReadResult>
    ): void {
        throw new Error("");
    }

    public _historyReadRawModify(
        context: ISessionContext,
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationData: ContinuationData,
        callback?: CallbackT<HistoryReadResult>
    ): any {
        throw new Error("");
    }

    public _historyRead(
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
    ): void {
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
        context: ISessionContext,
        historyReadRawModifiedDetails: ReadRawModifiedDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationData: ContinuationData,
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

    public _internal_set_value(value: Variant): void {
        if (value.dataType !== DataType.Null) {
            this.verifyVariantCompatibility(value);
        }
        this.$dataValue.value = value;
    }

    public _internal_set_dataValue(dataValue: DataValue, indexRange?: NumericRange | null): void {
        assert(dataValue, "expecting a dataValue");
        assert(dataValue instanceof DataValue, "expecting dataValue to be a DataValue");
        assert(dataValue !== this.$dataValue, "expecting dataValue to be different from previous DataValue instance");

        const addressSpace = this.addressSpace;
        if (!addressSpace) {
            warningLog("UAVariable#_internal_set_dataValue : no addressSpace ! may be node has already been deleted ?");
            return;
        }
        if (dataValue.value.arrayType === VariantArrayType.Matrix) {
            if (!dataValue.value.dimensions) {
                throw new Error("missing dimensions: a Matrix Variant needs a dimension");
            }
            const nbElements = dataValue.value.dimensions.reduce((acc, x) => acc * x, 1);
            if (dataValue.value.value.length !== 0 && dataValue.value.value.length !== nbElements) {
                throw new Error(
                    `Internal Error: matrix dimension doesn't match the number of element in the array : ${dataValue.toString()} "\n expecting ${nbElements} elements but got ${
                        dataValue.value.value.length
                    }`
                );
            }
        }
        if (dataValue.value.dataType === DataType.ExtensionObject) {
            if (!this.checkExtensionObjectIsCorrect(dataValue.value.value)) {
                warningLog(dataValue.toString());
                throw new Error("Invalid Extension Object on nodeId =" + this.nodeId.toString());
            }
            // ----------------------------------
            // if (this.$extensionObject) {
            //     // we have an extension object already bound to this node
            //     // the client is asking us to replace the object entierly by a new one
            //     const ext = dataValue.value.value;
            //     _setExtensionObject(this, ext);
            //     return;
            // }
        }
        // // istanbul ignore next
        // if (this.dataType.namespace === 0) {
        //     if (this.dataType.value === DataType.LocalizedText && dataValue.value.dataType !== DataType.LocalizedText) {
        //         const message = "Invalid dataValue provided (expecting a LocalizedText) but got " + dataValue.toString();
        //         errorLog(message);
        //         // throw new Error(message);
        //     }
        // }

        this.verifyVariantCompatibility(dataValue.value);

        const old_dataValue = this.$dataValue;

        this.$dataValue = dataValue;
        this.$dataValue.statusCode = this.$dataValue.statusCode || StatusCodes.Good;

        // repair missing timestamps
        if (!dataValue.serverTimestamp) {
            this.$dataValue.serverTimestamp = old_dataValue.serverTimestamp;
            this.$dataValue.serverPicoseconds = old_dataValue.serverPicoseconds;
        }
        if (!dataValue.sourceTimestamp) {
            this.$dataValue.sourceTimestamp = old_dataValue.sourceTimestamp;
            this.$dataValue.sourcePicoseconds = old_dataValue.sourcePicoseconds;
        }

        if (!sameDataValue(old_dataValue, dataValue)) {
            this.emit("value_changed", this.$dataValue, indexRange);
        }
    }

    public _conditionRefresh(_cache?: ConditionRefreshCache): void {
        apply_condition_refresh.call(this, _cache);
    }

    public handle_semantic_changed(): void {
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

    private _readAccessLevel(context: ISessionContext): DataValue {
        assert(context instanceof SessionContext);
        const options = {
            statusCode: StatusCodes.Good,
            value: { dataType: DataType.Byte, value: convertAccessLevelFlagToByte(this.accessLevel) }
        };
        return new DataValue(options);
    }

    private _readAccessLevelEx(context: ISessionContext): DataValue {
        assert(context instanceof SessionContext);
        const options = {
            statusCode: StatusCodes.Good,
            // Extra flags are not supported yet. to do:
            value: { dataType: DataType.UInt32, value: convertAccessLevelFlagToByte(this.accessLevel) }
        };
        return new DataValue(options);
    }

    private _readUserAccessLevel(context: ISessionContext): DataValue {
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
UAVariableImpl.prototype.asyncRefresh = thenify.withCallback(UAVariableImpl.prototype.asyncRefresh);
UAVariableImpl.prototype.writeValue = thenify.withCallback(UAVariableImpl.prototype.writeValue);
UAVariableImpl.prototype.writeAttribute = thenify.withCallback(UAVariableImpl.prototype.writeAttribute);
UAVariableImpl.prototype.historyRead = thenify.withCallback(UAVariableImpl.prototype.historyRead);
UAVariableImpl.prototype.readValueAsync = thenify.withCallback(UAVariableImpl.prototype.readValueAsync);

export interface UAVariableImpl {
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
    context: ISessionContext,
    userAccessLevel: AccessLevelFlag | undefined
): AccessLevelFlag {
    function __adjustFlag(
        permissionType: PermissionType,
        access: AccessLevelFlag,
        userAccessLevel1: AccessLevelFlag
    ): AccessLevelFlag {
        if ((node.accessLevel & access) === 0 || (userAccessLevel1 & access) === 0) {
            userAccessLevel1 = unsetFlag(userAccessLevel1, access);
        } else {
            if (!context.checkPermission(node, permissionType)) {
                userAccessLevel1 = unsetFlag(userAccessLevel1, access);
            }
        }
        return userAccessLevel1;
    }
    userAccessLevel = node.userAccessLevel === undefined ? node.accessLevel : node.userAccessLevel & node.accessLevel;
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

function adjustVariant2(this: UAVariableImpl, variant: Variant): Variant {
    // convert Variant( Scalar|ByteString) =>  Variant(Array|ByteArray)
    const addressSpace = this.addressSpace;
    const basicType = this.getBasicDataType();
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
function _Variable_bind_with_async_refresh(this: UAVariableImpl, options: any) {
    /* jshint validthis: true */
    assert(this instanceof UAVariableImpl);

    assert(typeof options.refreshFunc === "function");
    assert(!options.get, "a getter shall not be specified when refreshFunc is set");
    assert(!options.timestamped_get, "a getter shall not be specified when refreshFunc is set");

    assert(!this.refreshFunc);

    this.refreshFunc = options.refreshFunc;

    // assert(this.readValue().statusCode === StatusCodes.BadNodeIdUnknown);
    this.$dataValue.statusCode = StatusCodes.UncertainInitialValue;

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
    this: UAVariableImpl,
    options: {
        get: undefined;
        timestamped_get: TimestampGetFunc;
    }
) {
    /* jshint validthis: true */
    assert(this instanceof UAVariableImpl);
    assert(typeof options.timestamped_get === "function");
    assert(!options.get, "should not specify 'get' when 'timestamped_get' exists ");
    assert(!this._timestamped_get_func);

    const async_refresh_func = (callback: (err: Error | null, dataValue?: DataValue) => void) => {
        Promise.resolve((this._timestamped_get_func! as VariableDataValueGetterSync).call(this))
            .then((dataValue) => callback(null, dataValue))
            .catch((err) => {
                errorLog("asyncRefresh error: Variable is  ", this.nodeId.toString(), this.browseName.toString());
                callback(err as Error);
            });
    };
    const pThis = this as UAVariable;
    if (options.timestamped_get.length === 0) {
        const timestamped_get = options.timestamped_get as (this: UAVariable) => DataValue | Promise<DataValue>;
        // sync version | Promise version
        this._timestamped_get_func = timestamped_get;

        const dataValue_verify = timestamped_get.call(pThis);
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
function _Variable_bind_with_simple_get(this: UAVariableImpl, options: GetterOptions) {
    /* jshint validthis: true */
    assert(this instanceof UAVariableImpl);
    assert(typeof options.get === "function", "should specify get function");
    assert(options.get!.length === 0, "get function should not have arguments");
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
            if (!this.$dataValue || !isGoodish(this.$dataValue.statusCode) || !sameVariant(this.$dataValue.value, value)) {
                this.setValueFromSource(value, StatusCodes.Good);
            }
            return this.$dataValue;
        }
    };

    _Variable_bind_with_timestamped_get.call(this, {
        get: undefined,
        timestamped_get: timestamped_get_func_from__Variable_bind_with_simple_get
    });
}

function _Variable_bind_with_simple_set(this: UAVariableImpl, options: any) {
    assert(this instanceof UAVariableImpl);
    assert(typeof options.set === "function", "should specify set function");
    assert(!options.timestamped_set, "should not specify a timestamped_set function");

    assert(!this._timestamped_set_func);
    assert(!this._set_func);

    this._set_func = turn_sync_to_async(options.set, 1);
    assert(this._set_func.length === 2, " set function must have 2 arguments ( variant, callback)");

    this._timestamped_set_func = (
        timestamped_value: DataValue,
        callback: (err: Error | null, statusCode: StatusCode, dataValue: DataValue) => void
    ) => {
        assert(timestamped_value instanceof DataValue);
        this._set_func(timestamped_value.value, (err: Error | null, statusCode: StatusCode) => {
            // istanbul ignore next
            if (!err && !statusCode) {
                errorLog(
                    chalk.red("UAVariable Binding Error _set_func must return a StatusCode, check the bindVariable parameters")
                );
                errorLog(chalk.yellow("StatusCode.Good is assumed"));
                return callback(err, StatusCodes.Good, timestamped_value);
            }
            callback(err, statusCode, timestamped_value);
        });
    };
}

function _Variable_bind_with_timestamped_set(
    this: UAVariableImpl,
    options: {
        timestamped_set: TimestampSetFunc;
        set: undefined;
    }
) {
    assert(typeof options.timestamped_set === "function");
    assert(
        options.timestamped_set.length === 2,
        "timestamped_set must have 2 parameters  timestamped_set: function(dataValue,callback){}"
    );
    assert(!options.set, "should not specify set when timestamped_set_func exists ");
    this._timestamped_set_func = convertToCallbackFunction1<StatusCode, DataValue, UAVariable>(options.timestamped_set);
}

interface SetterOptions {
    set?: SetFunc;
    timestamped_set?: TimestampSetFunc;
    timestamped_get?: TimestampGetFunc;
}
function bind_setter(this: UAVariableImpl, options: SetterOptions) {
    if (typeof options.set === "function") {
        // variation 1
        _Variable_bind_with_simple_set.call(this, options);
    } else if (typeof options.timestamped_set === "function") {
        // variation 2
        assert(typeof options.timestamped_get === "function", "timestamped_set must be used with timestamped_get ");
        _Variable_bind_with_timestamped_set.call(this, {
            set: undefined,
            timestamped_set: options.timestamped_set
        });
    } else if (typeof options.timestamped_get === "function") {
        // timestamped_get is  specified but timestamped_set is not
        // => Value is read-only
        _Variable_bind_with_timestamped_set.call(this, {
            set: undefined,
            timestamped_set: _not_writable_timestamped_set_func
        });
    } else {
        _Variable_bind_with_timestamped_set.call(this, {
            set: undefined,
            timestamped_set: _default_writable_timestamped_set_func
        });
    }
}

interface GetterOptions {
    get?: GetFunc;
    timestamped_get?: TimestampGetFunc;
    refreshFunc?: (callback: CallbackT<DataValue>) => void;
    dataType?: DataType | string;
    value?: any;
}
function bind_getter(this: UAVariableImpl, options: GetterOptions) {
    if (typeof options.get === "function") {
        // variation 1
        _Variable_bind_with_simple_get.call(this, options);
    } else if (typeof options.timestamped_get === "function") {
        // variation 2
        _Variable_bind_with_timestamped_get.call(this, {
            get: undefined,
            timestamped_get: options.timestamped_get
        });
    } else if (typeof options.refreshFunc === "function") {
        // variation 3
        _Variable_bind_with_async_refresh.call(this, options);
    } else {
        assert(
            !Object.prototype.hasOwnProperty.call(options, "set"),
            "getter is missing : a getter must be provided if a setter is provided"
        );
        // xx bind_variant.call(this,options);
        if (options.dataType !== undefined) {
            // if (options.dataType !== DataType.ExtensionObject) {
            this.setValueFromSource(options as VariantLike);
            // }
        }
    }
}

export interface UAVariableImplT<T, DT extends DataType> extends UAVariableImpl, UAVariableT<T, DT> {
    on(): any;
    once(): any;
    readValueAsync(context: ISessionContext | null): Promise<DataValueT<T, DT>>;
    readValueAsync(context: ISessionContext | null, callback: CallbackT<DataValueT<T, DT>>): void;

    readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValueT<T, DT>;

    readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValueT<T, DT>;

    writeValue(
        context: ISessionContext,
        dataValue: DataValueT<T, DT>,
        indexRange: NumericRange | null,
        callback: StatusCodeCallback
    ): void;
    writeValue(context: ISessionContext, dataValue: DataValueT<T, DT>, callback: StatusCodeCallback): void;
    writeValue(context: ISessionContext, dataValue: DataValueT<T, DT>, indexRange?: NumericRange | null): Promise<StatusCode>;
}
export class UAVariableImplT<T, DT extends DataType> extends UAVariableImpl {}
// x TO DO
// require("./data_access/ua_variable_data_access");
// require("./historical_access/ua_variable_history");
