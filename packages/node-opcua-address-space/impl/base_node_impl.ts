/**
 * @module node-opcua-address-space
 */

import { isDeepStrictEqual as isEqual } from "node:util";
import chalk from "chalk";
import {
    type AddReferenceOpts,
    type AttributeEventName,
    type BaseNode,
    type BaseNodeEvents,
    type BrowseDescriptionOptions2,
    type IAddressSpace,
    type INamespace,
    type ISessionContext,
    type ListenerSignature,
    type ModellingRuleType,
    TypedEventEmitter,
    type UAMethod,
    type UAObject,
    type UAObjectType,
    type UAProperty,
    type UAReference,
    type UAReferenceType,
    type UAVariable,
    type UAVariableType
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { UAString } from "node-opcua-basic-types";
import { ObjectTypeIds, ReferenceTypeIds, VariableTypeIds } from "node-opcua-constants";
import {
    AccessRestrictionsFlag,
    AttributeIds,
    attributeNameById,
    BrowseDirection,
    coerceLocalizedText,
    coerceQualifiedName,
    LocalizedText,
    type LocalizedTextLike,
    NodeClass,
    QualifiedName,
    type QualifiedNameLike,
    type QualifiedNameOptions
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { dumpIf, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { coerceNodeId, makeNodeId, NodeId, type NodeIdLike, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import type { UAStateVariable } from "node-opcua-nodeset-ua";
import type { NumericRange } from "node-opcua-numeric-range";
import type { ReferenceDescription } from "node-opcua-service-browse";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    PermissionType,
    type RelativePathElement,
    RolePermissionType,
    type RolePermissionTypeOptions,
    type WriteValueOptions
} from "node-opcua-types";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { dumpReferenceDescriptions, dumpReferences } from "../api/helpers/dump_tools.js";
import { SessionContext, WellKnownRolesNodeId } from "../api/session_context.js";
import type { XmlWriter } from "../api/xml_writer.js";
import type { AddressSpaceImpl } from "./address_space.js";
import { _handle_add_reference_change_event } from "./address_space_change_event_tools.js";
import type { AddressSpacePrivate } from "./address_space_private.js";
import {
    _constructReferenceDescription,
    _get_HierarchicalReference,
    _handle_HierarchicalReference,
    _remove_HierarchicalReference,
    BaseNode_add_backward_reference,
    BaseNode_clearCache,
    BaseNode_getCache,
    BaseNode_getPrivate,
    BaseNode_initPrivate,
    BaseNode_remove_backward_reference,
    BaseNode_removePrivate,
    BaseNode_toString,
    type HierarchicalIndexMap,
    ToStringBuilder
} from "./base_node_private.js";
import {
    defineSharedChildAccessors as defineQueuedChildAccessors,
    hasSharedChildAccessor,
    isReservedChildAccessorName,
    registerChildName,
    reservedChildAccessorNames,
    resolveChildInIndex
} from "./child_accessors.js";
import { type MinimalistAddressSpace, nodeIdKey, ReferenceImpl, type ReferenceKey } from "./reference_impl.js";
import { referenceTypeVersion } from "./reference_type_version.js";
import { coerceRolePermissions } from "./role_permissions.js";

type ApplyFunc = { apply: (...args: unknown[]) => void };

const doDebug = false;
const warningLog = make_warningLog("base_node_impl");
const errorLog = make_errorLog("base_node_impl");
const debugLog = make_debugLog("base_node_impl");

const HasEventSourceReferenceType = resolveNodeId("HasEventSource");
const HasNotifierReferenceType = resolveNodeId("HasNotifier");
const HierarchicalReferencesType = resolveNodeId("HierarchicalReferences");
const HasChildReferenceType = resolveNodeId("HasChild");
/** a node with more references than this keeps the result of its reference scans */
const referenceScanMemoThreshold = 8;

/**
 * the reference types every child lookup and accessor installation needs, resolved once per
 * address space rather than once per call; absent until namespace 0 has loaded them
 */
interface WellKnownReferenceTypes {
    hierarchicalReferences: UAReferenceType;
    hasChild: UAReferenceType;
    hasComponent: UAReferenceType;
    hasProperty: UAReferenceType;
    organizes: UAReferenceType;
}
const wellKnownReferenceTypesByAddressSpace = new WeakMap<IAddressSpace, WellKnownReferenceTypes>();

function wellKnownReferenceTypes(addressSpace: IAddressSpace): WellKnownReferenceTypes | null {
    const known = wellKnownReferenceTypesByAddressSpace.get(addressSpace);
    // an address space is disposed namespace by namespace, namespace 0 first: a child lookup made
    // while a later namespace is torn down must not be handed reference types that are gone
    if (known && !(known.hasChild as unknown as BaseNodeImpl).isDisposed()) {
        return known;
    }
    const hierarchicalReferences = addressSpace.findReferenceType(HierarchicalReferencesType);
    const hasChild = addressSpace.findReferenceType(HasChildReferenceType);
    const hasComponent = addressSpace.findReferenceType(HasComponentReferenceType);
    const hasProperty = addressSpace.findReferenceType(HasPropertyReferenceType);
    const organizes = addressSpace.findReferenceType(OrganizesReferenceType);
    if (!hierarchicalReferences || !hasChild || !hasComponent || !hasProperty || !organizes) {
        return null; // namespace 0 is still loading
    }
    const resolved = { hierarchicalReferences, hasChild, hasComponent, hasProperty, organizes };
    wellKnownReferenceTypesByAddressSpace.set(addressSpace, resolved);
    return resolved;
}
const HasComponentReferenceType = resolveNodeId("HasComponent");
const HasPropertyReferenceType = resolveNodeId("HasProperty");
const OrganizesReferenceType = resolveNodeId("Organizes");

function defaultBrowseFilterFunc(_context?: ISessionContext): boolean {
    return true;
}

function _get_QualifiedBrowseName(browseName: QualifiedNameLike): QualifiedName {
    return coerceQualifiedName(browseName) || "";
}

export interface InternalBaseNodeOptions {
    /**
     * the parent address space
     */
    addressSpace: AddressSpacePrivate;
    browseName: QualifiedName;
    nodeId: NodeId;
    references?: UAReference[];

    displayName?: LocalizedTextLike | LocalizedTextLike[];
    description?: LocalizedTextLike | null;

    browseFilter?: (this: BaseNode, context?: ISessionContext) => boolean;

    /**
     * https://reference.opcfoundation.org/v104/Core/docs/Part3/8.56/
     */
    accessRestrictions?: AccessRestrictionsFlag;
    rolePermissions?: RolePermissionTypeOptions[];
}

function _is_valid_BrowseDirection(browseDirection: BrowseDirection) {
    return (
        browseDirection === BrowseDirection.Forward ||
        browseDirection === BrowseDirection.Inverse ||
        browseDirection === BrowseDirection.Both
    );
}
export function makeAttributeEventName(attributeId: AttributeIds): AttributeEventName {
    const attributeName = attributeNameById[attributeId];
    return `${attributeName}_changed` as AttributeEventName;
}

/**
 * Base class for all Node classes
 *
 * BaseNode is the base class for all the OPCUA objects in the address space
 * It provides attributes and a set of references to other nodes.
 * see:
 * {{#crossLink "UAObject"}}{{/crossLink}},
 * {{#crossLink "UAVariable"}}{{/crossLink}},
 * {{#crossLink "Reference"}}{{/crossLink}},
 * {{#crossLink "UAMethod"}}{{/crossLink}},
 * {{#crossLink "UAView"}}{{/crossLink}},
 * {{#crossLink "UAObjectType"}}{{/crossLink}},
 * {{#crossLink "UADataType"}}{{/crossLink}},
 * {{#crossLink "UAVariableType"}}{{/crossLink}},
 *
 *
 */

export abstract class BaseNodeImpl<T extends BaseNodeEvents & ListenerSignature<T> = BaseNodeEvents>
    extends TypedEventEmitter<T>
    implements BaseNode<T>
{
    public static makeAttributeEventName(attributeId: AttributeIds): AttributeEventName {
        return makeAttributeEventName(attributeId);
    }

    private _accessRestrictions?: AccessRestrictionsFlag;
    private _rolePermissions?: RolePermissionType[];

    // public onFirstBrowseAction?: (this: BaseNode<T>) => Promise<void>;

    public get addressSpace(): IAddressSpace {
        const _private = BaseNode_getPrivate(this);
        // c8 ignore next
        if (!_private) {
            throw new Error(`Internal error , cannot extract private data from ${this.browseName.toString()}`);
        }
        return _private.__address_space as AddressSpaceImpl;
    }

    protected get addressSpacePrivate(): AddressSpacePrivate {
        const _private = BaseNode_getPrivate(this);
        // c8 ignore next
        if (!_private) {
            throw new Error(`Internal error , cannot extract private data from ${this.browseName.toString()}`);
        }
        return _private.__address_space as AddressSpacePrivate;
    }

    public get displayName(): LocalizedText[] {
        const _private = BaseNode_getPrivate(this);
        if (!_private._displayName) {
            const raw = _private._displayNameRaw ?? "";
            const displayNames: LocalizedTextLike[] = Array.isArray(raw) ? raw : [raw];
            _private._displayName = displayNames.map(coerceLocalizedText) as LocalizedText[];
        }
        return _private._displayName;
    }

    public setDisplayName(value: LocalizedTextLike[] | LocalizedTextLike): void {
        if (!Array.isArray(value)) {
            this.setDisplayName([value]);
            return;
        }
        this._setDisplayName(value);
        /**
         * fires when the displayName is changed.
         * @event DisplayName_changed
         * @param dataValue {DataValue}
         */
        this._notifyAttributeChange(AttributeIds.DisplayName);
    }

    public get description(): LocalizedText {
        const _private = BaseNode_getPrivate(this);
        if (!_private._description) {
            _private._description = coerceLocalizedText(_private._descriptionRaw ?? null) || new LocalizedText({ text: "" });
        }
        return _private._description;
    }

    public setDescription(value: LocalizedTextLike | null): void {
        this._setDescription(value);
        /**
         * fires when the description attribute is changed.
         * @event Description_changed
         * @param dataValue {DataValue}
         */
        this._notifyAttributeChange(AttributeIds.Description);
    }

    /**
     * returns the nodeId of this node's Type Definition
     */
    public get typeDefinition(): NodeId {
        const _cache = BaseNode_getCache(this);
        if (!_cache.typeDefinition) {
            const has_type_definition_ref = this.findReference("HasTypeDefinition", true);
            let nodeId = has_type_definition_ref ? has_type_definition_ref.nodeId : null;
            if (!nodeId) {
                switch (this.nodeClass) {
                    case NodeClass.Object:
                        nodeId = coerceNodeId(ObjectTypeIds.BaseObjectType);
                        break;
                    case NodeClass.Variable:
                        nodeId = coerceNodeId(VariableTypeIds.BaseVariableType);
                        break;
                    default:
                }
            }
            _cache.typeDefinition = nodeId as NodeId;
        }
        return _cache.typeDefinition;
    }

    /**
     * returns the nodeId of this node's Type Definition
     */
    public get typeDefinitionObj(): UAObjectType | UAVariableType {
        const _cache = BaseNode_getCache(this);
        if (undefined === _cache.typeDefinitionObj) {
            const nodeId = this.typeDefinition;
            _cache.typeDefinitionObj = nodeId ? (this.addressSpace.findNode(nodeId) as UAObjectType | UAVariableType) : null;
        }
        if (!_cache.typeDefinitionObj) {
            warningLog(
                this.nodeClass,
                "cannot find typeDefinitionObj ",
                this.browseName.toString(),
                this.nodeId.toString(),
                NodeClass[this.nodeClass]
            );
        }
        return _cache.typeDefinitionObj as UAObjectType | UAVariableType;
    }

    public get parentNodeId(): NodeId | undefined {
        const parent = this.parent;
        return parent ? parent.nodeId : undefined;
    }

    /**
     * namespace index
     */
    public get namespaceIndex(): number {
        return this.nodeId.namespace;
    }

    /**
     * namespace uri
     */
    public get namespaceUri(): string {
        return this.addressSpace.getNamespaceUri(this.namespaceIndex);
    }

    /**
     * the parent node
     */
    public get parent(): BaseNode | null {
        const _private = BaseNode_getPrivate(this);
        if (_private._parent === undefined) {
            // never been set before
            _private._parent = _setup_parent_item.call(this, _private._referenceIdx);
        }
        return _private._parent || null;
    }

    /**
     * @property modellingRule
     * @type {String|undefined}
     */
    public get modellingRule(): ModellingRuleType | undefined {
        const r = this.findReferencesAsObject("HasModellingRule");
        if (!r || r.length === 0) {
            return null; /// "? modellingRule missing ?"; // consider "Mandatory"
        }
        const r0 = r[0];
        return r0.browseName.toString() as ModellingRuleType | undefined;
    }

    public readonly nodeClass: NodeClass = NodeClass.Unspecified;
    public readonly nodeId: NodeId;
    public readonly browseName: QualifiedName;

    protected _postInstantiateFunc?: (instance: BaseNode, instanceType: BaseNode, options?: unknown) => void;

    /**
     * @internal
     * @param options
     */
    constructor(options: InternalBaseNodeOptions) {
        super();

        assert(this.nodeClass === NodeClass.Unspecified, "must not be specify a nodeClass");
        assert(options.addressSpace); // expecting an address space
        assert(options.browseName instanceof QualifiedName, "Expecting a valid QualifiedName");
        assert(options.nodeId instanceof NodeId, "Expecting a valid NodeId");
        options.references = options.references || [];

        const _private = BaseNode_initPrivate(this);
        _private.__address_space = options.addressSpace;

        this.nodeId = options.nodeId instanceof NodeId ? options.nodeId : resolveNodeId(options.nodeId);

        // QualifiedName
        /**
         * the node browseName
         * @property browseName
         * @type QualifiedName
         * @static
         */
        this.browseName = _get_QualifiedBrowseName(options.browseName);

        // re-use browseName as displayName if displayName is missing
        options.displayName = options.displayName || this.browseName.name?.toString();

        if (options.description === undefined) {
            options.description = null;
        }
        this._setDisplayName(options.displayName || "");

        this._setDescription(options.description);

        // user defined filter function for browsing
        const _browseFilter = options.browseFilter || defaultBrowseFilterFunc;
        assert(typeof _browseFilter === "function");

        _private._browseFilter = _browseFilter;

        // normalize reference type
        // this will convert any referenceType expressed with its inverseName into
        // its normal name and fix the isForward flag accordingly.
        // ( e.g "ComponentOf" isForward:true => "HasComponent", isForward:false)
        for (const reference of options.references) {
            this.__addReference(reference, false);
        }
        // the cache was empty to start with; one clear covers every reference just added
        this._clear_caches();

        this._accessRestrictions = options.accessRestrictions;
        this._rolePermissions = coerceRolePermissions(options.rolePermissions);

        // make `parent.<thisName>` resolve to this node: through a getter shared by every node when
        // a nodeset is loading (defined in one batch by the loader, see flushSharedChildAccessors),
        // through the own accessor installed by install_extra_properties otherwise
        // (see child_accessors.ts for why the two paths exist)
        _private._accessorName = registerChildName(this.browseName.name, options.addressSpace.suspendBackReference);
    }

    public getDisplayName(_locale?: string): string {
        return this.displayName[0].text || "";
    }

    public get namespace(): INamespace {
        return this.addressSpacePrivate.getNamespace(this.nodeId.namespace);
    }

    // ---------------------------------------------------------------------------------------------------
    // Finders
    // ---------------------------------------------------------------------------------------------------

    public findReferencesEx(referenceType: string | NodeId | UAReferenceType, browseDirection?: BrowseDirection): UAReference[] {
        browseDirection = browseDirection !== undefined ? browseDirection : BrowseDirection.Forward;
        assert(_is_valid_BrowseDirection(browseDirection));
        assert(browseDirection !== BrowseDirection.Both);

        const referenceTypeNode = this._coerceReferenceType(referenceType);

        if (!referenceTypeNode) {
            // note: when loading nodeset2.xml files, reference type may not exit yet
            // throw new Error("expecting valid reference name " + strReference);
            return [];
        }

        const isForward = browseDirection === BrowseDirection.Forward;
        const _private = BaseNode_getPrivate(this);

        // Memoized per reference type and direction, on the nodes where a scan is worth remembering:
        // a scan touches every reference of the node and runs checkHasSubtype on each, and the same
        // question is asked over and over (every child lookup, every browse) of folders, types and
        // the Server object. A leaf variable holds three references; scanning them costs less than
        // the map would, and a model with a hundred thousand of them cannot afford one map each.
        // The memo goes with the rest of _cache whenever a reference is added or removed, and when
        // a reference type was created since it was built.
        const memoize = _private._referenceIdx.size + _private._back_referenceIdx.size > referenceScanMemoThreshold;
        let entry: [UAReference[] | undefined, UAReference[] | undefined] | undefined;
        const slot = isForward ? 0 : 1;
        if (memoize) {
            const _cache = BaseNode_getCache(this);
            if (_cache._refExVersion !== referenceTypeVersion.count) {
                _cache._refEx = undefined;
                _cache._refExVersion = referenceTypeVersion.count;
            }
            if (!_cache._refEx) {
                _cache._refEx = new Map();
            }
            entry = _cache._refEx.get(referenceTypeNode);
            if (!entry) {
                entry = [undefined, undefined];
                _cache._refEx.set(referenceTypeNode, entry);
            }
            const memoized = entry[slot];
            if (memoized) {
                return memoized;
            }
        }

        const results: UAReference[] = [];
        const addressSpace = this.addressSpace;
        const process = (referenceIdx: Map<ReferenceKey, UAReference>) => {
            for (const ref of referenceIdx.values()) {
                if (ref.isForward === isForward && referenceTypeNode.checkHasSubtype(ref.referenceType)) {
                    // callers read ref.node: resolved here, once per reference, for the references a
                    // load left unresolved (the end-of-load sweep no longer visits every one)
                    if (!(ref as ReferenceImpl).node) {
                        resolveReferenceNode(addressSpace, ref);
                    }
                    results.push(ref);
                }
            }
        };
        process(_private._referenceIdx);
        process(_private._back_referenceIdx);
        if (entry) {
            // callers iterate the result, they never change it; make a regression loud when debugging
            entry[slot] = doDebug ? (Object.freeze(results) as UAReference[]) : results;
        }
        return results;
    }

    public findReferences_no_cache(referenceTypeNode: UAReferenceType, isForward = true): UAReference[] {
        const _private = BaseNode_getPrivate(this);
        const result: UAReference[] = [];
        const addressSpace = this.addressSpace;
        const keep = (ref: UAReference) => {
            if (ref.isForward === isForward && sameNodeId(ref.referenceType, referenceTypeNode.nodeId)) {
                if (!(ref as ReferenceImpl).node) {
                    resolveReferenceNode(addressSpace, ref);
                }
                result.push(ref);
            }
        };
        for (const ref of _private._referenceIdx.values()) {
            keep(ref);
        }
        for (const ref of _private._back_referenceIdx.values()) {
            keep(ref);
        }
        return result;
    }

    public findReferences(referenceType: string | NodeId | UAReferenceType, isForward = true): UAReference[] {
        const _cache = BaseNode_getCache(this);
        const referenceTypeNode = this._coerceReferenceType(referenceType);
        if (!referenceTypeNode) {
            // note: when loading nodeset2.xml files, reference type may not exit yet
            // throw new Error("expecting valid reference name " + strReference);
            return [];
        }

        _cache._ref = _cache._ref || new Map();

        const hash = `r|${referenceTypeNode.nodeId.toString()}|${isForward ? "f" : "b"}`;

        if (_cache._ref.has(hash)) {
            return _cache._ref.get(hash) || [];
        }
        // c8 ignore next
        if (doDebug && !this.addressSpace.findReferenceType(referenceTypeNode.nodeId)) {
            throw new Error(`expecting valid reference name ${referenceType}`);
        }
        const result = this.findReferences_no_cache(referenceTypeNode, isForward);
        _cache._ref.set(hash, result);
        return result;
    }

    public findReference(strReference: string | NodeId | UAReferenceType, isForward?: boolean): UAReference | null {
        const refs = this.findReferences(strReference, isForward);
        if (refs.length !== 1 && refs.length !== 0) {
            throw new Error("findReference: expecting only one or zero element here");
        }
        return refs[0] || null;
    }

    public findReferencesExAsObject(
        referenceType: string | NodeId | UAReferenceType,
        browseDirection?: BrowseDirection
    ): BaseNode[] {
        const references = this.findReferencesEx(referenceType, browseDirection);
        return _asObject<BaseNode>(references, this.addressSpace);
    }

    public findReferencesAsObject(referenceType: string | NodeId | UAReferenceType, isForward?: boolean): BaseNode[] {
        const references = this.findReferences(referenceType, isForward);
        return _asObject<BaseNode>(references, this.addressSpace);
    }

    /**
     * return an array with the Aggregates of this object.
     */
    public getAggregates(): BaseNode[] {
        return this.findReferencesExAsObject("Aggregates", BrowseDirection.Forward);
    }

    /**
     * return an array with the components of this object.
     */
    public getComponents(): BaseNode[] {
        return this.findReferencesExAsObject("HasComponent", BrowseDirection.Forward);
    }

    /**
     *  return a array with the properties of this object.
     */
    public getProperties(): BaseNode[] {
        return this.findReferencesExAsObject("HasProperty", BrowseDirection.Forward);
    }

    private static _hasChild: NodeId = new NodeId(NodeIdType.NUMERIC, ReferenceTypeIds.HasChild);
    public getChildren(): BaseNode[] {
        // return this.findReferencesExAsObject(BaseNodeImpl._hasChild, BrowseDirection.Forward);
        const _cache = BaseNode_getCache(this);
        if (!_cache._children) {
            _cache._children = this.findReferencesExAsObject(BaseNodeImpl._hasChild, BrowseDirection.Forward);
        }
        return _cache._children;
    }

    /**
     * return a array with the notifiers of this object.
     * only reference of exact type HasNotifier are returned.
     */
    public getNotifiers(): BaseNode[] {
        return this.findReferencesAsObject(HasNotifierReferenceType, true);
    }

    /**
     * return a array with the event source of this object.
     *  only reference of exact type HasEventSource are returned.
     */
    public getEventSources(): BaseNode[] {
        return this.findReferencesAsObject(HasEventSourceReferenceType, true);
    }

    /**
     * return a array of the objects for which this node is an EventSource
     */
    public getEventSourceOfs(): BaseNode[] {
        return this.findReferencesAsObject(HasEventSourceReferenceType, false);
    }

    /**
     * the children of this node named `browseName` reached through a reference of type
     * `referenceType` or a subtype of it, read from the child index rather than by scanning the
     * references of the node again
     */
    private _selectChildren(browseName: QualifiedNameLike, namespaceIndex: number | undefined, referenceType: NodeId): BaseNode[] {
        const references = _select_by_browse_name(_get_HierarchicalReference(this), browseName, namespaceIndex);
        if (references.length === 0) {
            return [];
        }
        const referenceTypeNode = this.addressSpace.findReferenceType(referenceType);
        if (!referenceTypeNode) {
            return [];
        }
        const selected: BaseNode[] = [];
        for (const reference of references) {
            if (referenceTypeNode.checkHasSubtype(reference.referenceType)) {
                const node = ReferenceImpl.resolveReferenceNode(this.addressSpace, reference);
                if (node) {
                    selected.push(node);
                }
            }
        }
        if (selected.length > 1 && typeof browseName === "string" && (namespaceIndex === null || namespaceIndex === undefined)) {
            warningLog("Multiple children exist with name ", browseName, " please specify a namespace index");
        }
        return selected;
    }

    /**
     * retrieve a component by name
     */
    public getComponentByName(browseName: QualifiedNameOptions): UAVariable | UAObject | null;
    public getComponentByName(browseName: string, namespaceIndex?: number): UAVariable | UAObject | null;
    public getComponentByName(browseName: QualifiedNameLike, namespaceIndex?: number): UAVariable | UAObject | null {
        const select = this._selectChildren(browseName, namespaceIndex, HasComponentReferenceType);
        assert(select.length <= 1, "BaseNode#getComponentByName found duplicated reference");
        if (select.length === 1) {
            const component = select[0];
            if (component.nodeClass === NodeClass.Method) {
                warningLog("please use getMethodByName to retrieve a method");
                return null;
            }
            assert(component.nodeClass === NodeClass.Variable || component.nodeClass === NodeClass.Object);
            return component as unknown as UAVariable | UAObject;
        } else {
            return null;
        }
    }

    /**
     * retrieve a property by name
     */
    public getPropertyByName(browseName: QualifiedNameOptions): UAVariable | null;
    public getPropertyByName(browseName: string, namespaceIndex?: number): UAVariable | null;
    public getPropertyByName(browseName: QualifiedNameLike, namespaceIndex?: number): UAVariable | null {
        const select = this._selectChildren(browseName, namespaceIndex, HasPropertyReferenceType);
        assert(select.length <= 1, "BaseNode#getPropertyByName found duplicated reference");
        if (select.length === 1 && select[0].nodeClass !== NodeClass.Variable) {
            throw new Error("Expecting a property to be of nodeClass==NodeClass.Variable");
        }
        return select.length === 1 ? (select[0] as unknown as UAVariable) : null;
    }

    /**
     * retrieve a folder element by name
     */
    public getFolderElementByName(browseName: QualifiedNameOptions): BaseNode | null;
    public getFolderElementByName(browseName: string, namespaceIndex?: number): BaseNode | null;
    public getFolderElementByName(browseName: QualifiedNameLike, namespaceIndex?: number): BaseNode | null {
        const select = this._selectChildren(browseName, namespaceIndex, OrganizesReferenceType);
        return select.length === 1 ? select[0] : null;
    }

    /**
     * returns the list of nodes that this folder object organizes
     */
    public getFolderElements(): BaseNodeImpl[] {
        return this.findReferencesExAsObject("Organizes", BrowseDirection.Forward) as BaseNodeImpl[];
    }

    /**
     * returns the list of methods that this object provides
     * @return an array with Method objects.
     *
     *
     * Note: internally, methods are special types of components
     */
    public getMethods(): UAMethod[] {
        const components = this.getComponents();
        return components.filter((obj) => obj.nodeClass === NodeClass.Method) as UAMethod[];
    }

    /**
     * returns the method exposed by this object and with the given nodeId
     */
    public getMethodById(nodeId: NodeId): UAMethod | null {
        const methods = this.getMethods();
        const found = methods.find((m: UAMethod) => m.nodeId.toString() === nodeId.toString());
        return found || null;
    }

    public getMethodByName(methodName: QualifiedNameOptions): UAMethod | null;
    public getMethodByName(methodName: string, namespaceIndex?: number): UAMethod | null;
    public getMethodByName(methodName: QualifiedNameLike, namespaceIndex?: number): UAMethod | null {
        // methods are components of a special node class
        const select = this._selectChildren(methodName, namespaceIndex, HasComponentReferenceType).filter(
            (node) => node.nodeClass === NodeClass.Method
        );
        assert(select.length <= 1, "BaseNode#getMethodByName found duplicated reference");
        return select.length === 1 ? (select[0] as UAMethod) : null;
    }

    public getWriteMask(): number {
        return 0;
    }

    public getUserWriteMask(): number {
        return 0;
    }
    public readAttribute(
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue {
        indexRange;
        dataEncoding;
        assert(!context || context instanceof SessionContext);
        const options: Record<string, unknown> = {};
        options.statusCode = StatusCodes.Good;

        switch (attributeId) {
            case AttributeIds.NodeId: // NodeId
                options.value = { dataType: DataType.NodeId, value: this.nodeId };
                break;

            case AttributeIds.NodeClass: // NodeClass
                assert(Number.isFinite(this.nodeClass));
                options.value = { dataType: DataType.Int32, value: this.nodeClass };
                break;

            case AttributeIds.BrowseName: // QualifiedName
                assert(this.browseName instanceof QualifiedName);
                options.value = { dataType: DataType.QualifiedName, value: this.browseName };
                break;

            case AttributeIds.DisplayName: // LocalizedText
                options.value = { dataType: DataType.LocalizedText, value: this.displayName[0] };
                break;

            case AttributeIds.Description: // LocalizedText
                options.value = { dataType: DataType.LocalizedText, value: this.description };
                break;

            case AttributeIds.WriteMask:
                options.value = { dataType: DataType.UInt32, value: this.getWriteMask() };
                break;

            case AttributeIds.UserWriteMask:
                options.value = { dataType: DataType.UInt32, value: this.getUserWriteMask() };
                break;

            case AttributeIds.AccessRestrictions:
                return this._readAccessRestrictions(context);

            case AttributeIds.RolePermissions:
                return this._readRolePermissions(context);

            case AttributeIds.UserRolePermissions:
                return this._readUserRolePermissions(context);

            default:
                options.value = null;
                options.statusCode = StatusCodes.BadAttributeIdInvalid;
                break;
        }
        // xx options.serverTimestamp = new Date();
        return new DataValue(options);
    }

    public writeAttribute(
        context: ISessionContext | null,
        writeValue: WriteValueOptions,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void {
        context = context || SessionContext.defaultContext;

        assert(context instanceof SessionContext);
        assert(typeof callback === "function");

        if (
            writeValue.attributeId === undefined ||
            writeValue.attributeId <= 0 ||
            writeValue.attributeId > AttributeIds.AccessLevelEx
        ) {
            callback(null, StatusCodes.BadAttributeIdInvalid);
            return;
        }
        if (!this.canUserWriteAttribute(context, writeValue.attributeId)) {
            callback(null, StatusCodes.BadUserAccessDenied);
            return;
        }
        // by default Node is read-only,
        // this method needs to be overridden to change the behavior
        callback(null, StatusCodes.BadNotWritable);
    }

    public fullName(): string {
        if (this.parentNodeId) {
            const parent = this.addressSpace.findNode(this.parentNodeId) as BaseNode;

            // c8 ignore next
            if (parent) {
                return `${parent.fullName()}.${this.browseName.toString()}`;
            } else {
                return `NOT YET REGISTERED${this.parentNodeId.toString()}.${this.browseName.toString()}`;
            }
        }
        return this.browseName.toString();
    }

    public ownReferences(): UAReference[] {
        const _private = BaseNode_getPrivate(this);
        return [..._private._referenceIdx.values()];
    }

    /**
     *
     * @param relativePathElement
     * @param isLast
     * @return {NodeId[]}
     */
    public browseNodeByTargetName(relativePathElement: RelativePathElement, isLast: boolean): NodeId[] {
        relativePathElement.targetName = relativePathElement.targetName || new QualifiedName({});
        // part 4.0 v1.03 $7.26 RelativePath
        // The BrowseName of the target node.
        // The final element may have an empty targetName. In this situation all targets of the references identified by
        // the referenceTypeId are the targets of the RelativePath.
        // The targetName shall be specified for all other elements.
        // The current path cannot be followed any further if no targets with the specified BrowseName exist.
        assert(relativePathElement.targetName instanceof QualifiedName);
        assert(relativePathElement.targetName.namespaceIndex >= 0);
        assert((relativePathElement.targetName.name?.length || 0) > 0);

        // The type of reference to follow from the current node.
        // The current path cannot be followed any further if the referenceTypeId is not available on the Node instance.
        // If not specified then all References are included and the parameter includeSubtypes is ignored.
        assert(Object.hasOwn(relativePathElement, "referenceTypeId"));

        // Indicates whether the inverse Reference should be followed.
        // The inverse reference is followed if this value is TRUE.
        assert(Object.hasOwn(relativePathElement, "isInverse"));

        // Indicates whether subtypes of the ReferenceType should be followed.
        // Subtypes are included if this value is TRUE.
        assert(Object.hasOwn(relativePathElement, "includeSubtypes"));

        // A forward step naming its target through a hierarchical reference type, the shape of
        // almost every TranslateBrowsePath element, is a lookup in the child index rather than a
        // scan of every reference of the node; the filter below still applies to what it finds.
        const references = this._hierarchicalStepCandidates(relativePathElement) ?? this.allReferences();

        const _check_reference = (reference: UAReference) => {
            if (relativePathElement.referenceTypeId.isEmpty()) {
                return true;
            }
            assert(relativePathElement.referenceTypeId instanceof NodeId);
            if (
                (relativePathElement.isInverse && reference.isForward) ||
                (!relativePathElement.isInverse && !reference.isForward)
            ) {
                return false;
            }
            assert(Object.hasOwn(reference, "isForward"));
            const referenceType = resolveReferenceType(this.addressSpace, reference);
            const referenceTypeId = referenceType.nodeId;

            if (sameNodeId(relativePathElement.referenceTypeId, referenceTypeId)) {
                return true;
            }
            if (relativePathElement.includeSubtypes) {
                const baseType = this.addressSpace.findReferenceType(relativePathElement.referenceTypeId);
                if (baseType && referenceType.isSubtypeOf(baseType)) {
                    return true;
                }
            }
            return false;
        };

        const nodeIdsMap: Record<string, BaseNode> = {};
        let nodeIds: NodeId[] = [];

        for (const reference of references) {
            if (!_check_reference(reference)) {
                continue;
            }

            const obj = resolveReferenceNode(this.addressSpace, reference);

            // c8 ignore next
            if (!obj) {
                throw new Error(` cannot find node with id ${reference.nodeId.toString()}`);
            }

            if (isEqual(obj.browseName, relativePathElement.targetName)) {
                // compare QualifiedName

                const key = obj.nodeId.toString();
                if (!Object.hasOwn(nodeIdsMap, key)) {
                    nodeIds.push(obj.nodeId);
                    nodeIdsMap[key] = obj;
                }
            }
        }

        if (nodeIds.length === 0 && (this.nodeClass === NodeClass.ObjectType || this.nodeClass === NodeClass.VariableType)) {
            const nodeType = this as unknown as UAVariableType;

            if (nodeType.subtypeOf) {
                // browsing also InstanceDeclarations included in base type
                const baseType = this.addressSpace.findNode(nodeType.subtypeOf) as BaseNode;
                const n = (baseType as BaseNodeImpl).browseNodeByTargetName(relativePathElement, isLast);
                nodeIds = ([] as NodeId[]).concat(nodeIds, n);
            }
        }
        return nodeIds;
    }

    /**
     * the references of this node that can answer a relative path element, taken from the child
     * index, or null when the element is one the index cannot answer (an inverse step, an
     * unspecified or non-hierarchical reference type, no target name)
     */
    private _hierarchicalStepCandidates(relativePathElement: RelativePathElement): UAReference[] | null {
        const targetName = relativePathElement.targetName;
        if (relativePathElement.isInverse || !targetName?.name || relativePathElement.referenceTypeId.isEmpty()) {
            return null;
        }
        const wellKnown = wellKnownReferenceTypes(this.addressSpace);
        const referenceType = this.addressSpace.findReferenceType(relativePathElement.referenceTypeId);
        if (!wellKnown || !referenceType) {
            return null;
        }
        if (referenceType !== wellKnown.hierarchicalReferences && !referenceType.isSubtypeOf(wellKnown.hierarchicalReferences)) {
            return null;
        }
        return _select_by_browse_name(_get_HierarchicalReference(this), targetName, targetName.namespaceIndex);
    }

    /**
     * browse the node to extract information requested in browseDescription
     * and returns an array with reference descriptions
     *
     *
     *
     */
    public browseNode(browseDescription: BrowseDescriptionOptions2, context?: ISessionContext): ReferenceDescription[] {
        assert(Number.isFinite(browseDescription.nodeClassMask));

        const do_debug = false;

        const _private = BaseNode_getPrivate(this);

        const addressSpace = this.addressSpace;

        const referenceTypeId = normalize_referenceTypeId(addressSpace, browseDescription.referenceTypeId);
        assert(referenceTypeId instanceof NodeId);

        const browseDirection =
            browseDescription.browseDirection !== undefined ? browseDescription.browseDirection : BrowseDirection.Both;

        // get all possible references
        let references = this.allReferences();

        /* c8 ignore next */
        if (do_debug) {
            // c8 ignore next
            doDebug && debugLog("all references :", this.nodeId.toString(), this.browseName.toString());
            dumpReferences(addressSpace, _private._referenceIdx.values());
        }

        // filter out references not matching referenceType
        references = _filter_by_referenceType.call(this, browseDescription, references, referenceTypeId);

        references = _filter_by_direction(references, browseDirection);

        references = _filter_by_nodeClass.call(this, references, browseDescription.nodeClassMask);

        references = _filter_by_userFilter.call(this, references, context);

        if (context) {
            references = _filter_by_context(this, references, context);
        }
        const referenceDescriptions = _constructReferenceDescription(addressSpace, references, browseDescription.resultMask);

        /* c8 ignore next */
        if (do_debug) {
            dumpReferenceDescriptions(this.addressSpace, referenceDescriptions);
        }

        return referenceDescriptions;
    }

    public allReferences(): UAReference[] {
        const _private = BaseNode_getPrivate(this);
        const references = [..._private._referenceIdx.values(), ..._private._back_referenceIdx.values()];
        const addressSpace = this.addressSpace;
        for (const ref of references) {
            if (!(ref as ReferenceImpl).node) {
                resolveReferenceNode(addressSpace, ref);
            }
        }
        return references;
    }

    /**
     * @param reference
     * @param reference.referenceType {String}
     * @param [reference.isForward = true] {Boolean}
     * @param reference.nodeId {Node|NodeId|String}
     *
     * @example
     *
     *     view.addReference({ referenceType: "Organizes", nodeId: myDevice });
     *
     * or
     *
     *     myDevice1.addReference({ referenceType: "OrganizedBy", nodeId: view });
     */
    public addReference(reference: AddReferenceOpts): void {
        const referenceNode = this.__addReference(reference);
        const addressSpace = this.addressSpace;

        if (!resolveReferenceType(addressSpace, referenceNode)) {
            throw new Error(`BaseNode#addReference : invalid reference  ${reference.toString()}`);
        }

        _propagate_ref.call(this, addressSpace, referenceNode);
        this.install_extra_properties();
        _handle_add_reference_change_event(this, referenceNode.nodeId);
    }

    public removeReference(referenceOpts: AddReferenceOpts): void {
        const _private = BaseNode_getPrivate(this);

        assert(Object.hasOwn(referenceOpts, "referenceType"));
        // xx isForward is optional : assert(Object.prototype.hasOwnProperty.call(reference,"isForward"));
        assert(Object.hasOwn(referenceOpts, "nodeId"));

        const addressSpace = this.addressSpace as AddressSpacePrivate;

        const reference = addressSpace.normalizeReferenceTypes([referenceOpts])?.[0];
        const h = (<ReferenceImpl>reference).key(addressSpace);

        const relatedNode = addressSpace.findNode(reference.nodeId);

        // c8 ignore next
        if (!relatedNode) {
            return;
        }

        const backwardReference = new ReferenceImpl({
            isForward: !reference.isForward,
            nodeId: this.nodeId,
            referenceType: reference.referenceType
        });

        if (_private._referenceIdx.has(h)) {
            _private._referenceIdx.delete(h);
            BaseNode_remove_backward_reference.call(relatedNode as BaseNodeImpl, backwardReference);
            _remove_HierarchicalReference(this, reference);
            this.uninstall_extra_properties(reference);
            this._clear_caches();
        } else if (_private._back_referenceIdx.has(h)) {
            relatedNode.removeReference(backwardReference);
        } else {
            // A back reference of a massively used type was never installed: _propagate_ref
            // skips HasTypeDefinition and HasModellingRule deliberately, "because there are
            // too many". Removal has to mirror that, or detaching any node asks its type
            // definition to drop a reference it never held - which is where the hundred-odd
            // "Cannot find reference to remove: ns=0;i=40" lines per run came from. The
            // absence is the designed state, not a fault worth reporting.
            const referenceType = resolveReferenceType(addressSpace, reference);
            if (!reference.isForward && referenceType && _is_massively_used_reference(referenceType)) {
                return;
            }
            warningLog(`Cannot find reference to remove: ${reference.toString()}`);
        }
    }

    /**
     *
     */
    public resolveNodeId(nodeId: NodeIdLike): NodeId {
        return this.addressSpace.resolveNodeId(nodeId);
    }

    /**
     * Expose the hierarchical children of this node as properties of this node, and this node as
     * a property of its parents, for the browse names that have no shared accessor.
     *
     * A node created while a nodeset loads needs nothing here: its name got a getter on the
     * prototype (see child_accessors.ts). This is the path for nodes created afterwards through the
     * namespace API, whose browse names may be anything and must not touch the prototype.
     */
    public install_extra_properties(): void {
        const addressSpace = this.addressSpace;
        if (addressSpace.isFrugal) {
            return;
        }
        const wellKnown = wellKnownReferenceTypes(addressSpace);
        if (!wellKnown) {
            return; // namespace 0 is still loading
        }
        const { hasChild, hasComponent, hasProperty, organizes } = wellKnown;
        const self = this as BaseNode;
        const visit = (reference: UAReference) => {
            if (reference.isForward) {
                if (hasChild.checkHasSubtype(reference.referenceType) || organizes.checkHasSubtype(reference.referenceType)) {
                    install_child_as_object_property(self, resolveReferenceNode(addressSpace, reference));
                }
            } else if (
                hasComponent.checkHasSubtype(reference.referenceType) ||
                hasProperty.checkHasSubtype(reference.referenceType) ||
                organizes.checkHasSubtype(reference.referenceType)
            ) {
                // Only this node is new, so only this node has to appear on the parent.
                // Re-walking every child the parent already has made building a folder
                // of N children cost O(N^2) - measured at 7.2s for 3000 children.
                install_child_as_object_property(resolveReferenceNode(addressSpace, reference), self);
            }
        };
        const _private = BaseNode_getPrivate(this);
        for (const reference of _private._referenceIdx.values()) {
            visit(reference);
        }
        for (const reference of _private._back_referenceIdx.values()) {
            visit(reference);
        }
    }

    /**
     * undo install_extra_properties for one reference, on both ends when it is an inverse one
     */
    public uninstall_extra_properties(reference: UAReference): void {
        const addressSpace = this.addressSpace;
        if (addressSpace.isFrugal) {
            return;
        }
        if (!reference.isForward) {
            const parentNode = resolveReferenceNode(addressSpace, reference);
            if (parentNode) {
                (parentNode as BaseNodeImpl).uninstall_extra_properties({
                    isForward: true,
                    nodeId: this.nodeId,
                    referenceType: reference.referenceType
                });
            }
        }
        const childNode = resolveReferenceNode(addressSpace, reference);
        if (childNode) {
            uninstall_child_object_property(this, childNode);
        }
    }

    public toString(): string {
        const options = new ToStringBuilder();
        BaseNode_toString.call(this, options);
        return options.toString();
    }

    public toJSON(): Record<string, unknown> {
        return {
            nodeId: this.nodeId.toString(),
            nodeClass: NodeClass[this.nodeClass],
            browseName: this.browseName.toString(),
            displayName: this.displayName.length ? this.displayName[0].text : ""
        };
    }

    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return this.toString();
    }

    /**
     * @property isFalseSubStateOf
     * @type {BaseNode|null}
     */
    public get isFalseSubStateOf(): BaseNode | null {
        const r = this.findReferencesAsObject("HasFalseSubState", false);
        if (!r || r.length === 0) {
            return null;
        }
        assert(r.length === 1);
        return r[0];
    }

    /**
     * @property isTrueSubStateOf
     * @type {BaseNode|null}
     */
    public get isTrueSubStateOf(): BaseNode | null {
        const r = this.findReferencesAsObject("HasTrueSubState", false);
        if (!r || r.length === 0) {
            return null;
        }
        assert(r.length === 1);
        return r[0] as BaseNode;
    }

    /**
     * @return {UAStateVariable[]} return an array with the SubStates of this object.
     */
    public getFalseSubStates(): UAStateVariable<LocalizedText>[] {
        return this.findReferencesAsObject("HasFalseSubState") as UAStateVariable<LocalizedText>[];
    }

    /**

     * @return {UAStateVariable[]} return an array with the SubStates of this object.
     */
    public getTrueSubStates(): UAStateVariable<LocalizedText>[] {
        return this.findReferencesAsObject("HasTrueSubState") as UAStateVariable<LocalizedText>[];
    }

    public findHierarchicalReferences(): UAReference[] {
        return this.findReferencesEx("HierarchicalReferences", BrowseDirection.Forward);
    }

    public getChildByName(browseName: QualifiedNameOptions): BaseNode | null;
    public getChildByName(browseName: string, namespaceIndex?: number): BaseNode | null;
    //
    public getChildByName(browseName: QualifiedNameLike, namespaceIndex?: number): BaseNode | null {
        var childrenMap = _get_HierarchicalReference(this);
        const select = _select_by_browse_name(childrenMap, browseName, namespaceIndex);
        if (select.length === 0) {
            return null;
        }
        const ref = select[0];
        const r = this.addressSpace.findReferenceType(ref.referenceType);
        if (!r) return null;
        const hasChild = this.addressSpace.findReferenceType("HasChild");
        if (!hasChild) {
            return null; // too early, bmy be namespace 0 is still loading
        }
        if (r.isSubtypeOf(hasChild)) {
            return ref.node || null;
        }
        return null;
    }
    public getNodeVersion(): UAProperty<UAString, DataType.String> | null {
        return this.getChildByName("NodeVersion", 0) as UAProperty<UAString, DataType.String> | null;
        /*
        const cache = BaseNode_getCache(this);
        if (cache._versionNode == undefined) {
            cache._versionNode = this.getChildByName("NodeVersion", 0) as UAProperty<string, DataType.String> | null;
        }
        return cache._versionNode as UAProperty<UAString, DataType.String> | null;
        */
    }

    public get nodeVersion(): UAProperty<UAString, DataType.String> | undefined {
        return this.getNodeVersion() || undefined;
    }
    public set nodeVersion(_n: unknown) {
        assert(false);
    }

    get toStateNode(): BaseNode | null {
        const nodes = this.findReferencesAsObject("ToState", true);
        assert(nodes.length <= 1);
        return nodes.length === 1 ? nodes[0] : null;
    }

    get fromStateNode(): BaseNode | null {
        const nodes = this.findReferencesAsObject("FromState", true);
        assert(nodes.length <= 1);
        return nodes.length === 1 ? nodes[0] : null;
    }

    /**
     * this methods propagates the forward references to the pointed node
     * by inserting backward references to the counter part node
     * @private
     */
    public propagate_back_references(): void {
        this._propagate_back_references(undefined);
    }

    /**
     * propagate_back_references for a node a NodeSet2 file declared: its references may be held
     * by their target as well, so each is looked up there before a back reference is built
     */
    public propagate_back_references_declared_from_both_ends(): void {
        this._propagate_back_references(nodeIdKey(this.nodeId));
    }

    /** one reference of a node a NodeSet2 file declared, see propagate_back_references_declared_from_both_ends */
    public propagate_back_reference_declared_from_both_ends(reference: UAReference): void {
        if ((this.addressSpace as AddressSpacePrivate).suspendBackReference) {
            return;
        }
        _propagate_ref.call(this, this.addressSpace, reference, nodeIdKey(this.nodeId));
    }

    private _propagate_back_references(sourceNodeKey: number | string | undefined): void {
        const _private = BaseNode_getPrivate(this);
        if ((this.addressSpace as AddressSpacePrivate).suspendBackReference) {
            // this indicates that the base node is constructed from an xml definition
            // propagate_back_references will be called later once the file has been completely processed.
            return;
        }
        const addressSpace = this.addressSpace;
        for (const reference of _private._referenceIdx.values()) {
            _propagate_ref.call(this, addressSpace, reference, sourceNodeKey);
        }
    }

    /**
     * the dispose method should be called when the node is no longer used, to release
     * back pointer to the address space and clear caches.
     *
     * @private
     */
    public dispose(): void {
        (this as BaseNode).emit("dispose");

        this.removeAllListeners();
        this._clear_caches();

        const _private = BaseNode_getPrivate(this);
        for (const ref of _private._back_referenceIdx.values()) {
            (ref as ReferenceImpl).dispose();
        }

        for (const ref of _private._referenceIdx.values()) {
            (ref as ReferenceImpl).dispose();
        }

        BaseNode_removePrivate(this);
    }

    public isDisposed(): boolean {
        return !this.addressSpacePrivate;
    }

    // c8 ignore next
    public dumpXML(xmlWriter: XmlWriter): void {
        console.error(" This ", NodeClass[this.nodeClass]);
        assert(false, "BaseNode#dumpXML NOT IMPLEMENTED !");
        assert(xmlWriter);
    }

    /**
     * Undo the effect of propagate_back_references
     */
    public unpropagate_back_references(): void {
        const _private = BaseNode_getPrivate(this);

        const addressSpace = this.addressSpace;

        for (const reference of _private._referenceIdx.values()) {
            // filter out non  Hierarchical References
            const referenceType = resolveReferenceType(addressSpace, reference);

            // c8 ignore next
            if (!referenceType) {
                console.error(chalk.red(" ERROR"), " cannot find reference ", reference.referenceType, reference.toString());
            }

            const related_node = resolveReferenceNode(addressSpace, reference) as BaseNodeImpl;
            if (related_node) {
                assert(reference.nodeId.toString() !== this.nodeId.toString());
                BaseNode_remove_backward_reference.call(
                    related_node,
                    new ReferenceImpl({
                        isForward: !reference.isForward,
                        nodeId: this.nodeId,
                        referenceType: reference.referenceType
                    })
                );
            } // else addressSpace may be incomplete
        }
    }

    public installPostInstallFunc(f: (instance: BaseNode, tpyeNode: BaseNode, opts?: unknown) => void): void {
        if (!f) {
            // nothing to do
            return;
        }

        function chain(f1: ApplyFunc | undefined, f2: ApplyFunc | undefined) {
            return function chainingFunc(this: BaseNode, ...args: unknown[]) {
                if (f1) {
                    f1.apply(this, args);
                }
                if (f2) {
                    f2.apply(this, args);
                }
            };
        }

        this._postInstantiateFunc = chain.call(this, this._postInstantiateFunc, f);
    }

    public _on_child_added(childNode: BaseNode): void {
        // this._clear_caches();
        // return;
        const cache = BaseNode_getCache(this);
        const tmpV = cache._versionNode;
        const tmpC = cache._children;
        this._clear_caches();
        const newCache = BaseNode_getCache(this);
        newCache._versionNode = tmpV;
        newCache._children = tmpC;
        if (newCache._children) {
            newCache._children?.push(childNode);
        }
    }

    public _on_child_removed(_obj: BaseNode): void {
        // obj; // unused;
        this._clear_caches();
    }

    /**
     * @private
     * @param reference
     */
    public _add_backward_reference(reference: UAReference): void {
        BaseNode_add_backward_reference.call(this, reference);
    }

    protected _coerceReferenceType(referenceType: string | NodeId | UAReferenceType): UAReferenceType | null {
        let result: UAReferenceType | null = null;
        if (typeof referenceType === "string") {
            result = this.addressSpace.findReferenceType(referenceType);
            /* c8 ignore next */
            if (!result) {
                errorLog("referenceType ", referenceType, " cannot be found");
                throw new Error(`Cannot coerce reference with name ${referenceType}`);
            }
        } else if (referenceType instanceof NodeId) {
            result = this.addressSpace.findNode(referenceType) as UAReferenceType;
            if (!result) {
                return null;
            }
        } else {
            result = referenceType;
        }
        assert(result, "reference must exists");
        assert(result.nodeClass === NodeClass.ReferenceType);
        return result as UAReferenceType;
    }

    private __addReference(referenceOpts: AddReferenceOpts, clearCaches = true): UAReference {
        const addressSpace = this.addressSpace as AddressSpacePrivate;
        const _private = BaseNode_getPrivate(this);
        assert(Object.hasOwn(referenceOpts, "referenceType"));
        // xx isForward is optional : assert(Object.prototype.hasOwnProperty.call(reference,"isForward"));
        assert(Object.hasOwn(referenceOpts, "nodeId"));

        const reference: UAReference = addressSpace.normalizeReferenceType(referenceOpts);
        assert(reference instanceof ReferenceImpl);

        const h = (<ReferenceImpl>reference).key(addressSpace);
        assert(!_private._back_referenceIdx.has(h), "reference exists already in _back_references");
        assert(!_private._referenceIdx.has(h), "reference exists already in _references");

        _private._referenceIdx.set(h, reference);
        _handle_HierarchicalReference(this, reference);
        if (clearCaches) {
            this._clear_caches();
        }
        return reference;
    }

    /** kept as given; the LocalizedText objects are built on first read (most nodes are never asked) */
    private _setDisplayName(displayName: LocalizedTextLike | LocalizedTextLike[]) {
        const _private = BaseNode_getPrivate(this);
        _private._displayNameRaw = displayName;
        _private._displayName = undefined;
    }

    private _setDescription(description: LocalizedTextLike | null): void {
        const _private = BaseNode_getPrivate(this);
        _private._descriptionRaw = description;
        _private._description = undefined;
    }

    private _notifyAttributeChange(attributeId: AttributeIds): void {
        const event_name = BaseNodeImpl.makeAttributeEventName(attributeId);
        (this as BaseNode).emit(event_name, this.readAttribute(SessionContext.defaultContext, attributeId));
    }

    private _clear_caches() {
        BaseNode_clearCache(this);
    }

    public canUserWriteAttribute(context: ISessionContext | null, attributeId: AttributeIds): boolean {
        // the Client is allowed to write to Attributes other than the Value,
        // Historizing or RolePermissions Attribute
        if (!context) return true;
        if (attributeId === AttributeIds.Historizing) {
            return context.checkPermission(this as BaseNode, PermissionType.WriteHistorizing);
        }
        if (attributeId === AttributeIds.RolePermissions) {
            return context.checkPermission(this as BaseNode, PermissionType.WriteRolePermissions);
        }
        if (attributeId === AttributeIds.Value) {
            return context.checkPermission(this as BaseNode, PermissionType.Write);
        }
        return context.checkPermission(this as BaseNode, PermissionType.WriteAttribute);
    }

    private _readAccessRestrictions(_context: ISessionContext | null): DataValue {
        // https://reference.opcfoundation.org/v104/Core/docs/Part3/8.56/
        if (this.accessRestrictions === undefined) {
            return new DataValue({ statusCode: StatusCodes.BadAttributeIdInvalid });
        }

        return new DataValue({
            statusCode: StatusCodes.Good,
            value: {
                dataType: DataType.UInt16,
                value: this.accessRestrictions
            }
        });
    }
    private _readRolePermissions(context: ISessionContext | null): DataValue {
        // https://reference.opcfoundation.org/v104/Core/docs/Part3/4.8.3/

        // to do check that current user can read permission
        if (context && !context.checkPermission(this as BaseNode, PermissionType.ReadRolePermissions)) {
            return new DataValue({
                statusCode: StatusCodes.BadSecurityModeInsufficient
            });
        }

        if (this.rolePermissions === undefined) {
            // to do : If not specified, the value of DefaultUserRolePermissions Property from
            // the Namespace Metadata Object associated with the Node is used instead.
            return new DataValue({
                statusCode: StatusCodes.BadAttributeIdInvalid
            });
        }

        const rolePermissions = this.rolePermissions.map(({ roleId, permissions }) => {
            return new RolePermissionType({
                roleId: toRoleNodeId(roleId),
                permissions
            });
        });
        return new DataValue({
            statusCode: StatusCodes.Good,
            value: {
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: rolePermissions
            }
        });
    }

    private _readUserRolePermissions(context: ISessionContext | null): DataValue {
        const allUserCanSeeTheirOwnRolePermissions = true;
        if (!allUserCanSeeTheirOwnRolePermissions) {
            // to do check that current user can read permission
            if (context && !context.checkPermission(this as BaseNode, PermissionType.ReadRolePermissions)) {
                return new DataValue({
                    statusCode: StatusCodes.BadSecurityModeInsufficient
                });
            }
        }

        if (this.rolePermissions === undefined) {
            // to do : If not specified, the value of DefaultUserRolePermissions Property from
            // the Namespace Metadata Object associated with the Node is used instead.
            return new DataValue({
                statusCode: StatusCodes.BadAttributeIdInvalid
            });
        }
        const context1: ISessionContext = context === null ? SessionContext.defaultContext : context;

        // for the time being  get user Permission
        const rolePermissions = this.rolePermissions
            .map(({ roleId, permissions }) => {
                return new RolePermissionType({
                    roleId: toRoleNodeId(roleId),
                    permissions
                });
            })
            .filter(({ roleId }) => context1.currentUserHasRole(roleId));

        return new DataValue({
            statusCode: StatusCodes.Good,
            value: {
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: rolePermissions
            }
        });
    }

    /**
     *
     * @param rolePermissions
     */
    setRolePermissions(rolePermissions: RolePermissionTypeOptions[]): void {
        this._rolePermissions = coerceRolePermissions(rolePermissions);
    }
    getRolePermissions(inherited: boolean): RolePermissionType[] | null {
        if (this.rolePermissions === undefined && inherited) {
            return this.namespace.getDefaultRolePermissions();
        }
        return this._rolePermissions || null;
    }
    get rolePermissions(): RolePermissionType[] | undefined {
        return this._rolePermissions || undefined;
    }

    setAccessRestrictions(accessRestrictions: AccessRestrictionsFlag): void {
        this._accessRestrictions = accessRestrictions;
    }
    get accessRestrictions(): AccessRestrictionsFlag | undefined {
        return this._accessRestrictions;
    }
    getAccessRestrictions(inherited: boolean): AccessRestrictionsFlag {
        if (this._accessRestrictions === undefined && inherited) {
            return this.namespace.getDefaultAccessRestrictions();
        }
        return this._accessRestrictions || AccessRestrictionsFlag.None;
    }
}

function toRoleNodeId(s: NodeIdLike): NodeId {
    if (typeof s === "string") {
        return resolveNodeId(WellKnownRolesNodeId[s as keyof typeof WellKnownRolesNodeId]);
    }
    return coerceNodeId(s);
}

let displayWarning = true;

function toString_ReferenceDescription(ref: UAReference, options: { addressSpace: IAddressSpace }): string {
    const addressSpace = options.addressSpace as AddressSpacePrivate;

    const refNode = addressSpace.findNode(ref.referenceType);
    if (!refNode) {
        return `Unknown Ref : ${ref}`;
    }
    const r = new ReferenceImpl({
        isForward: ref.isForward,
        nodeId: ref.nodeId,
        referenceType: refNode.nodeId
    });
    const str = r.toString(options);
    r.dispose();
    return str;
}

function _setup_parent_item(this: BaseNode, referencesMap: Map<ReferenceKey, UAReference>): BaseNode | null {
    let references: UAReference[] | MapIterator<UAReference> = referencesMap.values();

    const _private = BaseNode_getPrivate(this);
    assert(!_private._parent, "_setup_parent_item has been already called");

    const addressSpace = this.addressSpace;

    if (referencesMap.size > 0) {
        references = this.findReferencesEx("Aggregates", BrowseDirection.Inverse);

        if (references.length >= 1) {
            // c8 ignore next
            if (references.length > 1) {
                if (displayWarning) {
                    const options = { addressSpace };

                    warningLog("  More than one Aggregates reference have been found for parent of object");
                    warningLog("    object node id:", this.nodeId.toString(), chalk.cyan(this.browseName.toString()));
                    warningLog("    browseResults:");
                    warningLog(references.map((f: UAReference) => toString_ReferenceDescription(f, options)).join("\n"));
                    warningLog("    first one will be used as parent");
                    // xx assert(browseResults.length === 1);
                    displayWarning = false;
                }
            }
            return ReferenceImpl.resolveReferenceNode(addressSpace, references[0]);
        }
    }
    return null;
}

function toObject(addressSpace: IAddressSpace, reference: UAReference): BaseNode {
    const obj = resolveReferenceNode(addressSpace, reference);
    // c8 ignore next
    if (doDebug && !obj) {
        // c8 ignore next
        doDebug &&
            debugLog(
                chalk.red(" Warning :  object with nodeId ") +
                    chalk.cyan(reference.nodeId.toString()) +
                    chalk.red(" cannot be found in the address space !")
            );
    }
    return obj;
}

function _asObject<T extends BaseNode>(references: UAReference[], addressSpace: IAddressSpace): T[] {
    return references.map((a) => toObject(addressSpace, a)).filter((o) => !!o) as T[];
}

function _select_by_browse_name(map: HierarchicalIndexMap, browseName: QualifiedNameLike, namespaceIndex?: number): UAReference[] {
    if ((namespaceIndex === null || namespaceIndex === undefined) && typeof browseName === "string") {
        // no namespace specified and needed
        const result = map.get(browseName);
        if (result) {
            if (Array.isArray(result)) {
                return result;
            }
            return [result];
        }
    } else {
        const _browseName = coerceQualifiedName(typeof browseName === "string" ? { name: browseName, namespaceIndex } : browseName);
        // c8 ignore next
        if (!_browseName) {
            return [];
        }
        const result = map.get(_browseName.name || "");
        if (result) {
            if (Array.isArray(result)) {
                // only select the one with the matching namepsace index
                return result.filter((t) => t.node.browseName.namespaceIndex === _browseName.namespaceIndex);
            } else {
                if (result.node.browseName.namespaceIndex === _browseName.namespaceIndex) {
                    return [result];
                }
                return [];
            }
        }
    }
    return [];
}

let displayWarningReferencePointingToItSelf = true;

function _is_massively_used_reference(referenceType: UAReferenceType): boolean {
    const name = referenceType.browseName.toString();
    return name === "HasTypeDefinition" || name === "HasModellingRule";
}

function _propagate_ref(
    this: BaseNode,
    addressSpace: MinimalistAddressSpace,
    reference: UAReference,
    sourceNodeKey?: number | string
): void {
    // filter out non  Hierarchical References
    const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);

    // c8 ignore next
    if (!referenceType) {
        errorLog(chalk.red(" ERROR"), " cannot find reference ", reference.referenceType, reference.toString());
    }

    // ------------------------------- Filter out back reference when reference type
    //                                 is HasTypeDefinition, HasModellingRule, etc ...
    //
    // var referenceNode = Reference.resolveReferenceNode(addressSpace,reference);
    // ignore propagation on back reference to UAVariableType or UAObject Type reference
    // because there are too many !
    if (!referenceType || _is_massively_used_reference(referenceType)) {
        return;
    }

    const related_node = resolveReferenceNode(addressSpace, reference) as BaseNodeImpl;
    if (related_node) {
        // verify that reference doesn't point to object it this (see mantis 3099)
        if (sameNodeId(reference.nodeId, this.nodeId)) {
            // c8 ignore next
            if (displayWarningReferencePointingToItSelf) {
                // this could happen with method
                warningLog(
                    "  Warning: a Reference is pointing to source ",
                    this.nodeId.toString(),
                    this.browseName.toString(),
                    ". Is this intentional ?"
                );
                displayWarningReferencePointingToItSelf = false;
            }
        }

        // NodeSet2 files declare most references from both ends, so the related node usually
        // holds the inverse as a forward reference of its own already: nothing to add, and no
        // ReferenceImpl to build for BaseNode_add_backward_reference to throw away. A node
        // created at runtime rarely is, and BaseNode_add_backward_reference copes when it is.
        if (
            sourceNodeKey !== undefined &&
            BaseNode_getPrivate(related_node)._referenceIdx.has(
                (reference as ReferenceImpl).inverseKey(addressSpace as AddressSpacePrivate, sourceNodeKey)
            )
        ) {
            return;
        }
        (related_node as BaseNodeImpl)._add_backward_reference(
            new ReferenceImpl({
                _referenceType: getReferenceType(reference),
                isForward: !reference.isForward,
                node: this as BaseNode,
                nodeId: this.nodeId,
                referenceType: reference.referenceType
            })
        );
    } // else addressSpace may be incomplete and under construction (while loading a nodeset.xml file for instance)
}

function nodeid_is_nothing(nodeid: NodeId): boolean {
    return nodeid.value === 0 && nodeid.namespace === 0;
}

/**

 * @param addressSpace {IAddressSpace}
 * @param referenceTypeId {String|NodeId|null} : the referenceType either as a string or a nodeId
 * @return {NodeId}
 */
function normalize_referenceTypeId(addressSpace: IAddressSpace, referenceTypeId?: NodeIdLike | null): NodeId {
    if (!referenceTypeId) {
        return makeNodeId(0);
    }
    if (typeof referenceTypeId === "string") {
        const ref = addressSpace.findReferenceType(referenceTypeId);
        if (ref) {
            return ref.nodeId;
        }
    }
    let nodeId: NodeId;
    try {
        nodeId = addressSpace.resolveNodeId(referenceTypeId);
    } catch (err) {
        errorLog("cannot normalize_referenceTypeId", referenceTypeId);
        throw err;
    }
    assert(nodeId);
    return nodeId;
}

const resolveReferenceNode = ReferenceImpl.resolveReferenceNode;
const resolveReferenceType = ReferenceImpl.resolveReferenceType;

function _filter_by_referenceType(
    this: BaseNode,
    browseDescription: BrowseDescriptionOptions2,
    references: UAReference[],
    referenceTypeId: NodeId
) {
    // make sure we have a valid referenceTypeId if not null
    if (!nodeid_is_nothing(referenceTypeId)) {
        assert(referenceTypeId instanceof NodeId);
        const referenceType = this.addressSpace.findNode(referenceTypeId) as UAReferenceType;
        dumpIf(!referenceType, referenceTypeId);
        // c8 ignore next
        if (!referenceType || referenceType.nodeClass !== NodeClass.ReferenceType) {
            throw new Error("Cannot find reference type");
        }

        if (!browseDescription.includeSubtypes && referenceType.isAbstract) {
            warningLog("filter by reference will skip all reference as referenceType is abstract and includeSubtypes is false");
        }

        references = references.filter((reference) => {
            const ref = resolveReferenceType(this.addressSpace, reference);
            // c8 ignore next
            if (!ref) {
                throw new Error(`Cannot find reference type ${reference.toString()}`);
            }
            // unknown type ... this may happen when the address space is not fully build
            assert(ref.nodeClass === NodeClass.ReferenceType);

            const isSameType = sameNodeId(ref.nodeId, referenceType.nodeId);
            if (isSameType) {
                return true;
            }
            if (browseDescription.includeSubtypes) {
                return ref.isSubtypeOf(referenceType);
            } else {
                return false;
            }
        });
    }
    return references;
}

function forwardOnly(reference: UAReference): boolean {
    return reference.isForward;
}

function reverseOnly(reference: UAReference): boolean {
    return !reference.isForward;
}

function _filter_by_direction(references: UAReference[], browseDirection: BrowseDirection): UAReference[] {
    if (browseDirection === BrowseDirection.Both) {
        return references;
    }
    if (browseDirection === BrowseDirection.Forward) {
        return references.filter(forwardOnly);
    } else {
        return references.filter(reverseOnly);
    }
}
/*
function _filter_by_context(node: BaseNode, references: Reference[], context: SessionContext): Reference[] {
    if (!context.isBrowseAccessRestricted(node)) {
        return references;
    }
    // browse access is restricted for forward
    return [];
}
*/
function _filter_by_context(node: BaseNode, references: UAReference[], context: ISessionContext): UAReference[] {
    const addressSpace = node.addressSpace;
    return references.filter((reference) => !context.isBrowseAccessRestricted(resolveReferenceNode(addressSpace, reference)));
}

function _filter_by_nodeClass(this: BaseNode, references: UAReference[], nodeClassMask: number): UAReference[] {
    assert(Number.isFinite(nodeClassMask));
    if (nodeClassMask === 0) {
        return references;
    }
    const addressSpace = this.addressSpace;
    return references.filter((reference) => {
        const obj = resolveReferenceNode(addressSpace, reference);
        if (!obj) {
            return false;
        }
        // the NodeClass values are the NodeClassMask bits (Part 4, BrowseDescription.nodeClassMask)
        return (nodeClassMask & obj.nodeClass) !== 0;
    });
}

function _filter_by_userFilter(this: BaseNode, references: UAReference[], context?: ISessionContext): UAReference[] {
    const addressSpace = this.addressSpace;
    return references.filter((reference: UAReference) => {
        const obj = resolveReferenceNode(addressSpace, reference) as BaseNode;
        // c8 ignore next
        if (!obj) {
            return false;
        }

        const _private = BaseNode_getPrivate(obj);
        // c8 ignore next
        if (!_private._browseFilter) {
            throw Error("Internal error : cannot find browseFilter");
        }

        const filter1 = _private._browseFilter.call(obj, context);
        return filter1;
    });
}

/**
 * the child designated by `node.<accessorName>`: what the shared getters resolve, exposed for the
 * code that walks dotted paths by name (`_getCompositeKey`); works under `isFrugal` too, where no
 * own accessor is ever installed
 */
export function resolveChildAccessor(node: BaseNode, accessorName: string): BaseNode | undefined {
    const _private = BaseNode_getPrivate(node);
    // the prototype itself, or a disposed node
    if (!_private?.__address_space) {
        return undefined;
    }
    // a dotted child is a component, a property, a subtype or an organized node; a node that is
    // only an event source or a notifier of this one is not exposed, and removing the structural
    // reference removes the child even when an event reference to it remains
    const wellKnown = wellKnownReferenceTypes(node.addressSpace);
    if (!wellKnown) {
        return undefined; // namespace 0 is still loading
    }
    const { hasChild, organizes } = wellKnown;
    return resolveChildInIndex(
        _get_HierarchicalReference(node),
        accessorName,
        (reference) => hasChild.checkHasSubtype(reference.referenceType) || organizes.checkHasSubtype(reference.referenceType)
    );
}

/**
 * The accessor names under which a child of `node` can never be reached: the reserved names, the
 * members of the class of the node (attributes, methods, EventEmitter and Object members) and its
 * own fields. A child carrying one of these is reachable through `getChildByName` only.
 *
 * The generator of the typed nodeset interfaces reads this so that a generated interface names a
 * child exactly the way the runtime exposes it.
 *
 * @internal
 */
export function childAccessorNamesShadowedBy(node: BaseNode): Set<string> {
    const names = new Set<string>(reservedChildAccessorNames());
    // a member of the class that resolves the child of that name itself, the way the shared
    // accessors do: BaseNode.nodeVersion is the NodeVersion property, and declared as such
    const membersExposingTheChild = new Set(["nodeVersion"]);
    for (const own of Object.getOwnPropertyNames(node)) {
        // an own accessor is a child installed by install_extra_properties, not a field
        if (!Object.getOwnPropertyDescriptor(node, own)?.get) {
            names.add(own);
        }
    }
    for (let proto = Object.getPrototypeOf(node); proto; proto = Object.getPrototypeOf(proto)) {
        // the shared child accessors sit on BaseNodeImpl.prototype and are the names the runtime
        // does expose; the same name on a subclass prototype is a real member that wins over them
        const sharedAccessorsLiveHere = proto === BaseNodeImpl.prototype;
        for (const member of Object.getOwnPropertyNames(proto)) {
            if (membersExposingTheChild.has(member) || (sharedAccessorsLiveHere && hasSharedChildAccessor(member))) {
                continue;
            }
            names.add(member);
        }
    }
    return names;
}

function resolveSharedChildAccessor(node: BaseNodeImpl, accessorName: string): unknown {
    return resolveChildAccessor(node, accessorName);
}

/**
 * Define the shared getter of every browse name seen since the last call: the nodeset loader calls
 * it once a load is complete, so that the prototype changes in one batch rather than once per
 * new name in the middle of node creation.
 */
export function flushSharedChildAccessors(): number {
    return defineQueuedChildAccessors(BaseNodeImpl.prototype, resolveSharedChildAccessor);
}

/**
 * Give browse names created at runtime a shared accessor, for an application that builds its
 * model through the namespace API and wants `parent.<child>` without an accessor on every parent.
 */
export function defineSharedChildAccessors(browseNames: string[]): void {
    for (const browseName of browseNames) {
        registerChildName(browseName, true);
    }
    flushSharedChildAccessors();
}

/**
 * Expose `child` as `parentObj.<accessorName>` through an own accessor, unless the name is taken
 * already: by a shared accessor (which resolves it anyway), by an attribute, a method or a field
 * of the parent, or by an earlier child of the same name (first installed wins).
 *
 * This is the runtime fallback of child_accessors.ts, for names no loaded nodeset declared.
 */
function install_child_as_object_property(parentObj: BaseNode | null, child: BaseNode | null): void {
    // the parent may be unresolvable while a nodeset is still loading
    if (!parentObj || !child) {
        return;
    }
    const name = BaseNode_getPrivate(child)?._accessorName;
    if (!name || isReservedChildAccessorName(name) || hasSharedChildAccessor(name) || name in parentObj) {
        return;
    }
    doDebug && debugLog(`Installing property ${name}`, " on ", parentObj.browseName.toString());
    Object.defineProperty(parentObj, name, {
        configurable: true, // so that uninstall_child_object_property can remove it
        enumerable: true,
        get() {
            return child;
        }
    });
}

function uninstall_child_object_property(parentObj: BaseNode, child: BaseNode): void {
    const name = BaseNode_getPrivate(child)?._accessorName;
    if (!name || hasSharedChildAccessor(name)) {
        return; // the child index already reflects the removal
    }
    // only an accessor installed above goes; a field or a method of the same name stays, and so
    // does an accessor designating another child of the same name
    const descriptor = Object.getOwnPropertyDescriptor(parentObj, name);
    if (!descriptor?.get || !descriptor.configurable || descriptor.get.call(parentObj) !== child) {
        return;
    }
    delete (parentObj as unknown as Record<string, unknown>)[name];
}

export function getReferenceType(reference: UAReference): UAReferenceType {
    const r = (reference as ReferenceImpl)._referenceType;
    // c8 ignore next
    if (!r) {
        throw new Error("Internal error : cannot find referenceType");
    }
    return r;
}
