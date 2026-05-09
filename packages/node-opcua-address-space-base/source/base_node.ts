import  { EventEmitter } from "node:events";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ReferenceTypeIds } from "node-opcua-constants";
import type {
    AccessRestrictionsFlag,
    AttributeIds,
    BrowseDirection,
    LocalizedText,
    LocalizedTextLike,
    NodeClass,
    QualifiedName,
    QualifiedNameLike,
    QualifiedNameOptions
} from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import type { StatusCode } from "node-opcua-status-code";
import type {
    BrowseDescriptionOptions,
    ReferenceDescription,
    RelativePathElement,
    RolePermissionType,
    RolePermissionTypeOptions,
    WriteValueOptions
} from "node-opcua-types";
import type { DataType } from "node-opcua-variant";
import type { IAddressSpace } from "./address_space";
import type { IEventData } from "./i_event_data";
import type { ModellingRuleType } from "./modelling_rule_type";
import type { INamespace } from "./namespace";
import type { ISessionContext } from "./session_context";
import type { UAObject } from "./ua_object";
import type { UAProperty } from "./ua_property";
import type { UAReference } from "./ua_reference";
import type { UAReferenceType } from "./ua_reference_type";
import type { UAVariable } from "./ua_variable";

export type Duration = number;

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

export type AttributeEventName =
    | "Value_changed"
    | "DisplayName_changed"
    | "Description_changed"
    | "BrowseName_changed"
    | "RolePermissions_changed"
    | "AccessRestrictions_changed";

export interface BaseNodeEvents_ {
    dispose: [];
    event: [attribute: IEventData];
    Value_changed: [attribute: DataValue];
    DisplayName_changed: [attribute: DataValue];
    Description_changed: [attribute: DataValue];
    BrowseName_changed: [attribute: DataValue];
    RolePermissions_changed: [attribute: DataValue];
    AccessRestrictions_changed: [attribute: DataValue];
}

export interface BaseNodeEvents {
    dispose: () => void;
    event: (attribute: IEventData) => void;
    Value_changed: (attribute: DataValue) => void;
    DisplayName_changed: (attribute: DataValue) => void;
    Description_changed: (attribute: DataValue) => void;
    BrowseName_changed: (attribute: DataValue) => void;
    RolePermissions_changed: (attribute: DataValue) => void;
    AccessRestrictions_changed: (attribute: DataValue) => void;
}

// Self-referential constraint: every property of L must be a function.
// Lets us drop the broken `T[K] extends (...) => ...` conditionals while
// preserving exact callback signatures (named params, optional args) for IntelliSense.
export type ListenerSignature<L> = {
    // biome-ignore lint/suspicious/noExplicitAny: any is required to bypass function-parameter contravariance; using unknown breaks T[K] assignability
    [E in keyof L]: (...args: any[]) => any;
};

export interface ITypedEventEmitter<T extends ListenerSignature<T>> {
    on<K extends keyof T>(event: K, listener: T[K]): this;
    once<K extends keyof T>(event: K, listener: T[K]): this;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
    off<K extends keyof T>(event: K, listener: T[K]): this;

    listenerCount<K extends keyof T>(event: K): number;

    setMaxListeners(n: number): void;
    removeAllListeners(): void;
    removeListener<K extends keyof T>(event: K, listener: T[K]): void;
}

// Aliases Node's EventEmitter directly so listeners receive `this === <emitter>`, matching
// the standard EventEmitter contract. The previous composition-based implementation invoked
// listeners with `this` bound to a private inner emitter, breaking that contract.
export type TypedEventEmitter<T extends ListenerSignature<T>> = ITypedEventEmitter<T>;
export const TypedEventEmitter = EventEmitter as unknown as {
    new <T extends ListenerSignature<T>>(): ITypedEventEmitter<T>;
};
export interface BaseNode<T extends BaseNodeEvents & ListenerSignature<T> = BaseNodeEvents> extends ITypedEventEmitter<T> {
 
    readonly nodeClass: NodeClass;
    get addressSpace(): IAddressSpace;
    readonly browseName: QualifiedName;
    get displayName(): LocalizedText[];
    get description(): LocalizedText;
    readonly nodeId: NodeId;
    get modellingRule(): ModellingRuleType | undefined;
    get parentNodeId(): NodeId | undefined;
    get accessRestrictions(): AccessRestrictionsFlag | undefined;
    get rolePermissions(): RolePermissionType[] | undefined;

    // access to parent namespace
    get namespaceIndex(): number;
    get namespaceUri(): string;
    get namespace(): INamespace;

    isDisposed(): boolean;

    onFirstBrowseAction?: (this: BaseNode) => Promise<void>;

    /**
     * return a complete name of this object by pre-pending
     * name of its parent(s) to its own name
     */
    fullName(): string;

    addReference(options: AddReferenceOpts): void;

    removeReference(referenceOpts: AddReferenceOpts): void;

    readAttribute(
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue;

    writeAttribute(
        context: ISessionContext | null,
        writeValue: WriteValueOptions,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void;

    /**
     * return a array with the event source of this object.
     * self = HasEventSource => nodes
     */
    getEventSources(): BaseNode[];

    /**
     * return a array of the objects for which this node is an EventSource
     * nodes = HasEventSource => self
     */
    getEventSourceOfs(): BaseNode[];

    /**
     *
     * @param locale the locale of the text to return (e.g. en-EN)
     */
    getDisplayName(locale?: string): string;

    /**
     * private
     */
    install_extra_properties(): void;

    browseNodeByTargetName(relativePathElement: RelativePathElement, isLast: boolean): NodeId[];

    /**
     * find all the references that are of type **`reference`** or a sub type of **`reference`**, in the
     * direction specified by **`browseDirection`**
     *
     *  * BrowseDirection.Forward direction is implied if browseDirection flags is omitted.
     */
    findReferencesEx(referenceType: string | NodeId | UAReferenceType, browseDirection?: BrowseDirection): UAReference[];

    /**
     * find all the references that are strictly of type **`reference`**.
     * The isForward boolean flag specifies the direction of the references to be looked for.
     *
     * Forward direction is implied if omitted.
     */
    findReferences(referenceType: string | NodeId | UAReferenceType, isForward?: boolean): UAReference[];

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
    findReference(referenceType: string | NodeId | UAReferenceType, isForward?: boolean): UAReference | null;

    /**
     * find all the nodes that are referenced by references of type **`reference`** or a
     * sub type of **`reference`**, in the direction specified by **`browseDirection`**
     *
     *  * BrowseDirection.Forward direction is implied if browseDirection flags is omitted.
     */
    findReferencesExAsObject(referenceType: string | NodeId | UAReferenceType, browseDirection?: BrowseDirection): BaseNode[];

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
    findReferencesAsObject(referenceType: string | NodeId | UAReferenceType, isForward?: boolean): BaseNode[];

    allReferences(): UAReference[];

    /**
     * Get the Child by name, if browseName is string and namespaceIndex undefined
     * then the search doesn't care about namespace matching
     *
     * @param browseName
     */
    getChildByName(browseName: QualifiedNameOptions): BaseNode | null;
    getChildByName(browseName: string, namespaceIndex?: number): BaseNode | null;

    /**
     * this methods propagates the forward references to the pointed node
     * by inserting backward references to the counter part node
     *
     * @private
     */
    propagate_back_references(): void;

    /**
     * browse the node to extract information requested in browseDescription
     */
    browseNode(browseDescription: BrowseDescriptionOptions2, session?: ISessionContext): ReferenceDescription[];

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
     *
     * The NodeVersion Property is updated each time a Reference is added or deleted
     * to the Node the Property belongs to.
     *
     * Attribute value changes do not cause the NodeVersion to change.
     *
     * Clients may read the NodeVersion Property or subscribe to it to determine when the
     * structure of a Node has changed.
     */
    // nodeVersion?: UAProperty<UAString, DataType.String>;
    /**
     * return the versioning node
     */
    getNodeVersion(): UAProperty<UAString, DataType.String> | null;

    /**
     *
     */
    getAggregates(): BaseNode[];

    setDisplayName(value: LocalizedTextLike[] | LocalizedTextLike): void;
    setDescription(value: LocalizedTextLike | null): void;
}
