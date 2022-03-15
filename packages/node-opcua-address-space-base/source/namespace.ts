import { QualifiedNameLike, AccessRestrictionsFlag, LocalizedTextLike } from "node-opcua-data-model";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import {
    ArgumentOptions,
    AxisInformationOptions,
    AxisScaleEnumeration,
    EnumFieldOptions,
    EUInformation,
    EUInformationOptions,
    RangeOptions,
    RolePermissionType,
    RolePermissionTypeOptions,
    StructureFieldOptions
} from "node-opcua-types";
import { DataType, VariantArrayType, VariantLike } from "node-opcua-variant";
import { StatusCode, StatusCodeCallback, UInt32 } from "node-opcua-basic-types";
import { DataValue, DataValueOptions } from "node-opcua-data-value";

import { IAddressSpace } from "./address_space";
import { AddReferenceOpts, BaseNode, ConstructNodeIdOptions } from "./base_node";
import { ModellingRuleType } from "./modelling_rule_type";
import { UADataType } from "./ua_data_type";
import { UAObject } from "./ua_object";
import { UAObjectType } from "./ua_object_type";
import { UAReferenceType } from "./ua_reference_type";
import { UAVariable } from "./ua_variable";
import { UAVariableType } from "./ua_variable_type";
import { BindVariableOptions, BindVariableOptionsVariation1, HistoryReadFunc } from "./bind_variable";
import { UAView } from "./ua_view";
import { UAEventType } from "./ua_event_type";
import { UAMethod } from "./ua_method";

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

    /**
     *
     */
    accessRestrictions?: AccessRestrictionsFlag;
    /**
     *
     */
    rolePermissions?: RolePermissionTypeOptions[];
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

export interface AddVariableTypeOptions extends AddBaseNodeOptions, VariableStuff {
    isAbstract?: boolean;
    /**
     * @default BaseVariableType
     */
    subtypeOf?: string | UAVariableType;
    postInstantiateFunc?: (node: UAVariableType) => void;
    value?: VariantLike;
}

export interface AddReferenceTypeOptions extends AddBaseNodeOptions {
    isAbstract?: boolean;
    inverseName: string;
    subtypeOf?: string | NodeId | UAReferenceType;
}

export interface EnumerationItem {
    description?: LocalizedTextLike;
    displayName: LocalizedTextLike;
    value: number;
}

export interface AddEnumerationTypeOptions extends AddBaseNodeOptions {
    enumeration: string[] | EnumerationItem[];
}

export interface AddObjectOptions extends AddBaseNodeOptions {
    eventNotifier?: number;
    // default value is "BaseObjectType";
    typeDefinition?: string | NodeId | UAObjectType;
    nodeVersion?: string;
    encodingOf?: NodeId | BaseNode;
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
    inputArguments?: ArgumentOptions[];
    modellingRule?: ModellingRuleType;
    outputArguments?: ArgumentOptions[];
    componentOf?: NodeIdLike | BaseNode;
    executable?: boolean;
    userExecutable?: boolean;
    accessRestrictions?: AccessRestrictionsFlag;
    rolePermissions?: RolePermissionTypeOptions[];
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
    arrayDimensions?: UInt32[] | null;

    /**
     * The AccessLevel Attribute is used to indicate how the Value of a Variable can be accessed
     * (read/write) and if it contains current and/or historic data. The AccessLevel does not take
     * any user access rights into account, i.e. although the Variable is writable this may be
     * restricted to a certain user / user group.
     *
     * https://reference.opcfoundation.org/v104/Core/docs/Part3/8.57/
     */
    accessLevel?: UInt32 | AccessLevelString;

    /**
     * The UserAccessLevel Attribute is used to indicate how the Value of a Variable can be accessed
     * (read/write) and if it contains current or historic data taking user access rights into account.
     * https://reference.opcfoundation.org/v104/Core/docs/Part3/8.57/
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

    dataValue?: DataValueOptions;
}

export interface AddVariableOptionsWithoutValue extends AddBaseNodeOptions, VariableStuff {}
export interface AddVariableOptions extends AddVariableOptionsWithoutValue {
    // default value is "BaseVariableType";
    typeDefinition?: string | NodeId | UAVariableType;
    value?: BindVariableOptions;
    postInstantiateFunc?: (node: UAVariable) => void;
}

export interface CreateDataTypeOptions extends AddBaseNodeOptions {
    isAbstract: boolean;
    subtypeOf?: string | NodeId | UADataType;
    partialDefinition?: StructureFieldOptions[] | EnumFieldOptions[];
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

export type CreateNodeOptions = any;

export declare interface INamespace {
    version: string;
    publicationDate: Date;
    namespaceUri: string;
    addressSpace: IAddressSpace;
    index: number;
 
    constructNodeId(options: ConstructNodeIdOptions): NodeId;

    // -------------------------------------------------------------------------

    findObjectType(objectType: string): UAObjectType | null;

    findVariableType(variableType: string): UAVariableType | null;

    findDataType(dataType: string): UADataType | null;

    findReferenceType(referenceType: string): UAReferenceType | null;

    findReferenceTypeFromInverseName(referenceType: string): UAReferenceType | null;

    findNode(nodeId: NodeIdLike): BaseNode | null;
    findNode2(nodeId: NodeId): BaseNode | null;

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

    createNode(options: CreateNodeOptions): BaseNode;
    internalCreateNode(options: CreateNodeOptions): BaseNode;

    // -------------------------------------------------------------------------

    deleteNode(node: NodeId | BaseNode): void;

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
        browseName: QualifiedNameLike;
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
    /**
     * @internals
     */
    getStandardsNodeIds(): {
        referenceTypeIds: { [key: string]: string };
        objectTypeIds: { [key: string]: string };
    };

    // roles& Permission & access Restrictions
    setDefaultRolePermissions(rolePermissions: RolePermissionTypeOptions[] | null): void;
    getDefaultRolePermissions(): RolePermissionType[] | null;
    setDefaultAccessRestrictions(accessRestrictions: AccessRestrictionsFlag): void;
    getDefaultAccessRestrictions(): AccessRestrictionsFlag;
}
