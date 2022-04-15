// tslint:disable:max-classes-per-file
/**
 * @module node-opcua-address-space
 */
import { DateTime, Int64, UAString, UInt32 } from "node-opcua-basic-types";

import { AttributeIds, LocalizedText, LocalizedTextLike, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { ReadRawModifiedDetails } from "node-opcua-service-history";
import { DataType } from "node-opcua-variant";
import {
    BaseNode,
    IAddressSpace,
    AddVariableOptionsWithoutValue,
    BindVariableOptions,
    UAMethod,
    UAVariableT,
    UAReference,
    AddBaseNodeOptions,
    VariableStuff,
    UAVariableType,
    UAVariable,
    UAObject,
    IVariableHistorianOptions,
    IVariableHistorian,
    UAObjectType,
    UADynamicVariableArray,
    UAReferenceType,
    ISessionContext,
    INamespace
} from "node-opcua-address-space-base";
import { UAFolder } from "node-opcua-nodeset-ua";

import { MinimalistAddressSpace } from "../src/reference_impl";
import { Namespace } from "./namespace";
import { UARootFolder } from "./ua_root_folder";

export declare function resolveReferenceType(addressSpace: MinimalistAddressSpace, reference: UAReference): UAReferenceType;

export declare function resolveReferenceNode(addressSpace: MinimalistAddressSpace, reference: UAReference): BaseNode;

export declare function makeAttributeEventName(attributeId: AttributeIds): string;

export interface EnumValueTypeOptionsLike {
    value?: Int64 | UInt32;
    displayName?: LocalizedTextLike | null;
    description?: LocalizedTextLike | null;
}

export interface AddMultiStateValueDiscreteOptions extends AddVariableOptionsWithoutValue {
    enumValues: EnumValueTypeOptionsLike[] | { [key: string]: number };
    value?: UInt32 | Int64 | BindVariableOptions;
}

export enum EUEngineeringUnit {
    degree_celsius
    // to be continued
}

export interface AddMultiStateDiscreteOptions extends AddBaseNodeOptions, VariableStuff {
    enumStrings: string[]; // default value is "BaseVariableType";
    typeDefinition?: string | NodeId | UAVariableType;
    postInstantiateFunc?: (node: UAVariable) => void;
    value?: number | BindVariableOptions;
}
// BaseVariableType => BaseDataVariableType => StateVariableType => TwoStateVariableType
// @see https://reference.opcfoundation.org/v104/Core/VariableTypes/StateVariableType/
// "EffectiveDisplayName"  QualifiedName
// "Name"                  LocalizedText
// "Number"                UInt32
export type AddStateVariableOptionals = "EffectiveDisplayName" | "Name" | "Number" | string;
export interface AddStateVariableOptions extends AddVariableOptionsWithoutValue {
    id?: any;
    optionals?: AddStateVariableOptionals[];
}

// BaseVariableType => BaseDataVariableType => StateVariableType => TwoStateVariableType
// @see https://reference.opcfoundation.org/v104/Core/VariableTypes/TwoStateVariableType/
// "TransitionTime"           UtcTime
// "EffectiveTransitionTime"  UtcTime
// "TrueState"                LocalizedText
// "FalseState"               LocalizedText
export type AddTwoStateVariableOptionals =
    | AddStateVariableOptionals
    | "TransitionTime"
    | "EffectiveTransitionTime"
    | "TrueState"
    | "FalseState";

export interface AddTwoStateVariableOptions extends AddStateVariableOptions {
    falseState?: LocalizedTextLike;
    trueState?: LocalizedTextLike;
    optionals?: AddTwoStateVariableOptionals[];
    isFalseSubStateOf?: NodeId | string | BaseNode;
    isTrueSubStateOf?: NodeId | string | BaseNode;

    value?: boolean | BindVariableOptions;
}

// BaseVariableType => BaseDataVariableType => DataItemType => DiscreteItemType => TwoStateDiscreteType
export interface AddTwoStateDiscreteOptions extends AddVariableOptionsWithoutValue {
    falseState?: LocalizedTextLike;
    trueState?: LocalizedTextLike;
    optionals?: string[];
    isFalseSubStateOf?: NodeIdLike | BaseNode;
    isTrueSubStateOf?: NodeIdLike | BaseNode;

    value?: boolean | BindVariableOptions;

    /** @example  "" */
    definition?: string;
}

export interface RangeVariable extends UAVariable {
    low: UAVariableT<number, DataType.Double>;
    high: UAVariableT<number, DataType.Double>;
}

export interface XAxisDefinitionVariable extends UAVariable {
    engineeringUnits: UAVariableT<UAString, DataType.String>;
    title: UAVariableT<LocalizedText, DataType.LocalizedText>;
    euRange: RangeVariable;
}

export declare const NamespaceOptions: { nodeIdNameSeparator: string };

export interface UATypesFolder extends UAFolder {
    dataTypes: UAFolder;
    eventTypes: UAFolder;
    objectTypes: UAFolder;
    referenceTypes: UAFolder;
    variableTypes: UAFolder;
}

type LocaleId = string;

export interface AddressSpace extends IAddressSpace {
    getOwnNamespace(): Namespace;
    registerNamespace(namespaceUri: string): Namespace;
    rootFolder: UARootFolder;
}
export class AddressSpace {
    public static historizerFactory: any;

    public static create(): AddressSpace {
        return new AddressSpace() as AddressSpace;
    }

    private constructor() {
        /* empty */
    }
}

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

export type UAClonable = UAObject | UAVariable | UAMethod;

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

export declare function dumpXml(node: BaseNode, options: any): string;
export declare function dumpToBSD(namespace: INamespace): string;
export declare function adjustNamespaceArray(addressSpace: IAddressSpace): void;
