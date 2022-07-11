import { NodeId } from "node-opcua-nodeid";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { Byte, DateTime, Int16, Int32, SByte, StatusCode, UAString, UInt16, UInt32 } from "node-opcua-basic-types";
import { LocalizedTextLike, NodeClass, QualifiedNameOptions } from "node-opcua-data-model";

import { ExtensionObject } from "node-opcua-extension-object";
import { CloneOptions, CloneFilter, CloneExtraInfo } from "./clone_options";
import { BaseNode, IPropertyAndComponentHolder } from "./base_node";
import { UAObjectType } from "./ua_object_type";
import { IEventData, UAEventType } from "./ua_event_type";
import { UAMethod } from "./ua_method";
import { EventNotifierFlags } from "./event_notifier_flags";

export type EventTypeLike = string | NodeId | UAEventType;

export interface PseudoVariantNull {
    dataType: "Null" | DataType.Null;
}

export interface PseudoVariantString {
    dataType: "String" | DataType.String;
    value: UAString;
}

export interface PseudoVariantBoolean {
    dataType: "Boolean" | DataType.Boolean;
    value: boolean;
}
export interface PseudoVariantDouble {
    dataType: "Double" | DataType.Double;
    value: number;
}

export interface PseudoVariantFloat {
    dataType: "Float" | DataType.Float;
    value: number;
}

export interface PseudoVariantNodeId {
    dataType: "NodeId" | DataType.NodeId;
    value: NodeId;
}

export interface PseudoVariantUInt32 {
    dataType: "UInt32" | DataType.UInt32;
    value: UInt32;
}
export interface PseudoVariantUInt16 {
    dataType: "UInt16" | DataType.UInt16;
    value: UInt16;
}
export interface PseudoVariantByte {
    dataType: "UInt8" | DataType.Byte;
    value: Byte;
}
export interface PseudoVariantInt32 {
    dataType: "Int32" | DataType.UInt32;
    value: Int32;
}
export interface PseudoVariantInt16 {
    dataType: "Int16" | DataType.UInt16;
    value: Int16;
}
export interface PseudoVariantSByte {
    dataType: "SByte" | DataType.SByte;
    value: SByte;
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
    value: Buffer | null;
}

export interface PseudoVariantExtensionObject {
    dataType: "ExtensionObject" | DataType.ExtensionObject;
    value: ExtensionObject;
}

export interface PseudoVariantExtensionObjectArray {
    dataType: "ExtensionObject" | DataType.ExtensionObject;
    arrayType: VariantArrayType.Array;
    value: ExtensionObject[];
}
export interface PseudoVariantVariantArray {
    dataType: "Variant" | DataType.Variant;
    arrayType: VariantArrayType.Array;
    value: Variant[];
}
export interface PseudoVariantVariant {
    dataType: "Variant" | DataType.Variant;
    value: Variant;
}

export type PseudoVariantNumber =
    | PseudoVariantUInt32
    | PseudoVariantUInt16
    | PseudoVariantByte
    | PseudoVariantInt32
    | PseudoVariantInt16
    | PseudoVariantSByte
    | PseudoVariantDouble
    | PseudoVariantFloat;

export type PseudoVariant =
    | PseudoVariantNull
    | PseudoVariantString
    | PseudoVariantBoolean
    | PseudoVariantByteString
    | PseudoVariantNodeId
    | PseudoVariantDateTime
    | PseudoVariantByteString
    | PseudoVariantDuration
    | PseudoVariantLocalizedText
    | PseudoVariantStatusCode
    | PseudoVariantNumber
    | PseudoVariantExtensionObject
    | PseudoVariantExtensionObjectArray
    | PseudoVariantVariant
    | PseudoVariantVariantArray;
export interface RaiseEventData {
    $eventDataSource?: UAEventType;

    sourceNode?: PseudoVariantNodeId | Variant;
    [key: string]: PseudoVariant | Variant | UAEventType | undefined;
}

export interface EventRaiser {
    raiseEvent(eventType: EventTypeLike, eventData: RaiseEventData): void;
}


export interface UAObject extends BaseNode, EventRaiser, IPropertyAndComponentHolder {
    readonly nodeClass: NodeClass.Object;
    get parent(): BaseNode | null;
    get typeDefinitionObj(): UAObjectType;
    get typeDefinition(): NodeId;
    readonly eventNotifier: EventNotifierFlags;
    readonly hasMethods: boolean;

    //
    getFolderElementByName(browseName: QualifiedNameOptions): BaseNode | null;
    getFolderElementByName(browseName: string, namespaceIndex?: number): BaseNode | null;

    // Method accessor
    getMethodById(nodeId: NodeId): UAMethod | null;

    getMethodByName(methodName: QualifiedNameOptions): UAMethod | null;
    getMethodByName(methodName: string, namespaceIndex?: number): UAMethod | null;

    getMethods(): UAMethod[];

    raiseEvent(eventType: EventTypeLike | BaseNode, eventData: RaiseEventData): void;

    on(eventName: "event", eventHandler: (eventData: IEventData) => void): this;

    setEventNotifier(eventNotifierFlags: EventNotifierFlags): void;

    clone(options: CloneOptions, optionalFilter?: CloneFilter, extraInfo?: CloneExtraInfo): UAObject;
}
