import { EventEmitter } from "events";

export type Duration = number;

import {
    AccessRestrictionsFlag,
    AttributeIds,
    BrowseDirection,
    LocalizedText,
    NodeClass,
    QualifiedName,
    QualifiedNameLike,
    QualifiedNameOptions
} from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { DataValue, DataValueOptions } from "node-opcua-data-value";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCode } from "node-opcua-status-code";

import {
    BrowseDescription,
    BrowseDescriptionOptions,
    ReferenceDescription,
    RelativePathElement,
    RolePermissionType,
    RolePermissionTypeOptions,
    WriteValueOptions
} from "node-opcua-types";

import { UAString, UInt32 } from "node-opcua-basic-types";
import { ReferenceTypeIds } from "node-opcua-constants";

import { INamespace } from "./namespace";
import { IAddressSpace } from "./address_space";
import { ModellingRuleType } from "./modelling_rule_type";
import { ISessionContext } from "./session_context";
import { UAObject } from "./ua_object";
import { UAReferenceType } from "./ua_reference_type";
import { UAVariable } from "./ua_variable";
import { UAVariableT } from "./ua_variable_t";
import { UAReference } from "./ua_reference";

export declare interface AddReferenceOpts {
    referenceType: keyof ReferenceTypeIds | NodeIdLike | UAReferenceType;
    nodeId: NodeIdLike | BaseNode;
    /**
     * default = true
     */
    isForward?: boolean;
    _referenceType?: UAReferenceType;
    node?: BaseNode;
}

export interface ConstructNodeIdOptions {
    nodeId?: NodeIdLike | null;
    browseName: QualifiedName;
    nodeClass: NodeClass;
    references?: UAReference[];
}

export interface IPropertyAndComponentHolder {
    getComponentByName(componentName: QualifiedNameOptions): UAObject | UAVariable | null;
    getComponentByName(componentName: string, namespaceIndex?: number): UAObject | UAVariable | null;

    getPropertyByName(propertyName: QualifiedNameOptions): UAVariable | null;
    getPropertyByName(propertyName: string, namespaceIndex?: number): UAVariable | null;

    getAggregates(): BaseNode[];

    getComponents(): BaseNode[];

    getProperties(): BaseNode[];

    getNotifiers(): BaseNode[];
}

export interface BrowseDescriptionOptions2 extends BrowseDescriptionOptions {
    browseDirection?: BrowseDirection;
    referenceTypeId?: NodeIdLike;
    includeSubtypes?: boolean;
    nodeClassMask: UInt32;
    resultMask: UInt32;
}

export declare class BaseNode extends EventEmitter {
    public get addressSpace(): IAddressSpace;
    public readonly browseName: QualifiedName;
    public get displayName(): LocalizedText[];
    public get description(): LocalizedText;
    public readonly nodeClass: NodeClass;
    public readonly nodeId: NodeId;
    public get modellingRule(): ModellingRuleType | undefined;
    public get parentNodeId(): NodeId | undefined;
    public get accessRestrictions(): AccessRestrictionsFlag | undefined;
    public get rolePermissions(): RolePermissionType[] | undefined;

    // access to parent namespace
    public get namespaceIndex(): number;
    public get namespaceUri(): string;
    public get namespace(): INamespace;

    public onFirstBrowseAction?: (this: BaseNode) => Promise<void>;

    /**
     * return a complete name of this object by pre-pending
     * name of its parent(s) to its own name
     */
    public fullName(): string;

    public addReference(options: AddReferenceOpts): void;

    public removeReference(referenceOpts: AddReferenceOpts): void;

    public readAttribute(
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    public writeAttribute(
        context: ISessionContext | null,
        writeValue: WriteValueOptions,
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

    /**
     *
     * @param locale the locale of the text to return (e.g. en-EN)
     */
    public getDisplayName(locale?: string): string;

    /**
     * private
     */
    public install_extra_properties(): void;

    public browseNodeByTargetName(relativePathElement: RelativePathElement, isLast: boolean): NodeId[];

    /**
     * find all the references that are of type **`reference`** or a sub type of **`reference`**, in the
     * direction specified by **`browseDirection`**
     *
     *  * BrowseDirection.Forward direction is implied if browseDirection flags is omitted.
     */
    public findReferencesEx(referenceType: string | NodeId | UAReferenceType, browseDirection?: BrowseDirection): UAReference[];

    /**
     * find all the references that are strictly of type **`reference`**.
     * The isForward boolean flag specifies the direction of the references to be looked for.
     *
     * Forward direction is implied if omitted.
     */
    public findReferences(referenceType: string | NodeId | UAReferenceType, isForward?: boolean): UAReference[];

    /**
     * find the the references that are strictly of type **`reference`**.
     *
     * The isForward boolean flag specifies the direction of the references to be looked for.
     *
     * Forward direction is implied if omitted.
     *
     * * will throw an exception  if more than one reference exists with the referenceType.
     * * will return null if no reference exists.
     */
    public findReference(referenceType: string | NodeId | UAReferenceType, isForward?: boolean): UAReference | null;

    /**
     * find all the nodes that are referenced by references of type **`reference`** or a sub type of **`reference`**, in the
     * direction specified by **`browseDirection`**
     *
     *  * BrowseDirection.Forward direction is implied if browseDirection flags is omitted.
     */
    public findReferencesExAsObject(
        referenceType: string | NodeId | UAReferenceType,
        browseDirection?: BrowseDirection
    ): BaseNode[];

    /**
     *  find all the nodes that are referenced by references strictly of type **`reference`**.
     *
     * The isForward boolean flag specifies the direction of the references to be looked for.
     *
     * Forward direction is implied if omitted.
     *
     * * will throw an exception  if more than one reference exists with the referenceType.
     * * will return null if no reference exists.
     */
    public findReferencesAsObject(referenceType: string | NodeId | UAReferenceType, isForward?: boolean): BaseNode[];

    public allReferences(): UAReference[];

    public getChildByName(browseName: QualifiedNameOptions): BaseNode | null;
    public getChildByName(browseName: string, namespaceIndex?: number): BaseNode | null;

    /**
     * this methods propagates the forward references to the pointed node
     * by inserting backward references to the counter part node
     *
     * @private
     */
    public propagate_back_references(): void;

    /**
     * browse the node to extract information requested in browseDescription
     */
    public browseNode(browseDescription: BrowseDescriptionOptions2, session?: ISessionContext): ReferenceDescription[];

    /**
     *
     * @param rolePermissions
     */
    setRolePermissions(rolePermissions: RolePermissionTypeOptions[]): void;

    getRolePermissions(inherited: boolean): RolePermissionType[] | null;

    /**
     * setAccessRestriction
     */
    setAccessRestrictions(accessRestrictions: AccessRestrictionsFlag): void;
    /**
     * get effective accessRestrictions
     * if (inherited is true) and node has no accessRestrictions, then
     * default accessRestriction from namespace is returned
     * if (inherited is false) and node has no accessRestrictions, then
     * AccessRestrictionsFlag.None is returned
     *
     */
    getAccessRestrictions(inherited: boolean): AccessRestrictionsFlag;
    /**
     * NodeVersion (Optional) String The NodeVersion Property is used to indicate the version of a Node.
     * The NodeVersion Property is updated each time a Reference is added or deleted to the Node the Property
     * belongs to. Attribute value changes do not cause the NodeVersion to change.
     * Clients may read the NodeVersion Property or subscribe to it to determine when the structure of a Node has changed.
     */
    nodeVersion?: UAVariableT<UAString, DataType.String>;

    /**
     *
     */
    getAggregates(): BaseNode[];
}
