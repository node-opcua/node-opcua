/**
 * @module node-opcua-address-space
 */

import type {
    AddBaseNodeOptions,
    AddVariableOptionsWithoutValue,
    BaseNode,
    BindVariableOptions,
    IVariableHistorian,
    IVariableHistorianOptions,
    UAVariable,
    UAVariableT,
    UAVariableType,
    VariableStuff
} from "node-opcua-address-space-base";
import type { Int64, UAString, UInt32 } from "node-opcua-basic-types";
import type { LocalizedText, LocalizedTextLike, QualifiedNameLike } from "node-opcua-data-model";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { UAFolder } from "node-opcua-nodeset-ua";
import type { DataType } from "node-opcua-variant";

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
    id?: NodeIdLike;
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

export interface UATypesFolder extends UAFolder {
    dataTypes: UAFolder;
    eventTypes: UAFolder;
    objectTypes: UAFolder;
    referenceTypes: UAFolder;
    variableTypes: UAFolder;
}

// AddressSpace itself lives in ./address_space_public.ts, which owns both the interface and
// the value. It used to be declared here as an `export class` among a file of interfaces and
// `declare class`, and so was the one member of this type surface that emitted runtime code:
// a second AddressSpace whose create() returned an object with no methods on it.

export interface IHistorizerFactory {
    create(node: UAVariable, options: IVariableHistorianOptions): IVariableHistorian;
}

export interface CreateExtObjArrayNodeOptions {
    browseName: QualifiedNameLike;
    complexVariableType: string | NodeId;
    variableType: string | NodeId;
    indexPropertyName: string;
    minimumSamplingInterval?: number;
}

// }}
