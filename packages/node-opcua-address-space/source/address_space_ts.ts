// tslint:disable:max-classes-per-file
/**
 * @module node-opcua-address-space
 */
import { DateTime, UInt32 } from "node-opcua-basic-types";
import {
    AccessLevelFlag,
    AttributeIds, BrowseDirection,
    LocalizedText, LocalizedTextLike,
    NodeClass,
    QualifiedName, QualifiedNameLike
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import {
    BrowseDescription,
    BrowseDescriptionOptions,
    BrowseResult
} from "node-opcua-service-browse";
import {
    HistoryReadDetails,
    HistoryReadResult,
    ReadRawModifiedDetails
} from "node-opcua-service-history";
import {
    WriteValueOptions
} from "node-opcua-service-write";
import { StatusCode } from "node-opcua-status-code";
import { Argument, ArgumentOptions } from "node-opcua-types";
import { Variant, VariantArrayType, VariantLike } from "node-opcua-variant";
import { SessionContext } from "./session_context";
import { State, StateMachine, Transition } from "./state_machine";

export type ErrorCallback = (err?: Error) => void;

export declare interface AddReferenceOpts {
    referenceType: string | NodeId;
    nodeId: NodeId | string | BaseNode;
    /**
     * default = true
     */
    isForward?: boolean;
}

export interface  UAReference {
    readonly nodeId: NodeId;
    readonly referenceType: NodeId;
    readonly isForward: boolean ;
    readonly node: BaseNode;
}

export interface ISessionContext {

    getCurrentUserRole(): string;

    checkPermission(
      node: BaseNode,
      action: AccessLevelFlag | string
    ): boolean;

}

export declare class BaseNode {

    public readonly browseName: QualifiedName;
    public readonly description: LocalizedText;
    public readonly nodeClass: NodeClass;
    public readonly nodeId: NodeId;
    public readonly modellingRule?: string;
    public readonly parent?: BaseNode;

    public addReference(options: AddReferenceOpts): UAReference;

    public readAttribute(
      context: SessionContext,
      attributeId: AttributeIds,
      indexRange?: NumericRange,
      dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    // [key: string]: BaseNode;
    public getComponentByName(componentName: QualifiedNameLike): BaseNode;

    public install_extra_properties(): void;

    public findReferencesExAsObject(
      strReference: string,
      browseDirection: BrowseDirection
    ): UAReference[];

    public findReferencesAsObject(
      strReference: string,
      isForward: boolean
    ): UAReferenceType[];

}

export declare class UAView extends BaseNode {
    public readonly nodeClass: NodeClass.View;

}

export interface EnumValue2 {
    name: string;
    value: number;
}

type VariableSetterVariation1 = (value: Variant) => StatusCode;
type VariableSetterVariation2 = (
  value: Variant,
  callback: (err: Error | null, statusCode: StatusCode) => void) => void;

type VariableSetter = VariableSetterVariation1
  | VariableSetterVariation2;

interface BindVariableOptionsVariation1 {
    get: () => Variant;
    set?: VariableSetter;
}

type VariableDataValueGetterSync =
  () => DataValue;
type VariableDataValueGetterWithCallback =
  (err: Error | null, dataValue: DataValue) => void;

type VariableDataValueSetterWithCallback = (
  dataValue: DataValue,
  callback: (err: Error | null, statusCode: StatusCode) => void) => void;

interface BindVariableOptionsVariation2 {
    timestamped_get: VariableDataValueGetterSync | VariableDataValueGetterWithCallback;
    timestamped_set?: VariableDataValueSetterWithCallback;
}

interface BindVariableOptionsVariation3 {
    refreshFunc: (
      callback: (err: Error | null, dataValue: DataValue) => void
    ) => void;
}

type BindVariableOptions =
  BindVariableOptionsVariation1 |
  BindVariableOptionsVariation2 |
  BindVariableOptionsVariation3 ;

export type ContinuationPoint = Buffer;
export type Callback<T> = (err: Error | null, result?: T) => void;

export declare class UAVariable extends BaseNode {

    public typeDefinitionObj: UAVariableType;

    public isReadable(context: SessionContext): boolean;

    public isUserReadable(context: SessionContext): boolean;

    public isWritable(context: SessionContext): boolean;

    public isUserWritable(context: SessionContext): boolean;

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
    public readValue(
      context?: SessionContext,
      indexRange?: NumericRange,
      dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    public readEnumValue(): EnumValue2;

    public writeEnumValue(value: string | number): void;

    public readAttribute(
      context: SessionContext,
      attributeId: AttributeIds,
      indexRange?: NumericRange,
      dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    public setValueFromSource(
      value: VariantLike,
      statusCode?: StatusCode,
      sourceTimestamp?: Date
    ): void;

    public writeValue(
      context: SessionContext,
      dataValue: DataValue,
      indexRange: NumericRange,
      callback: ErrorCallback
    ): void;
    public writeValue(
      context: SessionContext,
      dataValue: DataValue,
      indexRange: NumericRange
    ): Promise<void>;

    public WriteAttribute(
      context: SessionContext,
      writeValue: WriteValueOptions,
      callback: ErrorCallback
    ): void;
    public WriteAttribute(
      context: SessionContext,
      writeValue: WriteValueOptions
    ): Promise<void>;

    // advanced
    public touchValue(updateNow?: boolean): void;

    public setPermissions(permissions: Permissions): void;

    public bindVariable(
      options: BindVariableOptions,
      overwrite?: boolean
    ): void;

    public historyRead(
      context: SessionContext,
      historyReadDetails: HistoryReadDetails,
      indexRange?: NumericRange | null,
      dataEncoding?: QualifiedNameLike | null,
      continuationPoint?: ContinuationPoint
    ): Promise<HistoryReadResult>;
    public historyRead(
      context: SessionContext,
      historyReadDetails: HistoryReadDetails,
      indexRange: NumericRange | null | undefined,
      dataEncoding: QualifiedNameLike | null | undefined,
      continuationPoint: ContinuationPoint | null | undefined,
      callback: Callback<HistoryReadResult>
    ): void;

    // ----------------- Event handlers

    public on(eventName: "semantic_changed", eventHandler: () => void): void;
    public on(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): void;

    public once(eventName: "semantic_changed", eventHandler: () => void): void;
    public once(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): void;

}

export declare class UAAnalogItem extends UAVariable {
}

// tslint:disable:no-empty-interface
export interface UAEventType extends UAObjectType {

}

export type EventTypeLike = string | NodeId | UAEventType;

export interface PseudoVariantString {
    dataType: "String";
    value: string;
}

export interface PseudoVariantBoolean {
    dataType: "Boolean";
    value: boolean;
}

export interface PseudoVariantNodeId {
    dataType: "NodeId";
    value: NodeId;
}

export interface PseudoVariantDateTime {
    dataType: "DateTime";
    value: DateTime;
}

export interface PseudoVariantLocalizedText {
    dataType: "LocalizedText";
    value: LocalizedTextLike;
}

export interface PseudoVariantDuration {
    dataType: "Duration";
    value: number;
}

export interface PseudoVariantByteString {
    dataType: "ByteString";
    value: Buffer;
}

export interface PseudoVariantExtensionObject {
    dataType: "ExtensionObject";
    value: object;
}

export interface PseudoVariantExtensionObjectArray {
    dataType: "ExtensionObject";
    arrayType: VariantArrayType.Array;
    value: object[];
}

export type PseudoVariant =
  PseudoVariantString |
  PseudoVariantBoolean |
  PseudoVariantNodeId |
  PseudoVariantDateTime |
  PseudoVariantByteString |
  PseudoVariantDuration |
  PseudoVariantLocalizedText |
  PseudoVariantExtensionObject |
  PseudoVariantExtensionObjectArray
  ;

export interface RaiseEventData {
    [key: string]: PseudoVariant;
}

export interface EventRaiser {
    raiseEvent(eventType: EventTypeLike, eventData: RaiseEventData): void;
}

export declare class UAObject extends BaseNode implements EventRaiser {

    public readonly nodeClass: NodeClass.Object;
    public typeDefinitionObj: UAObjectType;

    public getMethodByName(methodName: string): UAMethod | null;

    public raiseEvent(eventType: EventTypeLike, eventData: RaiseEventData): void;
}

export interface CallMethodResponse {
    statusCode: StatusCode;
    outputArguments: Variant[];
}

export type MethodFunctorCallback = (err: Error | null, callMethodResponse: CallMethodResponse) => void;

export type MethodFunctor = (
  this: UAMethod,
  inputArguments: Variant[],
  context: SessionContext,
  callback: MethodFunctorCallback
) => void;

export declare class UAMethod extends BaseNode {

    public readonly nodeClass: NodeClass.Method;
    public readonly typeDefinitionObj: UAObjectType;
    public readonly parent?: UAObject;
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
      inputArguments: null | VariantLike[],
      context: SessionContext,
      callback: MethodFunctorCallback
    ): void;

    public execute(
      inputArguments: null | VariantLike[],
      context: SessionContext
    ): Promise<CallMethodResponse>;

    public clone(
      options: any,
      optionalFilter?: any,
      extraInfo?: any
    ): UAMethod;

}

export declare class UADataType extends BaseNode {
    public readonly nodeClass: NodeClass.DataType;
    public readonly subtypeOfObj: UADataType;

    public isSupertypeOf(referenceType: NodeIdLike | UADataType): boolean;
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
    modellingRule?: string;

}

export interface InstantiateVariableOptions extends InstantiateOptions {
    minimumSamplingInterval?: number;
    extensionObject?: any;
}

export declare class UAObjectType extends BaseNode {
    public readonly nodeClass: NodeClass.ObjectType;
    public readonly subtypeOfObj: UAObjectType;

    public instantiate(options: InstantiateOptions): UAObject;

    public isSupertypeOf(referenceType: NodeIdLike | UAObjectType): boolean;

    public getMethodByName(methodName: string): UAMethod | null;
}

export declare class UAVariableType extends BaseNode {
    public readonly nodeClass: NodeClass.VariableType;
    public readonly subtypeOfObj: UAVariableType;

    public instantiate(options: InstantiateVariableOptions): UAVariableType;

    public isSupertypeOf(referenceType: NodeIdLike | UAVariableType): boolean;

}

export declare class UAReferenceType extends BaseNode {
    public readonly nodeClass: NodeClass.ReferenceType;
    public readonly subtypeOfObj: UAReferenceType;

    public isSupertypeOf(referenceType: NodeIdLike | UAReferenceType): boolean;

}

export interface AddAnalogDataItemOptions extends AddBaseNodeOptions {
    /** @example  "(tempA -25) + tempB" */
    definition?: string;
    /** @example 0.5 */
    valuePrecision?: number;
    engineeringUnitsRange?: {
        low: number;
        high: number;
    };
    instrumentRange?: {
        low: number;
        high: number;
    };
    engineeringUnits?: EUEngineeringUnit;
    minimumSamplingInterval?: number;
    dataType?: string | NodeIdLike;

}

export enum EUEngineeringUnit {
    degree_celsius
    // to be continued
}

export type ModellingRuleType = "Mandatory" | "Optional";

export interface AddBaseNodeOptions {

    browseName: QualifiedNameLike;

    nodeId?: NodeIdLike;

    displayName?: string | LocalizedTextLike | LocalizedTextLike[];
    description?: string;

    organizedBy?: NodeId | BaseNode;
    componentOf?: NodeId | BaseNode;
    propertyOf?: NodeId | BaseNode;

    modellingRule?: ModellingRuleType;

}

export interface Permissions {
    CurrentRead?: string[];
    CurrentWrite?: string[];
    HistoryRead?: string[];
    HistoryWrite?: string[];
    StatusWrite?: string[];
    TimestampWrite?: string[];
}

// element common between AddVariableTypeOptions and AddVariableOptions
export interface VariableStuff {
    dataType?: string | NodeIdLike;
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
    accessLevel?: UInt32;

    /**
     * The UserAccessLevel Attribute is used to indicate how the Value of a Variable can be accessed
     * (read/write) and if it contains current or historic data taking user access rights into account.
     * The AccessLevelType is defined in 8.57.
     */
    userAccessLevel?: number;

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
    value?: VariantLike | BindVariableOptions;
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

export interface AddObjectOptions extends AddBaseNodeOptions {
    eventNotifier?: number;
    // default value is "BaseObjectType";
    typeDefinition?: string | NodeId | UAObjectType;
}

export type AddReferenceTypeOptions = any;
export type CreateDataTypeOptions = any;
export type CreateNodeOptions = any;

export declare interface Namespace {
    namespaceUri: string;
    addressSpace: AddressSpace;
    index: number;

    // -------------------------------------------------------------------------

    findObjectType(objectType: string): UAObjectType | null;

    findEventType(objectType: string): UAObjectType | null;

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

    createDataType(options: CreateDataTypeOptions): UADataType;

    addVariable(options: AddVariableOptions): UAVariable;

    addObject(options: AddObjectOptions): UAObject;

    addView(options: AddBaseNodeOptions): UAView;

    addFolder(parentFolder: UAObject, options: any): UAObject;

    createNode(options: CreateNodeOptions): BaseNode;

    // -------------------------------------------------------------------------

    deleteNode(node: NodeId | BaseNode): void;

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

    addMethod(parent: UAObject, options: {
        nodeId?: NodeIdLike;
        browseName: QualifiedNameLike;
        description?: LocalizedTextLike;
        inputArguments: ArgumentOptions[];
        outputArguments: ArgumentOptions[];
    }): UAMethod;

    toNodeset2XML(): string;
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

export interface Server extends UAObject {
    auditing: UAVariable;
    currentTimeZone: UAVariable;
    estimatedReturnTime: UAVariable;
    namespaceArray: UAVariable;
    namespaces: UAObject;
    serverCapabilities: UAObject;
    serverConfiguration: UAObject;
    vendorServerInfo: UAObject;
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
      callback: (err?: Error | null, dataValue?: DataValue[]) => void
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
}

export declare class AddressSpace {

    public static historizerFactory: any;

    public rootFolder: RootFolder;

    public findNode(node: NodeIdLike): BaseNode;

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
    public findVariableType(variableTypeId: NodeIdLike, namespaceIndex?: number): UAVariableType | null;

    public findMethod(nodeId: NodeIdLike): UAMethod | null;

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
    public findObjectType(objectTypeId: NodeIdLike, namespaceIndex?: number): UAObjectType | null;

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
    public findEventType(eventTypeId: NodeIdLike | UAObjectType, namespaceIndex?: number): UAObjectType | null;

    public findReferenceType(
      referenceTypeId: NodeIdLike | UAReferenceType, namespaceIndex?: number): UAReferenceType | null;

    public getDefaultNamespace(): Namespace;

    public getOwnNamespace(): Namespace;

    public getNamespace(indexOrName: number | string): Namespace;

    public registerNamespace(namespaceUri: string): Namespace;

    public getNamespaceIndex(namespaceUri: string): number;

    public getNamespaceUri(namespaceIndex: number): string;

    public getNamespaceArray(): Namespace[];

    public browseSingleNode(
      nodeId: NodeIdLike,
      browseDescription: BrowseDescription
    ): BrowseResult;

    // -------------- Event helpers

    /***
     * construct a simple javascript object with all the default properties of the event
     *
     * @return result.$eventDataSource {BaseNode} the event type node
     * @return result.eventId {NodeId} the
     * ...
     *
     *
     * eventTypeId can be a UAObjectType deriving from EventType
     * or an instance of a ConditionType
     *
     */
    public constructEventData(eventTypeId: UAEventType, data: any): {
        /**
         * the event type node
         */
        $eventDataSource: BaseNode;
        /**
         *
         */
        eventId: NodeId;
    };

    // -------------- Historizing support
    public installHistoricalDataNode(
      variableNode: UAVariable,
      options: IHistoricalDataNodeOptions
    ): void;

    public dispose(): void;

    public installAlarmsAndConditionsService(): void;
}

export interface IHistoricalDataNodeOptions {
    historian: IVariableHistorian;
}

export declare function generate_address_space(
  addressSpace: AddressSpace,
  xmlFiles: string | string[],
  callback: (err?: Error) => void
): void;

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
      callback: (err?: Error | null, dataValue?: DataValue[]) => void
    ): void;

}

// tslint:disable:max-classes-per-file
export interface AddressSpace {

    addState(
      component: StateMachine,
      stateName: string,
      stateNumber: number,
      isInitialState: boolean
    ): State;

    addTransition(
      component: StateMachine,
      fromState: State,
      toState: State,
      transitionNumber: number
    ): Transition;
}
