// tslint:disable:max-classes-per-file

import {
    AccessLevelFlag,
    AttributeIds,
    LocalizedText, LocalizedTextLike,
    NodeClass,
    QualifiedName, QualifiedNameLike
} from "node-opcua-data-model";
import {
    BrowseDescription,
    BrowseResult
} from "node-opcua-service-browse";

import { DataValue } from "node-opcua-data-value";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { DataType, Variant, VariantLike } from "node-opcua-variant";

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

export declare class UAVariable extends BaseNode {
    public setValueFromSource(value: VariantLike): void;
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

export interface AddAnalogDataItemOpts extends AddNodeOptions {
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

export interface AddNodeOptions {
    browseName: string;
    displayName?: string | LocalizedText | LocalizedText[];
    description?: string;

    organizedBy?: NodeId | BaseNode;
    componentOf?: NodeId | BaseNode;
    propertyOf?: NodeId | BaseNode;

    nodeId?: string | NodeId;
}

export interface AddVariableOpts extends AddNodeOptions {
    dataType: string | DataType;
    value?: {
        get?: () => Variant;
        timestamp_get?: () => DataValue;
        refreshFunc?: (err: null | Error, dataValue?: DataValue) => void;
    };
}

export enum EUEngineeringUnit {
    degree_celsius
    // to be continued
}

export interface AddBaseNodeOptions {
    nodeId?: NodeIdLike ;
    browseName: QualifiedNameLike;
    displayName: LocalizedTextLike | LocalizedTextLike[];
}

export interface AddVariableTypeOptions extends AddBaseNodeOptions {
    isAbstract?: boolean;
    subtypeOf: string | UAVariableType;
    postInstantiateFunc?: (node: UAVariableType) => void;

    dataType?: string | NodeIdLike;
    valueRank?: number;
    arrayDimensions?: number[];

    dataValue?: DataValue;

}

export interface AddObjectTypeOptions extends AddBaseNodeOptions {
    isAbstract?: boolean;
    subtypeOf: string | UAObjectType;
    eventNotifier?: number;
    postInstantiateFunc?: (node: UAObjectType) => void;
}

export type AddVariableOptions = any;
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

    addVariable(options: AddVariableOptions): UAVariable;

    addObject(options: AddObjectOptions): UAObject;

    addObjectType(options: AddObjectTypeOptions): UAObjectType;

    addVariableType(options: AddVariableTypeOptions): UAVariableType;

    addView(options: any): UAView;

    addFolder(parentFolder: UAObject, options: any): UAObject;

    addReferenceType(options: AddReferenceTypeOptions): UAReferenceType;

    createDataType(options: CreateDataTypeOptions): UADataType;

    createNode(options: CreateNodeOptions): BaseNode;

    deleteNode(node: NodeId | BaseNode): void;

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

    public addVariable(options: AddVariableOpts): UAVariable;

    public addAnalogDataItem(options: AddAnalogDataItemOpts): UAAnalogItem;

    public addView(options: AddNodeOptions): UAView;

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
