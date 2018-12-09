// tslint:disable:max-classes-per-file

import { UInt32 } from "node-opcua-basic-types";
import {
    AccessLevelFlag,
    AttributeIds,
    LocalizedText, LocalizedTextLike,
    NodeClass,
    QualifiedName, QualifiedNameLike
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import {
    BrowseDescription,
    BrowseResult
} from "node-opcua-service-browse";
import {
    WriteValueOptions
} from "node-opcua-service-write";
import { StatusCode } from "node-opcua-status-code";
import { DataType, Variant, VariantLike } from "node-opcua-variant";
import { SessionContext } from "./session_context";

type ErrorCallback = (err?: Error) => void;

export declare interface AddReferenceOpts {
    referenceType: string | NodeId;
    nodeId: NodeId | string;
    isForward: boolean;
}

export declare class UAReference {
}

export interface ISessionContext {

    getCurrentUserRole(): string;

    checkPermission(
      node: BaseNode,
      action: AccessLevelFlag | string
    ): boolean;

}

export declare class BaseNode {

    public browseName: QualifiedName;
    public description: LocalizedText;
    public nodeClass: NodeClass;
    public nodeId: NodeId;

    public addReference(options: AddReferenceOpts): UAReference;

    public readAttribute(
      context: ISessionContext | null,
      attributeId: AttributeIds,
      indexRange?: NumericRange,
      dataEncoding?: any
    ): DataValue;

    [key: string]: any;
}

export declare class UAView extends BaseNode {
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

export declare class UAVariable extends BaseNode {

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
      dataEncoding?: string
    ): DataValue;

    public readEnumValue(): EnumValue2;

    public writeEnumValue(value: string | number): void;

    public readAttribute(
      context: SessionContext,
      attributeId: AttributeIds,
      indexRange?: NumericRange,
      dataEncoding?: string
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

    public WriteAttribute(
      context: SessionContext,
      writeValue: WriteValueOptions,
      callback: ErrorCallback
    ): void;

    // advanced
    public touchValue(updateNow?: boolean): void;

    public setPermissions(permissions: Permissions): void;

    public bindVariable(
      options: BindVariableOptions,
      overwrite?: boolean
    ): void;

    // ----------------- Event handlers

    public on(eventName: "semantic_changed", eventHandler: () => void): void;
    public on(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): void;
    public once(eventName: "semantic_changed", eventHandler: () => void): void;
    public once(eventName: "value_changed", eventHandler: (dataValue: DataValue) => void): void;

}

export declare class UAAnalogItem extends UAVariable {
}

export declare class UAObject extends BaseNode {

}

export declare class UAMethod extends BaseNode {

}

export declare class UADataType extends BaseNode {

}

export declare class UAObjectType extends BaseNode {

}

export declare class UAVariableType extends BaseNode {

}

export declare class UAReferenceType extends BaseNode {

}

export interface AddAnalogDataItemOptions extends AddBaseNodeOptions {
    /** @example  "(tempA -25) + tempB" */
    definition: string;
    /** @example 0.5 */
    valuePrecision: number;
    engineeringUnitsRange: {
        low: number;
        high: number;
    };
    instrumentRange: {
        low: number;
        high: number;
    };
    engineeringUnits: EUEngineeringUnit;
}

export enum EUEngineeringUnit {
    degree_celsius
    // to be continued
}

export interface AddBaseNodeOptions {

    browseName: QualifiedNameLike;

    nodeId?: NodeIdLike;

    displayName?: string | LocalizedTextLike | LocalizedTextLike[];
    description?: string;

    organizedBy?: NodeId | BaseNode;
    componentOf?: NodeId | BaseNode;
    propertyOf?: NodeId | BaseNode;
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
    subtypeOf?: string | UAVariableType;
    postInstantiateFunc?: (node: UAVariableType) => void;
    value?: VariantLike;
}


export interface AddVariableOptions extends AddBaseNodeOptions, VariableStuff {
    /**
     * permissions
     */
    permissions?: Permissions;
    value?: VariantLike | BindVariableOptions;
}

export interface AddObjectTypeOptions extends AddBaseNodeOptions {
    isAbstract?: boolean;
    subtypeOf: string | UAObjectType;
    eventNotifier?: number;
    postInstantiateFunc?: (node: UAObjectType) => void;
}

export type AddObjectOptions = any;
export type AddReferenceTypeOptions = any;
export type CreateDataTypeOptions = any;
export type CreateNodeOptions = any;

export declare interface Namespace {
    namespaceUri: string;
    addressSpace: AddressSpace;
    index: number;

    findObjectType(objectType: string): UAObjectType;

    findVariableType(variableType: string): UAVariableType;

    findDataType(dataType: string): UADataType;

    findReferenceType(referenceType: string): UAReferenceType;

    findReferenceTypeFromInverseName(referenceType: string): UAReferenceType;

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

    deleteNode(node: NodeId | BaseNode): void;

    addAnalogDataItem(options: AddAnalogDataItemOptions): UAAnalogItem;

///
    toNodeset2XML(): string;
}

// tslint:disable:no-empty-interface
export interface Folder extends UAObject {
}

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
}

export interface ObjectsFolder extends Folder {
    server: Server;

}

export interface RootFolder extends Folder {
    objects: ObjectsFolder;
    types: Folder;
    views: Folder;
}

export declare class AddressSpace {

    public rootFolder: RootFolder;

    public findNode(node: NodeIdLike): BaseNode;

    public findMethod(nodeId: NodeIdLike): UAMethod;

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

}
