// tslint:disable:max-classes-per-file
/**
 * @module node-opcua-address-space
 */
import { EventEmitter } from "events";
import {
    ByteString,
    DateTime, Int64,
    UABoolean,
    UAString,
    UInt16, UInt32, UInt64
} from "node-opcua-basic-types";

export type Duration = number;

import {
    AccessLevelFlag,
    AttributeIds, BrowseDirection, DiagnosticInfo,
    LocalizedText, LocalizedTextLike,
    NodeClass,
    QualifiedName, QualifiedNameLike
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { PreciseClock } from "node-opcua-date-time";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import {
    BrowseDescription,
    BrowseDescriptionOptions,
    BrowseResult
} from "node-opcua-service-browse";
import {
    HistoryReadDetails,
    HistoryReadResult, ReadAtTimeDetails, ReadEventDetails, ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-service-history";
import {
    WriteValueOptions
} from "node-opcua-service-write";
import { StatusCode } from "node-opcua-status-code";
import {
    Argument,
    ArgumentOptions,
    AxisInformation,
    AxisInformationOptions,
    AxisScaleEnumeration,
    BrowsePath,
    BrowsePathResult,
    BuildInfo, CallMethodResult, CallMethodResultOptions,
    EnumValueType,
    EnumValueTypeOptions,
    EUInformation,
    EUInformationOptions,
    Range, RangeOptions,
    ReferenceDescription, ServerDiagnosticsSummaryDataType,
    ServerState,
    ServerStatusDataType, SessionDiagnosticsDataType
} from "node-opcua-types";
import { DataType, Variant, VariantArrayType, VariantLike } from "node-opcua-variant";
import { MinimalistAddressSpace, Reference } from "../src/reference";
import { State, StateMachine, StateMachineType, Transition, UtcTime } from "./interfaces/state_machine";
import { PseudoSession } from "./pseudo_session";
import { SessionContext } from "./session_context";

import { ExtensionObject } from "node-opcua-extension-object";
import { AddressSpacePrivate } from "../src/address_space_private";
import { UAAcknowledgeableConditionBase } from "../src/alarms_and_conditions/ua_acknowledgeable_condition_base";
import { UAAlarmConditionBase } from "../src/alarms_and_conditions/ua_alarm_condition_base";
import { UAConditionBase } from "../src/alarms_and_conditions/ua_condition_base";
import { UADiscreteAlarm } from "../src/alarms_and_conditions/ua_discrete_alarm";
import { UAExclusiveDeviationAlarm } from "../src/alarms_and_conditions/ua_exclusive_deviation_alarm";
import { UAExclusiveLimitAlarm } from "../src/alarms_and_conditions/ua_exclusive_limit_alarm";
import { UALimitAlarm } from "../src/alarms_and_conditions/ua_limit_alarm";
import { UANonExclusiveDeviationAlarm } from "../src/alarms_and_conditions/ua_non_exclusive_deviation_alarm";
import { UANonExclusiveLimitAlarm } from "../src/alarms_and_conditions/ua_non_exclusive_limit_alarm";

export type ErrorCallback = (err?: Error) => void;

export declare interface AddReferenceOpts {
    referenceType: string | NodeId | UAReferenceType;
    nodeId: NodeId | string | BaseNode;
    /**
     * default = true
     */
    isForward?: boolean;
    _referenceType?: UAReferenceType;
    node?: BaseNode;

}

export interface UAReference {
    readonly nodeId: NodeId;
    readonly referenceType: NodeId;
    readonly isForward: boolean;

    readonly node?: BaseNode;
}

export declare function resolveReferenceType(
  addressSpace: MinimalistAddressSpace,
  reference: UAReference
): UAReferenceType;

export declare function resolveReferenceNode(
  addressSpace: MinimalistAddressSpace,
  reference: UAReference
): BaseNode;

export interface ISessionContext {

    getCurrentUserRole(): string;

    checkPermission(
      node: BaseNode,
      action: AccessLevelFlag | string
    ): boolean;

}

export interface XmlWriter {

    translationTable: any;
    visitedNode: any;

    startElement(elementName: string): this;

    endElement(): this;

    writeAttribute(attributeName: string, attributeValue: string | number): this;

    writeComment(comment: string): this;

    text(str: string): this;

}

export declare function makeAttributeEventName(attributeId: AttributeIds): string;

export declare class BaseNode extends EventEmitter {

    public readonly addressSpace: AddressSpace;
    public readonly browseName: QualifiedName;
    public readonly displayName: LocalizedText[];
    public readonly description: LocalizedText;
    public readonly nodeClass: NodeClass;
    public readonly nodeId: NodeId;
    public readonly modellingRule?: ModellingRuleType;
    public readonly parentNodeId?: NodeId;

    // access to parent namespace
    public readonly namespaceIndex: number;
    public readonly namespaceUri: string;
    public readonly namespace: Namespace;

    /**
     * return a complete name of this object by pre-pending
     * name of its parent(s) to its own name
     */
    public fullName(): string;

    public addReference(options: AddReferenceOpts): void;

    public removeReference(referenceOpts: AddReferenceOpts): void;

    public readAttribute(
      context: SessionContext | null,
      attributeId: AttributeIds,
      indexRange?: NumericRange,
      dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    public writeAttribute(
      context: SessionContext,
      writeValue: any,
      callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void;

    /**
     * return a array with the event source of this object.
     * self = HasEventSource => nodes
     */
    public getEventSources(): BaseNode[];

    /**
     * return a array of the objects for which this node is an EventSource
     * nodes = HasEventSource => self
     */
    public getEventSourceOfs(): BaseNode[];

    // [key: string]: BaseNode;

    public install_extra_properties(): void;

    public findReferencesEx(
      strReference: string,
      browseDirection?: BrowseDirection
    ): UAReference[];

    public findReferences(
      referenceType: string | NodeId | UAReferenceType,
      isForward?: boolean
    ): UAReference[];

    public findReference(
      strReference: string,
      isForward?: boolean
    ): UAReference | null;

    public findReferencesExAsObject(
      strReference: string,
      browseDirection?: BrowseDirection
    ): BaseNode[];

    public findReferencesAsObject(
      strReference: string,
      isForward: boolean
    ): BaseNode[];

    public allReferences(): Reference[];

    public getChildByName(
      browseName: string | QualifiedName
    ): BaseNode | null;

    /**
     * this methods propagates the forward references to the pointed node
     * by inserting backward references to the counter part node
     */
    public propagate_back_references(): void;

    /**
     * browse the node to extract information requested in browseDescription
     * @method browseNode
     * @param browseDescription
     * @param browseDescription.referenceTypeId {NodeId}
     * @param browseDescription.browseDirection {BrowseDirection}
     * @param browseDescription.nodeClassMask   {NodeClassMask}
     * @param browseDescription.resultMask      {UInt32}
     * @param session                           {SessionContext}
     * @return {ReferenceDescription[]}
     */
    public browseNode(
      browseDescription: BrowseDescriptionOptions,
      session?: SessionContext
    ): ReferenceDescription[];
}

export declare class UAView extends BaseNode {
    public readonly nodeClass: NodeClass.View;

}

export interface EnumValue2 {
    name: string;
    value: number;
}

export  type VariableSetterVariation1 = (
  this: UAVariable,
  value: Variant
) => StatusCode;

export  type VariableSetterVariation2 = (
  this: UAVariable,
  value: Variant,
  callback: (err: Error | null, statusCode: StatusCode) => void) => void;

export type VariableSetter = VariableSetterVariation1
  | VariableSetterVariation2;

export interface BindVariableOptionsVariation1 {
    get: (this: UAVariable) => Variant;
    set?: VariableSetter | null;
    historyRead?: any;
}

export  type DataValueCallback =
  (err: Error | null, dataValue?: DataValue) => void;

export  type StatusCodeCallBack =
  (err: Error | null, statusCode?: StatusCode) => void;

export  type VariableDataValueGetterSync =
  () => DataValue;
export  type VariableDataValueGetterAsync =
  (callback: DataValueCallback) => void;

export  type VariableDataValueSetterWithCallback = (
  dataValue: DataValue,
  callback: StatusCodeCallBack
) => void;

export interface BindVariableOptionsVariation2 {
    timestamped_get: VariableDataValueGetterSync | VariableDataValueGetterAsync;
    timestamped_set?: VariableDataValueSetterWithCallback;
    historyRead?: any;
}

export interface BindVariableOptionsVariation3 {
    refreshFunc: (
      callback: DataValueCallback
    ) => void;
    historyRead?: any;
}

export type BindVariableOptions =
  {
      historyRead?: any
  } |
  BindVariableOptionsVariation1 |
  BindVariableOptionsVariation2 |
  BindVariableOptionsVariation3 ;

export type ContinuationPoint = Buffer;
export type Callback<T> = (err: Error | null, result?: T) => void;

export interface VariableAttributes {
    dataType: NodeId;
    accessLevel: number;
    userAccessLevel: number;
    valueRank: number;
    minimumSamplingInterval: number;
}

export interface IPropertyAndComponentHolder {

    getComponentByName(
      componentName: QualifiedNameLike,
      namespaceIndex?: number
    ): UAObject | UAVariable | null;

    getPropertyByName(browseName: string, namespaceIndex?: number): UAVariable | null;

    getAggregates(): BaseNode[];

    getComponents(): BaseNode[];

    getProperties(): BaseNode[];

    getNotifiers(): BaseNode[];
}

export interface UAVariable extends BaseNode, VariableAttributes, IPropertyAndComponentHolder {

    readonly nodeClass: NodeClass.Variable;
    readonly parent: BaseNode | null;
    readonly dataTypeObj: UADataType;
    readonly semantic_version: number;

    typeDefinitionObj: UAVariableType;
    typeDefinition: NodeId;

    // variable attributes
    dataType: NodeId;
    accessLevel: number;
    userAccessLevel: number;
    valueRank: number;
    minimumSamplingInterval: number;
    arrayDimensions: number[];
    historizing: boolean;

    isReadable(context: SessionContext): boolean;

    isUserReadable(context: SessionContext): boolean;

    isWritable(context: SessionContext): boolean;

    isUserWritable(context: SessionContext): boolean;

    /***
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
     *  BadAttributeIdInvalid       Bad_AttributeIdInvalid The attribute is not supported for the specified node.
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
    readValue(
      context?: SessionContext | null,
      indexRange?: NumericRange,
      dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    readValueAsync(
      context?: SessionContext | null
    ): Promise<DataValue>;

    readValueAsync(
      context: SessionContext | null,
      callback: DataValueCallback
    ): void;

    readEnumValue(): EnumValue2;

    writeEnumValue(value: string | number): void;

    readAttribute(
      context: SessionContext | null,
      attributeId: AttributeIds,
      indexRange?: NumericRange,
      dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    setValueFromSource(
      value: VariantLike,
      statusCode?: StatusCode,
      sourceTimestamp?: Date
    ): void;

    writeValue(
      context: SessionContext,
      dataValue: DataValue,
      indexRange: string | NumericRange | null,
      callback: StatusCodeCallBack
    ): void;

    writeValue(
      context: SessionContext,
      dataValue: DataValue,
      callback: StatusCodeCallBack
    ): void;

    writeValue(
      context: SessionContext,
      dataValue: DataValue,
      indexRange?: string | NumericRange | null
    ): Promise<StatusCode>;

    asyncRefresh(
      callback: DataValueCallback
    ): void;

    asyncRefresh(): Promise<DataValue>;

    writeAttribute(
      context: SessionContext,
      writeValue: WriteValueOptions,
      callback: StatusCodeCallBack
    ): void;

    writeAttribute(
      context: SessionContext,
      writeValue: WriteValueOptions
    ): Promise<StatusCode>;

    // advanced
    touchValue(updateNow?: PreciseClock): void;

    setPermissions(permissions: Permissions): void;

    bindVariable(
      options: BindVariableOptions,
      overwrite?: boolean
    ): void;

    bindExtensionObject(
      optionalExtensionObject?: ExtensionObject
    ): ExtensionObject | null;

    historyRead(
      context: SessionContext,
      historyReadDetails: HistoryReadDetails,
      indexRange: NumericRange | null,
      dataEncoding: QualifiedNameLike | null,
      continuationPoint?: ContinuationPoint
    ): Promise<HistoryReadResult>;

    historyRead(
      context: SessionContext,
      historyReadDetails: HistoryReadDetails,
      indexRange: NumericRange | null,
      dataEncoding: QualifiedNameLike | null,
      continuationPoint: ContinuationPoint | null,
      callback: Callback<HistoryReadResult>
    ): void;

    clone(
      options?: any,
      optionalFilter?: any,
      extraInfo?: any): UAVariable;

    // ----------------- Event handlers

    on(eventName: "semantic_changed", eventHandler: () => void): this;

    on(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): this;

    once(eventName: "semantic_changed", eventHandler: () => void): this;

    once(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): this;
}

export interface AddDataItemOptions extends AddVariableOptions {
    /** @example  "(tempA -25) + tempB" */
    definition?: string;
    /** @example 0.5 */
    valuePrecision?: number;
}

export interface UADataItem extends UAVariable {
    definition?: Property<DataType.String>;
    valuePrecision?: Property<DataType.Double>;
}

export interface AddAnalogDataItemOptions extends AddDataItemOptions {
    engineeringUnitsRange?: {
        low: number;
        high: number;
    };
    instrumentRange?: {
        low: number;
        high: number;
    };
    engineeringUnits?: EUInformationOptions | EUInformation;
    minimumSamplingInterval?: number;
    dataType?: string | NodeIdLike;
}

export interface UAAnalogItem extends UADataItem {
// HasProperty  Variable  InstrumentRange  Range  PropertyType  Optional
// HasProperty  Variable  EURange  Range  PropertyType  Mandatory
// HasProperty  Variable  EngineeringUnits  EUInformation  PropertyType  Optional
    engineeringUnits: Property<"EUInformation">;
    instrumentRange?: Property<"Range">;
    euRange: Property<"Range">;
}

export interface UAMultiStateDiscrete extends UAVariable {

    enumStrings: Property<"StringArray">;

    getValue(): number;

    getValueAsString(): string;

    getIndex(value: string): number;

    setValue(value: string | number): void;

}

export interface EnumValueTypeOptionsLike {
    value?: Int64 | UInt32;
    displayName?: (LocalizedTextLike | null);
    description?: (LocalizedTextLike | null);
}

export interface AddMultiStateValueDiscreteOptions extends AddVariableOptions {
    enumValues: EnumValueTypeOptionsLike[] | { [key: string]: number };
    value?: number | Int64;
}

export interface UAMultiStateValueDiscrete extends UAVariable {
    enumValues: Property<"EnumValueType">;
    valueAsText: Property<DataType.String>;

}

// tslint:disable:no-empty-interface
export interface UAEventType extends UAObjectType {

}

export type EventTypeLike = string | NodeId | UAEventType;

export interface PseudoVariantNull {
    dataType: "Null" | DataType.Null;
}

export interface PseudoVariantString {
    dataType: "String" | DataType.String;
    value: string;
}

export interface PseudoVariantBoolean {
    dataType: "Boolean" | DataType.Boolean;
    value: boolean;
}

export interface PseudoVariantNodeId {
    dataType: "NodeId" | DataType.NodeId;
    value: NodeId;
}

export interface PseudoVariantUInt32 {
    dataType: "UInt32" | DataType.UInt32;
    value: UInt32;
}

export interface PseudoVariantDateTime {
    dataType: "DateTime" | DataType.DateTime;
    value: DateTime;
}

export interface PseudoVariantLocalizedText {
    dataType: "LocalizedText" | DataType.LocalizedText;
    value: LocalizedTextLike;
}

export interface PseudoVariantDuration {
    dataType: "Duration";
    value: number;
}

export interface PseudoVariantStatusCode {
    dataType: "StatusCode" | DataType.StatusCode;
    value: StatusCode;
}

export interface PseudoVariantByteString {
    dataType: "ByteString" | DataType.ByteString;
    value: Buffer;
}

export interface PseudoVariantExtensionObject {
    dataType: "ExtensionObject" | DataType.ExtensionObject;
    value: object;
}

export interface PseudoVariantExtensionObjectArray {
    dataType: "ExtensionObject";
    arrayType: VariantArrayType.Array;
    value: object[];
}

export type PseudoVariant =
  PseudoVariantNull |
  PseudoVariantString |
  PseudoVariantBoolean |
  PseudoVariantNodeId |
  PseudoVariantDateTime |
  PseudoVariantByteString |
  PseudoVariantDuration |
  PseudoVariantLocalizedText |
  PseudoVariantStatusCode |
  PseudoVariantUInt32 |
  PseudoVariantExtensionObject |
  PseudoVariantExtensionObjectArray
  ;

export interface RaiseEventData {
    $eventDataSource?: UAEventType;

    [key: string]: PseudoVariant | Variant | UAEventType | undefined;
}

export interface EventRaiser {
    raiseEvent(eventType: EventTypeLike, eventData: RaiseEventData): void;
}

export interface UAObject extends BaseNode, EventRaiser, IPropertyAndComponentHolder {

    readonly nodeClass: NodeClass.Object;
    parent: BaseNode | null;
    typeDefinitionObj: UAObjectType;
    typeDefinition: NodeId;

    readonly hasMethods: boolean;

    //
    getFolderElementByName(browseName: string, namespaceIndex?: number): BaseNode | null;

    // Method accessor
    getMethodById(nodeId: NodeId): UAMethod | null;

    getMethodByName(methodName: string): UAMethod | null;

    getMethods(): UAMethod[];

    raiseEvent(eventType: EventTypeLike, eventData: RaiseEventData): void;

    on(eventName: "event", eventHandler: (eventData: EventData) => void): this;

}

// export interface CallMethodResult {
//     statusCode: StatusCode;
//     outputArguments?: VariantLike[];
//     inputArgumentResults?: StatusCode[];
//     inputArgumentDiagnosticInfos?: DiagnosticInfo[];
//
// }

export type MethodFunctorCallback = (err: Error | null, callMethodResult: CallMethodResultOptions) => void;

export type MethodFunctor = (
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext,
  callback: MethodFunctorCallback
) => void;

export declare class UAMethod extends BaseNode {

    public readonly nodeClass: NodeClass.Method;
    public readonly typeDefinitionObj: UAObjectType;
    public readonly parent: UAObject | null;

    public readonly inputArguments?: UAVariable;
    public readonly outputArguments?: UAVariable;

    /**
     *
     */
    public _getExecutableFlag?: (sessionContext: SessionContext) => boolean;

    public bindMethod(methodFunction: MethodFunctor): void;

    public getExecutableFlag(context: ISessionContext): boolean;

    public getInputArguments(): Argument[];

    public getOutputArguments(): Argument[];

    /**
     * @async
     * @param inputArguments
     * @param context
     * @param callback
     */
    public execute(
      inputArguments: VariantLike[] | null,
      context: SessionContext,
      callback: MethodFunctorCallback
    ): void;

    public execute(
      inputArguments: null | VariantLike[],
      context: SessionContext
    ): Promise<CallMethodResultOptions>;

    public clone(
      options: any,
      optionalFilter?: any,
      extraInfo?: any
    ): UAMethod;

}

export interface UADataType extends BaseNode {
    readonly nodeClass: NodeClass.DataType;
    readonly subtypeOfObj: UADataType | null;
    readonly subtypeOf: NodeId | null;

    readonly isAbstract: boolean;

    readonly binaryEncodingDefinition: string;
    readonly binaryEncodingNodeId: NodeId;
    readonly binaryEncoding: BaseNode;

    readonly xmlEncodingDefinition: string;
    readonly xmlEncodingNodeId: NodeId;
    readonly xmlEncoding: BaseNode;

    isSupertypeOf(referenceType: NodeIdLike | UADataType): boolean;

    getEncodingNode(encodingName: string): BaseNode | null;

}

export interface InstantiateOptions {

    /**
     * the browse name of the new node to instantiate
     */
    browseName: QualifiedNameLike;

    /**
     * an optional description
     *
     * if not provided the default description of the corresponding Type
     * will be used.
     */
    description?: LocalizedTextLike;

    /**
     * the parent Folder holding this object
     *
     * note
     *  - when organizedBy is specified, componentOf must not be defined
     */
    organizedBy?: NodeIdLike | BaseNode;

    /**
     *  the parent Object holding this object
     * note
     *  - when componentOf is specified, organizedBy must not be defined
     */
    componentOf?: NodeIdLike | BaseNode;

    /**
     *
     */
    notifierOf?: NodeIdLike | BaseNode;

    /**
     *
     */
    eventSourceOf?: NodeIdLike | BaseNode;

    /**
     *
     * @default: []
     */
    optionals?: string[];

    /**
     * modellingRule
     */
    modellingRule?: ModellingRuleType;

    /**
     * a (optional) predefined nodeId to assigned to the instance
     * If not specified, a default nodeid will be created.
     */
    nodeId?: NodeIdLike;
}

export interface InstantiateVariableOptions extends InstantiateOptions {
    arrayDimensions?: number[];
    dataType?: any;
    extensionObject?: any;
    nodeId?: NodeIdLike;
    minimumSamplingInterval?: number;
    value?: any;
    valueRank?: number;
}

export interface InstantiateObjectOptions extends InstantiateOptions {
    //
    conditionSource?: NodeId | BaseNode;
}

export declare interface UAObjectType extends BaseNode, IPropertyAndComponentHolder {
    readonly nodeClass: NodeClass.ObjectType;
    readonly subtypeOf: NodeId | null;
    readonly subtypeOfObj: UAObjectType | null;

    readonly isAbstract: boolean;
    readonly hasMethods: boolean;

    isSupertypeOf(referenceType: NodeIdLike | UAObjectType): boolean;

    instantiate(options: InstantiateObjectOptions): UAObject;

    // Method accessor
    getMethodById(nodeId: NodeId): UAMethod | null;

    getMethodByName(methodName: string): UAMethod | null;

    getMethods(): UAMethod[];

}

export declare class UAVariableType extends BaseNode implements VariableAttributes {
    public readonly nodeClass: NodeClass.VariableType;
    public readonly subtypeOfObj: UAVariableType | null;
    public readonly subtypeOf: NodeId | null;

    public dataType: NodeId;
    public accessLevel: number;
    public userAccessLevel: number;
    public valueRank: number;
    public minimumSamplingInterval: number;
    public arrayDimensions: number[];
    public historizing: boolean;

    public isAbstract: boolean;

    public isSupertypeOf(type: UAVariableType): boolean;

    public instantiate(options: InstantiateVariableOptions): UAVariable;

}

export declare class UAReferenceType extends BaseNode {
    public readonly nodeClass: NodeClass.ReferenceType;
    public readonly subtypeOfObj: UAReferenceType | null;
    public readonly subtypeOf: NodeId | null;

    public readonly inverseName: LocalizedText;

    public isSupertypeOf(baseType: UAReferenceType): boolean;

    public getAllSubtypes(): UAReferenceType[];

}

export declare interface UATwoStateVariable extends UAVariable {
    // components & properties
    readonly falseState?: UAVariable;
    readonly trueState?: UAVariable;
    readonly id: UAVariable;
    readonly effectiveTransitionTime?: UAVariable;
    readonly transitionTime?: UAVariable;
    readonly effectiveDisplayName?: UAVariable;
    // references
    readonly isFalseSubStateOf: BaseNode | null;
    readonly isTrueSubStateOf: BaseNode | null;

    setValue(boolValue: boolean): void;

    getValue(): boolean;

    getValueAsString(): string;

    getFalseSubStates(): BaseNode[];

    getTrueSubStates(): BaseNode[];
}

export enum EUEngineeringUnit {
    degree_celsius
    // to be continued
}

export type ModellingRuleType = "Mandatory" | "Optional" | null;

export interface AddBaseNodeOptions {

    browseName: QualifiedNameLike;

    nodeId?: NodeIdLike;

    displayName?: LocalizedTextLike | LocalizedTextLike[];
    description?: LocalizedTextLike;

    componentOf?: NodeIdLike | BaseNode;
    eventSourceOf?: NodeIdLike | BaseNode;
    notifierOf?: NodeIdLike | BaseNode;
    organizedBy?: NodeIdLike | BaseNode;
    propertyOf?: NodeIdLike | BaseNode;

    modellingRule?: ModellingRuleType;

    references?: AddReferenceOpts[];
}

export interface Permissions {
    CurrentRead?: string[];
    CurrentWrite?: string[];
    HistoryRead?: string[];
    HistoryWrite?: string[];
    StatusWrite?: string[];
    TimestampWrite?: string[];
}

export type AccessLevelString = string;

// element common between AddVariableTypeOptions and AddVariableOptions
export interface VariableStuff {
    dataType?: string | NodeIdLike | UADataType;
    /**
     * This Attribute indicates whether the Value Attribute of the Variable is an array and how many dimensions
     * the array has.
     * It may have the following values:
     *  n > 1:                      the Value is an array with the specified number of dimensions.
     *  OneDimension (1):           The value is an array with one dimension.
     *  OneOrMoreDimensions (0):    The value is an array with one or more dimensions.
     *  Scalar (?1):                The value is not an array.
     *  Any (?2):                   The value can be a scalar or an array with any number of dimensions.
     *  ScalarOrOneDimension (?3):  The value can be a scalar or a one dimensional array.
     *  NOTE All DataTypes are considered to be scalar, even if they have array-like semantics
     *  like ByteString and String.
     */

    valueRank?: UInt32;
    /**
     * This Attribute specifies the length of each dimension for an array value. T
     * The Attribute is intended to describe the capability of the Variable, not the current size.
     * The number of elements shall be equal to the value of the ValueRank Attribute. Shall be null
     * if ValueRank ? 0.
     * A value of 0 for an individual dimension indicates that the dimension has a variable length.
     * For example, if a Variable is defined by the following C array:
     * Int32 myArray[346];
     *     then this Variables DataType would point to an Int32, the Variable�s ValueRank has the
     *     value 1 and the ArrayDimensions is an array with one entry having the value 346.
     *     Note that the maximum length of an array transferred on the wire is 2147483647 (max Int32)
     *     and a multi-dimensional array is encoded as a one dimensional array.
     */
    arrayDimensions?: UInt32[];

    /**
     * The AccessLevel Attribute is used to indicate how the Value of a Variable can be accessed
     * (read/write) and if it contains current and/or historic data. The AccessLevel does not take
     * any user access rights into account, i.e. although the Variable is writable this may be
     * restricted to a certain user / user group. The AccessLevelType is defined in 8.57.
     */
    accessLevel?: UInt32 | AccessLevelString;

    /**
     * The UserAccessLevel Attribute is used to indicate how the Value of a Variable can be accessed
     * (read/write) and if it contains current or historic data taking user access rights into account.
     * The AccessLevelType is defined in 8.57.
     */
    userAccessLevel?: UInt32 | AccessLevelString;

    /**
     * The minimumSamplingInterval Attribute indicates how 'current' the Value of the Variable will
     * be kept.
     *  It specifies (in milliseconds) how fast the Server can reasonably sample the value
     * for changes (see Part 4 for a detailed description of sampling interval).
     * A minimumSamplingInterval of 0 indicates that the Server is to monitor the item continuously.
     * A minimumSamplingInterval of -1 means indeterminate.
     */
    minimumSamplingInterval?: number;

    /**
     * The Historizing Attribute indicates whether the Server is actively collecting data for the
     * history of the Variable.
     *  This differs from the AccessLevel Attribute which identifies if the
     * Variable has any historical data. A value of TRUE indicates that the Server is actively
     * collecting data. A value of FALSE indicates the Server is not actively collecting data.
     * Default value is FALSE.
     */
    historizing?: boolean;

    dataValue?: DataValue;

}

export interface AddVariableTypeOptions extends AddBaseNodeOptions, VariableStuff {
    isAbstract?: boolean;
    /**
     * @default BaseVariableType
     */
    subtypeOf?: string | UAVariableType;
    postInstantiateFunc?: (node: UAVariableType) => void;
    value?: VariantLike;
}

export interface AddVariableOptions extends AddBaseNodeOptions, VariableStuff {
    /**
     * permissions
     */
    // default value is "BaseVariableType";
    typeDefinition?: string | NodeId | UAVariableType;
    permissions?: Permissions;
    value?: VariantLike | BindVariableOptions | number | Int64;
    postInstantiateFunc?: (node: UAVariable) => void;
}

export interface AddObjectTypeOptions extends AddBaseNodeOptions {
    isAbstract?: boolean;
    /**
     * @default BaseObjectType
     */
    subtypeOf?: string | UAObjectType;
    eventNotifier?: number;
    postInstantiateFunc?: (node: UAObject) => void;
}

export interface EnumerationItem {
    description?: LocalizedTextLike;
    displayName: LocalizedTextLike;
    value: number;
}

export interface AddEnumerationTypeOptions extends AddBaseNodeOptions {
    enumeration: string [] | EnumerationItem[];
}

export interface AddObjectOptions extends AddBaseNodeOptions {
    eventNotifier?: number;
    // default value is "BaseObjectType";
    typeDefinition?: string | NodeId | UAObjectType;
    nodeVersion?: string;
}

export interface AddViewOptions extends AddBaseNodeOptions {
    //
    typeDefinition?: string | NodeId | UAObjectType;
}

export interface AddMethodOptions {
    nodeId?: NodeIdLike;
    browseName: QualifiedNameLike;
    displayName?: LocalizedTextLike;
    description?: LocalizedTextLike;
    inputArguments: ArgumentOptions[];
    modellingRule?: ModellingRuleType;
    outputArguments: ArgumentOptions[];
    componentOf?: NodeIdLike | BaseNode;
    executable?: boolean;
    userExecutable?: boolean;
}

export interface AddMultiStateDiscreteOptions extends AddBaseNodeOptions, VariableStuff {
    value?: number;
    enumStrings: string[];    // default value is "BaseVariableType";
    typeDefinition?: string | NodeId | UAVariableType;
    permissions?: Permissions;
    postInstantiateFunc?: (node: UAVariable) => void;
}

export interface AddReferenceTypeOptions extends AddBaseNodeOptions {
    isAbstract?: boolean;
    inverseName: string;
    subtypeOf?: string | NodeId | UAReferenceType;
}

export interface AddTwoStateVariableOptions extends AddVariableOptions {
    falseState?: string;
    trueState?: string;
    optionals?: string[];
    isFalseSubStateOf?: NodeIdLike | BaseNode;
    isTrueSubStateOf?: NodeIdLike | BaseNode;
}

export interface CreateDataTypeOptions extends AddBaseNodeOptions {
    isAbstract?: boolean;
    superType?: string | NodeId;

}

// -
/**
 *
 * @param options.componentOf {NodeId}
 * @param options.browseName {String}
 * @param options.title {String}
 * @param [options.instrumentRange]
 * @param [options.instrumentRange.low] {Double}
 * @param [options.instrumentRange.high] {Double}
 * @param options.engineeringUnitsRange.low {Double}
 * @param options.engineeringUnitsRange.high {Double}
 * @param options.engineeringUnits {String}
 * @param [options.nodeId = {NodeId}]
 * @param options.accessLevel
 * @param options.userAccessLevel
 * @param options.title {String}
 * @param options.axisScaleType {AxisScaleEnumeration}
 *
 * @param options.xAxisDefinition {AxisInformation}
 * @param options.xAxisDefinition.engineeringUnits  EURange
 * @param options.xAxisDefinition.range
 * @param options.xAxisDefinition.range.low
 * @param options.xAxisDefinition.range.high
 * @param options.xAxisDefinition.title  {LocalizedText}
 * @param options.xAxisDefinition.axisScaleType {AxisScaleEnumeration}
 * @param options.xAxisDefinition.axisSteps = <null>  {Array<Double>}
 * @param options.value
 */
export interface AddYArrayItemOptions extends AddVariableOptions {

    title: string;
    instrumentRange?: RangeOptions;
    engineeringUnitsRange?: RangeOptions;
    engineeringUnits?: EUInformationOptions;
    axisScaleType: AxisScaleEnumeration | string;
    xAxisDefinition?: AxisInformationOptions;
}

export interface RangeVariable extends UAVariable {
    low: UAVariableT<DataType.Double>;
    high: UAVariableT<DataType.Double>;
}

export interface XAxisDefinitionVariable extends UAVariable {
    engineeringUnits: UAVariableT<UAString>;
    title: UAVariableT<UAString>;
    euRange: RangeVariable;

}

export interface YArrayItemVariable extends UAVariable {
    euRange: UAVariableT<Range>;
    title: UAVariableT<DataType.String>;
    xAxisDefinition: UAVariableT<DataType.ExtensionObject>; // AxisInformationOptions
    instrumentRange: UAVariableT<Range>;
}

export type CreateNodeOptions = any;

export declare const NamespaceOptions: { nodeIdNameSeparator: string };

export declare interface Namespace {

    version: number;
    publicationDate: Date;
    namespaceUri: string;
    addressSpace: AddressSpace;
    index: number;

    // -------------------------------------------------------------------------

    findObjectType(objectType: string): UAObjectType | null;

    findVariableType(variableType: string): UAVariableType | null;

    findDataType(dataType: string): UADataType | null;

    findReferenceType(referenceType: string): UAReferenceType | null;

    findReferenceTypeFromInverseName(referenceType: string): UAReferenceType | null;

    findNode(nodeId: NodeIdLike): BaseNode | null;

    // -------------------------------------------------------------------------

    addAlias(aliasName: string, nodeId: NodeId): void;

    addObjectType(options: AddObjectTypeOptions): UAObjectType;

    addVariableType(options: AddVariableTypeOptions): UAVariableType;

    addReferenceType(options: AddReferenceTypeOptions): UAReferenceType;

    addEnumerationType(options: AddEnumerationTypeOptions): UADataType;

    createDataType(options: CreateDataTypeOptions): UADataType;

    addVariable(options: AddVariableOptions): UAVariable;

    addObject(options: AddObjectOptions): UAObject;

    addView(options: AddViewOptions): UAView;

    addFolder(parentFolder: NodeIdLike | UAObject, options: any): UAObject;

    addTwoStateVariable(options: AddTwoStateVariableOptions): UATwoStateVariable;

    addTwoStateDiscrete(options: any): UATwoStateDiscrete;

    addMultiStateDiscrete(options: AddMultiStateDiscreteOptions): UAMultiStateDiscrete;

    addMultiStateValueDiscrete(options: AddMultiStateValueDiscreteOptions): UAMultiStateValueDiscrete;

    addYArrayItem(options: AddYArrayItemOptions): YArrayItemVariable;

    createNode(options: CreateNodeOptions): BaseNode;

    // -------------------------------------------------------------------------

    deleteNode(node: NodeId | BaseNode): void;

    addDataItem(options: AddDataItemOptions): UADataItem;

    addAnalogDataItem(options: AddAnalogDataItemOptions): UAAnalogItem;

    /**
     * add a new event type to the address space
     * @example
     *
     *      const evtType = namespace.addEventType({
     *          browseName: "MyAuditEventType",
     *          subtypeOf:  "AuditEventType"
     *      });
     *      const myConditionType = namespace.addEventType({
     *          browseName: "MyConditionType",
     *          subtypeOf:  "ConditionType",
     *          isAbstract: false
     *      });
     *
     */
    addEventType(options: {
        browseName: QualifiedNameLike,
        /**
         * @default BaseEventType
         */
        subtypeOf?: string | UAEventType;
        isAbstract?: boolean;
    }): UAEventType;

    /**
     *
     */

    addMethod(parent: UAObject | UAObjectType, options: AddMethodOptions): UAMethod;

    toNodeset2XML(): string;

    // --- Alarms & Conditions -------------------------------------------------
    instantiateCondition(
      conditionTypeId: UAEventType | NodeId | string, options: any, data?: any
    ): UAConditionBase;

    instantiateAcknowledgeableCondition(
      conditionTypeId: UAEventType | NodeId | string, options: any, data?: any
    ): UAAcknowledgeableConditionBase;

    instantiateAlarmCondition(
      alarmConditionTypeId: UAEventType | NodeId | string, options: any, data?: any
    ): UAAlarmConditionBase;

    instantiateLimitAlarm(
      limitAlarmTypeId: UAEventType | NodeId | string, options: any, data?: any
    ): UALimitAlarm;

    instantiateExclusiveLimitAlarm(
      exclusiveLimitAlarmTypeId: UAEventType | NodeId | string, options: any, data?: any
    ): UAExclusiveLimitAlarm;

    instantiateExclusiveDeviationAlarm(
      options: any, data?: any
    ): UAExclusiveDeviationAlarm;

    instantiateNonExclusiveLimitAlarm(
      nonExclusiveLimitAlarmTypeId: UAEventType | NodeId | string, options: any, data?: any
    ): UANonExclusiveLimitAlarm;

    instantiateNonExclusiveDeviationAlarm(
      options: any, data?: any
    ): UANonExclusiveDeviationAlarm;

    instantiateDiscreteAlarm(
      discreteAlarmType: UAEventType | NodeId | string, options: any, data?: any
    ): UADiscreteAlarm;

    instantiateOffNormalAlarm(
      options: any, data?: any
    ): UAOffNormalAlarm;

    /**
     * @internal
     */
    _createNode(options: CreateNodeOptions): BaseNode;

    /**
     * @internals
     */
    getStandardsNodeIds(): {
        referenceTypeIds: { [key: string]: string },
        objectTypeIds: { [key: string]: string }
    };
}

// tslint:disable:no-empty-interface
export interface Folder extends UAObject {
}

export type FolderType = UAObjectType;

export interface TypesFolder extends Folder {
    dataTypes: Folder;
    eventTypes: Folder;
    objectTypes: Folder;
    referenceTypes: Folder;
    variableTypes: Folder;
}

export interface BuildInfo1 extends UAVariable {
    productUri: UAVariableT<UAString>;
    manufacturerName: UAVariableT<UAString>;
    productName: UAVariableT<UAString>;
    softwareVersion: UAVariableT<UAString>;
    buildNumber: UAVariableT<UAString>;
    buildDate: UAVariableT<DateTime>;
    $extensionObject: BuildInfo;
}

export interface UAServerStatus extends UAVariable {
    startTime: UAVariableT<DataType.DateTime>;
    currentTime: UAVariableT<DataType.DateTime>;
    state: UAVariableT<ServerState>; // Enumeration
    secondsTillShutdown: UAVariableT<DataType.UInt32>;
    shutdownReason: UAVariableT<DataType.LocalizedText>;
    buildInfo: BuildInfo1;

    $extensionObject: ServerStatusDataType;
}

export interface UASessionDiagnostics extends UAVariable {
    $extensionObject: SessionDiagnosticsDataType;
}

export interface UAServerDiagnosticsSummary extends UAVariable {
    $extensionObject: ServerDiagnosticsSummaryDataType;
}

export interface UASessionDiagnosticsSummary extends UAObject {
    sessionDiagnosticsArray: UADynamicVariableArray<SessionDiagnosticsDataType>;
}

export interface UAServerDiagnostics extends UAObject {
    sessionsDiagnosticsSummary: UASessionDiagnosticsSummary;

    bindExtensionObject(obj: UAServerDiagnosticsSummary): UAServerDiagnosticsSummary;
}

export interface UAFileType extends UAObject {

    // methods
    open: UAMethod;
    close: UAMethod;
    read: UAMethod;
    write: UAMethod;
    getPosition: UAMethod;
    setPosition: UAMethod;

    // properties
    openCount: UAVariableT<UInt16>;
    size: UAVariableT<UInt64>;
    userWritable: UAVariableT<UABoolean>;
    writable: UAVariableT<UABoolean>;
    mimeType: UAVariableT<UAString>;

}
export interface UAAddressSpaceFileType extends UAFileType {

    exportNamespace?: UAMethod;
}
/**
 * The Trust List file is a UA Binary encoded stream containing an instance of
 * TrustListDataType
 */
export interface UATrustList extends UAFileType  {

    // methods
    addCertificate: UAMethod;
    closeAndUpdate: UAMethod;
    openWithMask: UAMethod;
    removeCertificate: UAMethod;

    // properties

    /**
     * The LastUpdateTime indicates when the Trust List was last updated via Trust List Object
     * Methods. This can be used to determine if a device has an up to date Trust List or to detect
     * unexpected modifications. Out of band changes are not necessarily reported by this value.
     */
    lastUpdateTime: UAVariableT<UtcTime>; // mandatory

    /**
     * The UpdateFrequency Property specifies how often the Trust List needs to be checked for
     * changes. When the CertificateManager specifies this value, all Clients that read a copy of the
     * Trust List should connect to the CertificateManager and check for updates to the Trust List
     * within 2 times the UpdateFrequency. If the Trust List Object is contained within a
     * ServerConfiguration Object then this value specifies how frequently the Server expects the
     * Trust List to be updated.
     */
    updateFrequency?: UAVariableT<Duration>; // optional

    // event
    // If auditing is supported, the CertificateManager shall generate the
    // TrustListUpdatedAuditEventType if the CloseAndUpdate, AddCertificate or
    // RemoveCertificate Methods are called.

}

export interface UACertificateGroup extends UAObject {
    /**
     * The CertificateTypes Property specifies the NodeIds of the CertificateTypes which may be
     * assigned to Applications which belong to the Certificate Group. For example, a Certificate
     * Group with the NodeId of RsaMinApplicationCertificateType (see 7.5.15) and the NodeId
     * RsaSha256ApplicationCertificate (see 7.5.16) specified allows an Application to have one
     * Application Instance Certificates for each type. Abstract base types may be used in this value
     * and indicate that any subtype is allowed. If this list is empty then the Certificate Group does
     * not allow Certificates to be assigned to Applications (i.e. the Certificate Group exists to allow
     * the associated Trust List to be read or updated). All CertificateTypes for a given Certificate
     * Group shall be subtypes of a single common type which shall be either
     * ApplicationCertificateType or HttpsCertificateType
     */
    certificateTypes: UAVariableT<NodeId[]>;

    /**
     * The TrustList Object is the Trust List associated with the Certificate Group.
     */
    trustList: UATrustList;

    // events
    /**
     * The CertificateExpired Object is an Alarm which is raised when the Certificate associated with
     * the CertificateGroup is about to expire. The CertificateExpirationAlarmType is defined in
     * Part 9
     */
    certificateExpired?: UACertificateExpirationAlarmType;

    /**
     * The TrustListOutOfDate Object is an Alarm which is raised when the Trust List has not been
     * updated within the period specified by the UpdateFrequency (see 7.5.2). The
     * TrustListOutOfDateAlarmType is defined in 7.5.9.
     */
    trustListOutOfDate?: UATrustListOutOfDateAlarmType;

}

export interface UACertificateExpirationAlarmType extends UAEventType {

}

/**
 * This event is raised when a Trust List is changed.
 * This is the result of a CloseAndUpdate Method on a TrustListType Object being called.
 * It shall also be raised when the AddCertificate or RemoveCertificate Method causes an
 * update to the Trust List.
 */
export interface UATrustListOutOfDateAlarmType extends UAEventType {

}
export interface UACertificateGroupFolder extends Folder {

    /**
     * The DefaultApplicationGroup Object represents the default Certificate Group for Applications.
     * It is used to access the default Application Trust List and to define the CertificateTypes
     * allowed for the ApplicationInstanceCertificate. This Object shall specify the
     * ApplicationCertificateType NodeId as a single entry in the CertificateTypes list or
     * it shall specify one or more subtypes of ApplicationCertificateType
     */
    defaultApplicationGroup: UACertificateGroup;

    /**
     * The DefaultHttpsGroup Object represents the default Certificate Group for HTTPS
     * communication. It is used to access the default HTTPS Trust List and to define the
     * CertificateTypes allowed for the HTTPS Certificate. This Object shall specify the
     * HttpsCertificateType NodeId as a single entry in the CertificateTypes list or it
     * shall specify one or more subtypes of HttpsCertificateType
     */
    defaultHttpsGroup?: UACertificateGroup;

    /**
     * This DefaultUserTokenGroup Object represents the default Certificate Group for validating
     * user credentials. It is used to access the default user credential Trust List and to define the
     * CertificateTypes allowed for user credentials Certificate. This Object shall leave
     * CertificateTypes list empty
     */
    defaultUserTokenGroup?: UACertificateGroup;

    // <AdditionalGroup>

}

export interface UAKeyCredentialConfigurationFolder extends Folder {

}
export interface UAUserTokenPolicy {

}

export interface UAAuthorizationService extends UAObject {
    // found in authorizationServices

    /**
     * The ServiceUri is a globally unique identifier that allows a Client to correlate an instance of
     * AuthorizationServiceType with instances of AuthorizationServiceConfigurationType (see
     */
    serviceUri: UAVariableT<UAString>;

    /**
     * The ServiceCertificate is the complete chain of Certificates needed to validate the AccessTokens
     */
    serviceCertificate: UAVariableT<ByteString>;

    /**
     * The GetServiceDescription Method is used read the metadata needed to request AccessTokens
     */
    getServiceDescription: UAMethod;

    /**
     * The UserTokenPolicies Property specifies the UserIdentityTokens which are accepted by the
     * RequestAccessToken Method
     */
    userTokenPolicy?: UAVariableT<UAUserTokenPolicy[]>;

    /**
     * The RequestAccessToken Method is used to request an Access Token from the Authorization Service
     */
    requestAccessToken?: UAMethod;
}

export interface UAAutorizationServicesFolder extends Folder {

}

// partial UAServerConfiguration related to authorization service
export interface UAServerConfiguration extends UAObject {
    // This Object is an instance of FolderType. It contains The AuthorizationService Objects which
    // may be accessed via the GDS. It is the target of an Organizes reference from the Objects
    // Folder
    authorizationServices: UAAutorizationServicesFolder;
}

// partial UAServerConfiguration related to KeyCredential management
export interface UAServerConfiguration extends UAObject {
    keyCredentialConfiguration: UAKeyCredentialConfigurationFolder;
}

// partial UAServerConfiguration related to certificate management
/**
 * If a Server supports Push Certificate Management it is required to support an information model
 * as part of its address space. It shall support the ServerConfiguration Object shown here.
 * This Object shall only be visible and accessible to administrators and/or the GDS.
 */
export interface UAServerConfiguration extends UAObject {

    /**
     * The ApplyChanges Method is used to apply any security related changes if the Server sets
     * the applyChangesRequired flag when another Method is called. Servers should minimize the
     * impact of applying the new configuration, however, it could require that all existing Sessions
     * be closed and re-opened by the Clients.
     */
    applyChanges?: UAMethod;

    /**
     * The CreateSigningRequest Method asks the Server to create a PKCS #10 encoded Certificate
     * Request that is signed with the Server’s private key.
     */
    createSigningRequest: UAMethod;
    /**
     * The GetRejectedList Method returns the list of Certificates which have been rejected by the
     * Server. It can be used to track activity or allow administrators to move a rejected Certificate
     * into the Trust List
     */
    getRejectedList: UAMethod;

    /**
     * The UpdateCertificate Method is used to update a Certificate.
     */
    updateCertificate: UAMethod;

    /**
     * ( OPCUA Specification part#12 GDS)
     * The CertificateGroups Object organizes the Certificate Groups supported by the Server.
     * Servers shall support the DefaultApplicationGroup and may support the DefaultHttpsGroup
     * or the DefaultUserTokenGroup. Servers may support additional Certificate Groups depending
     * on their requirements. For example, a Server with two network interfaces should have a
     * different Trust List for each interface. The second Trust List would be represented
     * as a new CertificateGroupType Object organized by CertificateGroups Folder.
     */
    certificateGroups: UACertificateGroupFolder;

    /**
     * The MaxTrustListSize is the maximum size of the Trust List in bytes. 0 means no limit.
     * The default is 65 535 bytes.
     */
    maxTrustListSize: UAVariableT<UInt32>;

    /**
     * If MulticastDnsEnabled is TRUE then the Server announces itself using multicast DNS. It can
     * be changed by writing to the Variable.
     */
    multicastDnsEnabled: UAVariableT<UABoolean>;

    /**
     * The ServerCapabilities Property specifies the capabilities from Annex D which the Server
     * supports. The value is the same as the value  reported to the LocalDiscoveryServer when the
     * Server calls the RegisterServer2 Service
     */
    serverCapabilities: UAVariableT<UAString[]>;

    /**
     * The SupportedPrivateKeyFormats specifies the PrivateKey formats supported by the Server.
     * Possible values include “PEM” (see RFC 5958) or “PFX” (see PKCS #12). The array is empty
     * if the Server does not allow external Clients to update the PrivateKey
     */
    supportedPrivateKeyFormats: UAVariableT<UAString[]>;
}

export interface UADirectoryType  {

}
/**
 *
 */
export interface UACertificateDirectoryType extends UADirectoryType {

    /**
     * The CertificateGroups Object organizes the Certificate Groups supported by the
     * CertificateManager. It is described in 7.5.17. CertificateManagers shall support the
     * DefaultApplicationGroup and may support the DefaultHttpsGroup or the
     * DefaultUserTokenGroup. CertificateManagers may support additional Certificate Groups
     * depending on their requirements. For example, a CertificateManager with multiple Certificate
     * Authorities would represent each as a CertificateGroupType Object organized by
     * CertificateGroups Folder. Clients could then request Certificates issued by a specific CA by
     * passing the appropriate NodeId to the StartSigningRequest or StartNewKeyPairRequest
     * Methods.
     */
    certificateGroups: Folder;

    /**
     * The StartSigningRequest Method is used to request a new a Certificate that is signed by a CA
     * managed by the CertificateManager. This Method is recommended when the caller already
     * has a private key.
     */
    startSigningRequest: UAMethod;

    /**
     * The StartNewKeyPairRequest Method is used to request a new Certificate that is signed by a
     * CA managed by the CertificateManager along with a new private key. This Method is used
     * only when the caller does not have a private key and cannot generate one.
     */
    startNewKeyPairRequest: UAMethod;

    /**
     * The FinishRequest Method is used to check that a Certificate request has been approved by
     * the CertificateManager Administrator. If successful the Certificate and Private Key (if
     * requested) are returned.
     */
    finishRequest: UAMethod;

    /**
     * The GetCertificateGroups Method returns a list of NodeIds for CertificateGroupType Objects
     * that can be used to request Certificates or Trust Lists for an Application.
     */
    getCertificateGroups: UAMethod;
    /**
     * The GetTrustList Method returns a NodeId of a TrustListType Object that can be used to read
     * a Trust List for an Application.
     */
    getTrustList: UAMethod;
    /**
     * The GetCertificateStatus Method checks whether the Application needs to update its
     * Certificate.
     */
    getCertificateStatus: UAMethod;
}

export interface Server extends UAObject {
    serverStatus: UAServerStatus;
    auditing: UAVariable;
    currentTimeZone: UAVariable;
    estimatedReturnTime: UAVariable;
    namespaceArray: UAVariable;
    namespaces: UAObject;
    serverCapabilities: UAObject;
    serverConfiguration: UAServerConfiguration;
    vendorServerInfo: UAObject;
    getMonitoredItems: UAMethod;
    serverDiagnostics: UAServerDiagnostics;
}

export interface ObjectsFolder extends Folder {
    server: Server;

}

export interface RootFolder extends Folder {
    objects: ObjectsFolder;
    types: Folder;
    views: Folder;
}

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

export interface EventData {
    /**
     * the event type node
     */
    $eventDataSource?: BaseNode;
    /**
     *
     */
    eventId: NodeId;
}

export interface AddressSpace {

    rootFolder: RootFolder;

    historizingNodes?: any;

    findNode(node: NodeIdLike): BaseNode | null;

    /**
     *
     * @example
     *
     * ```javascript
     *     const variableType = addressSpace.findVariableType("ns=0;i=62");
     *     variableType.browseName.toString().should.eql("BaseVariableType");
     *
     *     const variableType = addressSpace.findVariableType("BaseVariableType");
     *     variableType.browseName.toString().should.eql("BaseVariableType");
     *
     *     const variableType = addressSpace.findVariableType(resolveNodeId("ns=0;i=62"));
     *     variableType.browseName.toString().should.eql("BaseVariableType");
     * ```
     */
    findVariableType(variableTypeId: NodeIdLike, namespaceIndex?: number): UAVariableType | null;

    findMethod(nodeId: NodeIdLike): UAMethod | null;

    /**
     * find an EventType node in the address space
     *
     * @param objectTypeId the eventType to find
     * @param namespaceIndex an optional index to restrict the search in a given namespace
     * @return the EventType found or null.
     *
     * notes:
     *
     *    - if objectTypeId is of type NodeId, the namespaceIndex shall not be specified
     * @example
     *
     * ```ts
     *     const objectType = addressSpace.findObjectType("ns=0;i=58");
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType("BaseObjectType");
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType(resolveNodeId("ns=0;i=58"));
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType("CustomObjectType",36);
     *     objectType.nodeId.namespace.should.eql(36);
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType("36:CustomObjectType");
     *     objectType.nodeId.namespace.should.eql(36);
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     * ```
     */
    findObjectType(objectTypeId: NodeIdLike, namespaceIndex?: number): UAObjectType | null;

    /**
     * find an EventType node in the address space
     *
     * @param eventTypeId the eventType to find
     * @param namespaceIndex an optional index to restrict the search in a given namespace
     * @return the EventType found or null.
     *
     * note:
     *    - the method with throw an exception if a node is found
     *      that is not a BaseEventType or a subtype of it.
     *    - if eventTypeId is of type NodeId, the namespaceIndex shall not be specified
     *
     * @example
     *
     * ```javascript
     *  const evtType = addressSpace.findEventType("AuditEventType");
     *  ```
     *
     */
    findEventType(
      eventTypeId: NodeIdLike | UAObjectType,
      namespaceIndex?: number
    ): UAObjectType | null;

    findReferenceType(
      referenceTypeId: NodeIdLike | UAReferenceType,
      namespaceIndex?: number
    ): UAReferenceType | null;

    /**
     * find a ReferenceType by its inverse name.
     * @param inverseName the inverse name of the ReferenceType to find
     */
    findReferenceTypeFromInverseName(inverseName: string): UAReferenceType | null;

    findDataType(
      dataType: string | NodeId | UADataType | DataType,
      namespaceIndex?: number
    ): UADataType | null;

    findCorrespondingBasicDataType(dataType: NodeIdLike | UADataType): DataType;

    deleteNode(node: NodeId | BaseNode): void;

    getDefaultNamespace(): Namespace;

    getOwnNamespace(): Namespace;

    getNamespace(indexOrName: number | string): Namespace;

    registerNamespace(namespaceUri: string): Namespace;

    getNamespaceIndex(namespaceUri: string): number;

    getNamespaceUri(namespaceIndex: number): string;

    getNamespaceArray(): Namespace[];

    browseSingleNode(
      nodeId: NodeIdLike,
      browseDescription: BrowseDescription,
      context?: SessionContext
    ): BrowseResult;

    browsePath(browsePath: BrowsePath): BrowsePathResult;

    inverseReferenceType(referenceType: string): string;

    // -------------- Extension Objects
    constructExtensionObject(dataType: UADataType | NodeId, options?: any): ExtensionObject;

    // -------------- Event helpers

    /***
     * construct a simple javascript object with all the default properties of the event
     *
     * @return result.$eventDataSource  the event type node
     * @return result.eventId the
     * ...
     *
     *
     * eventTypeId can be a UAObjectType deriving from EventType
     * or an instance of a ConditionType
     *
     */
    constructEventData(eventTypeId: UAEventType, data: any): EventData;

    /**
     * walk up the hierarchy of objects until a view is found
     * objects may belong to multiples views.
     * Note: this method doesn't return the main view => Server object.
     * @param node
     * @internal
     */
    extractRootViews(node: UAObject | UAVariable): UAView[];

    // -------------- Historizing support
    installHistoricalDataNode(
      variableNode: UAVariable,
      options?: IHistoricalDataNodeOptions
    ): void;

    shutdown(): void;

    dispose(): void;

    installAlarmsAndConditionsService(): void;

    normalizeReferenceType(
      params: AddReferenceOpts | Reference
    ): Reference;

    /**
     * EventId is generated by the Server to uniquely identify a particular Event Notification.
     */
    generateEventId(): VariantT<DataType.ByteString>;

}

import { AddressSpace as AddressSpaceImpl } from "../src/address_space";
import { UAOffNormalAlarm } from "../src/alarms_and_conditions/ua_off_normal_alarm";
import { UATwoStateDiscrete } from "./interfaces/data_access/ua_two_state_discrete";

export class AddressSpace {
    public static historizerFactory: any;

    public static create(): AddressSpace {
        return new AddressSpaceImpl() as AddressSpace;
    }

    private constructor() { /* empty */
    }
}

export type IHistoricalDataNodeOptions =
  IVariableHistorianOptions |
  { historian: IVariableHistorian };

export { generateAddressSpace } from "./loader/load_nodeset2";

export declare class VariableHistorian implements IVariableHistorian {

    public constructor(node: UAVariable, options: IVariableHistorianOptions);

    /**
     * push a new value into the history for this variable
     * the method should take a very small amount of time and not
     * directly write to the underlying database
     * @param newDataValue
     */
    public push(newDataValue: DataValue): Promise<void>;

    /**
     * Extract a series of dataValue from the History database for this value
     * @param historyReadRawModifiedDetails
     * @param maxNumberToExtract
     * @param isReversed
     * @param reverseDataValue
     * @param callback
     */
    public extractDataValues(
      historyReadRawModifiedDetails: ReadRawModifiedDetails,
      maxNumberToExtract: number,
      isReversed: boolean,
      reverseDataValue: boolean,
      callback: (err: Error | null, dataValue?: DataValue[]) => void
    ): void;

}

export interface VariantT<T> extends Variant {
}

export interface DataValueT<T> extends DataValue {
}

export interface UAVariableT<T> extends UAVariable {

    readValue(
      context?: SessionContext,
      indexRange?: NumericRange,
      dataEncoding?: QualifiedNameLike | null
    ): DataValueT<T>;

    writeValue(
      context: SessionContext,
      dataValue: DataValueT<T>,
      indexRange: NumericRange | null,
      callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void;

    writeValue(
      context: SessionContext,
      dataValue: DataValueT<T>,
      callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void;

    writeValue(
      context: SessionContext,
      dataValue: DataValueT<T>,
      indexRange?: NumericRange | null
    ): Promise<StatusCode>;

}

export interface UAVariableTypeT<T> extends UAVariableType {
}

export interface Property<T> extends UAVariableT<T> {
}

export interface UAAggregateConfiguration extends UAObject {
    treatUncertainAsBad: UAVariableT<DataType.Boolean>;
    percentDataBad: UAVariableT<DataType.Byte>;
    percentDataGood: UAVariableT<DataType.Byte>;
}

export interface HistoricalDataConfiguration extends UAObject {
    startOfArchive: UAVariableT<DataType.DateTime>;
    startOfOnlineArchive: UAVariableT<DataType.DateTime>;
    stepped: UAVariableT<DataType.Boolean>;
    maxTimeInterval: UAVariableT<"Duration">;
    minTimeInterval: UAVariableT<"Duration">;
    aggregateConfiguration: UAAggregateConfiguration;
}

export interface Namespace {
    addState(
      component: StateMachine | StateMachineType,
      stateName: string,
      stateNumber: number,
      isInitialState?: boolean
    ): State;

    addTransition(
      component: StateMachine | StateMachineType,
      fromState: string,
      toState: string,
      transitionNumber: number
    ): Transition;
}

export type UAClonable = UAObject | UAVariable | UAMethod;

export interface ConditionType extends UAObjectType {
    disable: UAMethod;
    enable: UAMethod;
    conditionRefresh: UAMethod;
    conditionRefresh2: UAMethod;
    addComment: UAMethod;
}

export interface Enumeration extends UAVariable {

}

// {{ Dynamic Array Variable
export interface UADynamicVariableArray<T extends ExtensionObject> extends UAVariable {
    $$variableType: UAVariableType;
    $$dataType: UADataType;
    $$extensionObjectArray: T[];
    $$getElementBrowseName: (obj: T) => QualifiedName;
    $$indexPropertyName: string;
}

export declare function prepareDataType(dataType: UADataType): void;

export declare function createExtObjArrayNode<T extends ExtensionObject>(
  parentFolder: UAObject,
  options: any
): UADynamicVariableArray<T>;

export declare function bindExtObjArrayNode<T extends ExtensionObject>(
  uaArrayVariableNode: UADynamicVariableArray<T>,
  variableTypeNodeId: string | NodeId,
  indexPropertyName: string
): UAVariable;

export declare function addElement<T extends ExtensionObject>(
  options: any /* ExtensionObjectConstructor | ExtensionObject | UAVariable*/,
  uaArrayVariableNode: UADynamicVariableArray<T>
): UAVariable;

export declare function removeElement<T extends ExtensionObject>(
  uaArrayVariableNode: UADynamicVariableArray<T>,
  element: any /* number | UAVariable | (a any) => boolean | ExtensionObject */
): void;

// }}

export declare function dumpXml(
  node: BaseNode,
  options: any
): string;
