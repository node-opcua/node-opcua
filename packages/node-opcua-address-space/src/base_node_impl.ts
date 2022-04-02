/**
 * @module node-opcua-address-space
 */
import { EventEmitter } from "events";
import * as chalk from "chalk";
import { isEqual } from "lodash";

import {
    AddReferenceOpts,
    ModellingRuleType,
    ISessionContext,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReference,
    UAVariable,
    UAVariableType,
    BaseNode,
    UAReferenceType,
    IAddressSpace,
    INamespace,
    BrowseDescriptionOptions2
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import {
    AttributeIds,
    attributeNameById,
    BrowseDirection,
    coerceLocalizedText,
    coerceQualifiedName,
    LocalizedText,
    LocalizedTextLike,
    makeNodeClassMask,
    NodeClass,
    QualifiedName,
    QualifiedNameLike,
    QualifiedNameOptions,
    AccessRestrictionsFlag
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { dumpIf, make_warningLog, make_errorLog } from "node-opcua-debug";
import { coerceNodeId, makeNodeId, NodeId, NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { ReferenceDescription } from "node-opcua-service-browse";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    PermissionType,
    RelativePathElement,
    RolePermissionType,
    RolePermissionTypeOptions,
    WriteValueOptions
} from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, VariantArrayType } from "node-opcua-variant";

import { UAStateVariable } from "node-opcua-nodeset-ua";

import { XmlWriter } from "../source/xml_writer";
import { dumpReferenceDescriptions, dumpReferences } from "../source/helpers/dump_tools";
import { SessionContext, WellKnownRolesNodeId } from "../source/session_context";
import { AddressSpace } from "../src/address_space";
import * as cetools from "./address_space_change_event_tools";
import { AddressSpacePrivate } from "./address_space_private";
import {
    _constructReferenceDescription,
    _handle_HierarchicalReference,
    BaseNode_add_backward_reference,
    BaseNode_getPrivate,
    BaseNode_initPrivate,
    BaseNode_remove_backward_reference,
    BaseNode_removePrivate,
    BaseNode_toString,
    ToStringBuilder,
    BaseNode_getCache,
    BaseNode_clearCache
} from "./base_node_private";
import { MinimalistAddressSpace, ReferenceImpl } from "./reference_impl";
import { coerceRolePermissions } from "./role_permissions";

// tslint:disable:no-var-requires
// tslint:disable:no-bitwise
// tslint:disable:no-console

const doDebug = false;
const warningLog = make_warningLog(__filename);
const errorLog = make_errorLog(__filename);

function defaultBrowseFilterFunc(context?: ISessionContext): boolean {
    return true;
}

function _get_QualifiedBrowseName(browseName: QualifiedNameLike): QualifiedName {
    return coerceQualifiedName(browseName)!;
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

function _is_valid_BrowseDirection(browseDirection: any) {
    return (
        browseDirection === BrowseDirection.Forward ||
        browseDirection === BrowseDirection.Inverse ||
        browseDirection === BrowseDirection.Both
    );
}

export function makeAttributeEventName(attributeId: AttributeIds): string {
    const attributeName = attributeNameById[attributeId];
    return attributeName + "_changed";
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
export class BaseNodeImpl extends EventEmitter implements BaseNode {
    public static makeAttributeEventName(attributeId: AttributeIds): string {
        return makeAttributeEventName(attributeId);
    }

    private _accessRestrictions?: AccessRestrictionsFlag;
    private _rolePermissions?: RolePermissionType[];

    public onFirstBrowseAction?: (this: BaseNode) => Promise<void>;

    public get addressSpace(): IAddressSpace {
        const _private = BaseNode_getPrivate(this);
        // istanbul ignore next
        if (!_private) {
            throw new Error("Internal error , cannot extract private data from " + this.browseName.toString());
        }
        return _private.__address_space as AddressSpace;
    }

    protected get addressSpacePrivate(): AddressSpacePrivate {
        const _private = BaseNode_getPrivate(this);
        // istanbul ignore next
        if (!_private) {
            throw new Error("Internal error , cannot extract private data from " + this.browseName.toString());
        }
        return _private.__address_space as AddressSpacePrivate;
    }

    public get displayName(): LocalizedText[] {
        const _private = BaseNode_getPrivate(this);
        return _private._displayName;
    }

    public setDisplayName(value: LocalizedText[]): void {
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
        return _private._description!;
    }

    public setDescription(value: LocalizedText): void {
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
            _cache.typeDefinition = has_type_definition_ref ? has_type_definition_ref.nodeId : null;
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
            _cache.typeDefinitionObj = nodeId ? this.addressSpace.findNode(nodeId) : null;
        }
        return _cache.typeDefinitionObj;
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

    protected _postInstantiateFunc?: any;

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

        this.nodeId = resolveNodeId(options.nodeId);

        // QualifiedName
        /**
         * the node browseName
         * @property browseName
         * @type QualifiedName
         * @static
         */
        this.browseName = _get_QualifiedBrowseName(options.browseName);

        // re-use browseName as displayName if displayName is missing
        options.displayName = options.displayName || this.browseName.name!.toString();

        if (options.description === undefined) {
            options.description = null;
        }
        this._setDisplayName(options.displayName);

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
            this.__addReference(reference);
        }

        this._accessRestrictions = options.accessRestrictions;
        this._rolePermissions = coerceRolePermissions(options.rolePermissions);
    }

    public getDisplayName(locale?: string): string {
        const _private = BaseNode_getPrivate(this);
        return _private._displayName[0].text!;
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
        const results: UAReference[] = [];

        const process = (referenceIdx: { [key: string]: UAReference }) => {
            const references = Object.values(referenceIdx);
            for (const ref of references) {
                if (ref.isForward === isForward && referenceTypeNode && referenceTypeNode.checkHasSubtype(ref.referenceType)) {
                    results.push(ref);
                }
            }
        };
        const _private = BaseNode_getPrivate(this);
        process(_private._referenceIdx);
        process(_private._back_referenceIdx);
        return results;
    }

    public findReferences(referenceType: string | NodeId | UAReferenceType, isForward = true): UAReference[] {
        const _cache = BaseNode_getCache(this);
        const _private = BaseNode_getPrivate(this);

        const referenceTypeNode = this._coerceReferenceType(referenceType);
        if (!referenceTypeNode) {
            // note: when loading nodeset2.xml files, reference type may not exit yet
            // throw new Error("expecting valid reference name " + strReference);
            return [];
        }
        const hash = "_ref_" + referenceTypeNode.nodeId.toString() + isForward.toString();
        if (_cache[hash]) {
            return _cache[hash];
        }

        // istanbul ignore next
        if (doDebug && !this.addressSpace.findReferenceType(referenceTypeNode.nodeId)) {
            throw new Error("expecting valid reference name " + referenceType);
        }

        const result: UAReference[] = [];
        for (const ref of Object.values(_private._referenceIdx)) {
            if (ref.isForward === isForward) {
                if (sameNodeId(ref.referenceType, referenceTypeNode.nodeId)) {
                    result.push(ref);
                }
            }
        }

        for (const ref of Object.values(_private._back_referenceIdx)) {
            if (ref.isForward === isForward) {
                if (sameNodeId(ref.referenceType, referenceTypeNode.nodeId)) {
                    result.push(ref);
                }
            }
        }

        _cache[hash] = result;
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
        const _cache = BaseNode_getCache(this);
        if (!_cache._aggregates) {
            _cache._aggregates = this.findReferencesExAsObject("Aggregates", BrowseDirection.Forward);
        }
        return _cache._aggregates;
    }

    /**
     * return an array with the components of this object.
     */
    public getComponents(): BaseNode[] {
        const _cache = BaseNode_getCache(this);
        if (!_cache._components) {
            _cache._components = this.findReferencesExAsObject("HasComponent", BrowseDirection.Forward);
        }
        return _cache._components;
    }

    /**
     *  return a array with the properties of this object.
     */
    public getProperties(): BaseNode[] {
        const _cache = BaseNode_getCache(this);
        if (!_cache._properties) {
            _cache._properties = this.findReferencesExAsObject("HasProperty", BrowseDirection.Forward);
        }
        return _cache._properties;
    }

    /**
     * return a array with the notifiers of this object.
     */
    public getNotifiers(): BaseNode[] {
        const _cache = BaseNode_getCache(this);
        if (!_cache._notifiers) {
            _cache._notifiers = this.findReferencesAsObject("HasNotifier", true);
        }
        return _cache._notifiers;
    }

    /**
     * return a array with the event source of this object.
     */
    public getEventSources(): BaseNode[] {
        const _cache = BaseNode_getCache(this);
        if (!_cache._eventSources) {
            _cache._eventSources = this.findReferencesAsObject("HasEventSource", true);
        }
        return _cache._eventSources;
    }

    /**
     * return a array of the objects for which this node is an EventSource
     */
    public getEventSourceOfs(): BaseNode[] {
        const _cache = BaseNode_getCache(this);
        if (!_cache._eventSources) {
            _cache._eventSources = this.findReferencesAsObject("HasEventSource", false);
        }
        return _cache._eventSources;
    }

    /**
     * retrieve a component by name
     */
    public getComponentByName(browseName: QualifiedNameOptions): UAVariable | UAObject | null;
    public getComponentByName(browseName: string, namespaceIndex?: number): UAVariable | UAObject | null;
    public getComponentByName(browseName: QualifiedNameLike, namespaceIndex?: number): UAVariable | UAObject | null {
        const components = this.getComponents();
        const select = _filter_by_browse_name(components, browseName, namespaceIndex);
        assert(select.length <= 1, "BaseNode#getComponentByName found duplicated reference");
        if (select.length === 1) {
            const component = select[0];
            if (component.nodeClass === NodeClass.Method) {
                warningLog("please use getMethodByName to retrieve a method");
                return null;
            }
            assert(component.nodeClass === NodeClass.Variable || component.nodeClass === NodeClass.Object);
            return component as any as UAVariable | UAObject;
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
        const properties = this.getProperties();
        const select = _filter_by_browse_name(properties, browseName, namespaceIndex);
        assert(select.length <= 1, "BaseNode#getPropertyByName found duplicated reference");
        if (select.length === 1 && select[0].nodeClass !== NodeClass.Variable) {
            throw new Error("Expecting a property to be of nodeClass==NodeClass.Variable");
        }
        return select.length === 1 ? (select[0] as any as UAVariable) : null;
    }

    /**
     * retrieve a folder element by name
     */
    public getFolderElementByName(browseName: QualifiedNameOptions): BaseNode | null;
    public getFolderElementByName(browseName: string, namespaceIndex?: number): BaseNode | null;
    public getFolderElementByName(browseName: QualifiedNameLike, namespaceIndex?: number): BaseNode | null {
        const elements = this.getFolderElements();
        const select = _filter_by_browse_name(elements, browseName, namespaceIndex);
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
     * @method getMethods
     * @return an array with Method objects.
     *
     *
     * Note: internally, methods are special types of components
     */
    public getMethods(): UAMethod[] {
        const _cache = BaseNode_getCache(this);
        if (!_cache._methods) {
            const components = this.getComponents();
            _cache._methods = components.filter((obj) => obj.nodeClass === NodeClass.Method);
        }
        return _cache._methods;
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
        const methods = this.getMethods();
        const select = _filter_by_browse_name(methods, methodName, namespaceIndex);
        assert(select.length <= 1, "BaseNode#getMethodByName found duplicated reference");
        return select.length === 1 ? select[0]! : null;
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
        const options: any = {};
        options.statusCode = StatusCodes.Good;

        switch (attributeId) {
            case AttributeIds.NodeId: // NodeId
                options.value = { dataType: DataType.NodeId, value: this.nodeId };
                break;

            case AttributeIds.NodeClass: // NodeClass
                assert(isFinite(this.nodeClass));
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
            return callback(null, StatusCodes.BadAttributeIdInvalid);
        }
        // by default Node is read-only,
        // this method needs to be overridden to change the behavior
        callback(null, StatusCodes.BadNotWritable);
    }

    public fullName(): string {
        if (this.parentNodeId) {
            const parent = this.addressSpace.findNode(this.parentNodeId) as BaseNode;

            // istanbul ignore else
            if (parent) {
                return parent.fullName() + "." + this.browseName.toString() + "";
            } else {
                return "NOT YET REGISTERED" + this.parentNodeId.toString() + "." + this.browseName.toString() + "";
            }
        }
        return this.browseName.toString();
    }

    public ownReferences(): UAReference[] {
        const _private = BaseNode_getPrivate(this);
        return Object.values(_private._referenceIdx);
    }

    /**
     * @method browseNodeByTargetName
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
        assert(relativePathElement.targetName.name!.length > 0);

        // The type of reference to follow from the current node.
        // The current path cannot be followed any further if the referenceTypeId is not available on the Node instance.
        // If not specified then all References are included and the parameter includeSubtypes is ignored.
        assert(Object.prototype.hasOwnProperty.call(relativePathElement, "referenceTypeId"));

        // Indicates whether the inverse Reference should be followed.
        // The inverse reference is followed if this value is TRUE.
        assert(Object.prototype.hasOwnProperty.call(relativePathElement, "isInverse"));

        // Indicates whether subtypes of the ReferenceType should be followed.
        // Subtypes are included if this value is TRUE.
        assert(Object.prototype.hasOwnProperty.call(relativePathElement, "includeSubtypes"));

        const references = this.allReferences();

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
            assert(Object.prototype.hasOwnProperty.call(reference, "isForward"));
            const referenceType = resolveReferenceType(this.addressSpace, reference);
            const referenceTypeId = referenceType.nodeId;

            if (sameNodeId(relativePathElement.referenceTypeId, referenceTypeId)) {
                return true;
            }
            if (relativePathElement.includeSubtypes) {
                const baseType = this.addressSpace.findReferenceType(relativePathElement.referenceTypeId)!;
                if (baseType && referenceType.isSupertypeOf(baseType)) {
                    return true;
                }
            }
            return false;
        };

        const nodeIdsMap: any = {};
        let nodeIds: NodeId[] = [];

        for (const reference of references) {
            if (!_check_reference(reference)) {
                continue;
            }

            const obj = resolveReferenceNode(this.addressSpace, reference);

            // istanbul ignore next
            if (!obj) {
                throw new Error(" cannot find node with id " + reference.nodeId.toString());
            }

            if (isEqual(obj.browseName, relativePathElement.targetName)) {
                // compare QualifiedName

                const key = obj.nodeId.toString();
                if (!Object.prototype.hasOwnProperty.call(nodeIdsMap, key)) {
                    nodeIds.push(obj.nodeId);
                    nodeIdsMap[key] = obj;
                }
            }
        }

        if (nodeIds.length === 0 && (this.nodeClass === NodeClass.ObjectType || this.nodeClass === NodeClass.VariableType)) {
            const nodeType = this as any as UAVariableType;

            if (nodeType.subtypeOf) {
                // browsing also InstanceDeclarations included in base type
                const baseType = this.addressSpace.findNode(nodeType.subtypeOf)! as BaseNode;
                const n = (baseType as BaseNodeImpl).browseNodeByTargetName(relativePathElement, isLast);
                nodeIds = ([] as NodeId[]).concat(nodeIds, n);
            }
        }
        return nodeIds;
    }

    /**
     * browse the node to extract information requested in browseDescription
     * and returns an array with reference descriptions
     *
     *
     *
     */
    public browseNode(browseDescription: BrowseDescriptionOptions2, context?: ISessionContext): ReferenceDescription[] {
        assert(isFinite(browseDescription.nodeClassMask));

        const do_debug = false;

        const _private = BaseNode_getPrivate(this);

        const addressSpace = this.addressSpace;

        const referenceTypeId = normalize_referenceTypeId(addressSpace, browseDescription.referenceTypeId);
        assert(referenceTypeId instanceof NodeId);

        const browseDirection =
            browseDescription.browseDirection !== undefined ? browseDescription.browseDirection : BrowseDirection.Both;

        // get all possible references
        let references = this.allReferences();

        /* istanbul ignore next */
        if (do_debug) {
            console.log("all references :", this.nodeId.toString(), this.browseName.toString());
            dumpReferences(addressSpace, (Object as any).values(_private._referenceIdx));
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

        /* istanbul ignore next */
        if (do_debug) {
            dumpReferenceDescriptions(this.addressSpace, referenceDescriptions);
        }

        return referenceDescriptions;
    }

    public allReferences(): UAReference[] {
        const _private = BaseNode_getPrivate(this);
        return Object.values(_private._referenceIdx).concat(Object.values(_private._back_referenceIdx));
    }

    /**
     * @method addReference
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
            throw new Error("BaseNode#addReference : invalid reference  " + reference.toString());
        }

        this._clear_caches();

        _propagate_ref.call(this, addressSpace, referenceNode);
        this.install_extra_properties();
        cetools._handle_add_reference_change_event(this, referenceNode.nodeId);
    }

    public removeReference(referenceOpts: AddReferenceOpts): void {
        const _private = BaseNode_getPrivate(this);

        assert(Object.prototype.hasOwnProperty.call(referenceOpts, "referenceType"));
        // xx isForward is optional : assert(Object.prototype.hasOwnProperty.call(reference,"isForward"));
        assert(Object.prototype.hasOwnProperty.call(referenceOpts, "nodeId"));

        const addressSpace = this.addressSpace as AddressSpacePrivate;

        // istanbul ignore next
        if (!addressSpace) {
            console.log(" Where is addressSpace ?");
        }
        const reference = addressSpace.normalizeReferenceTypes([referenceOpts!])![0];
        const h = (<ReferenceImpl>reference).hash;

        const relatedNode = addressSpace.findNode(reference.nodeId)!;

        const invReference = new ReferenceImpl({
            isForward: !reference.isForward,
            nodeId: this.nodeId,
            referenceType: reference.referenceType
        });

        if (_private._referenceIdx[h]) {
            delete _private._referenceIdx[h];
            BaseNode_remove_backward_reference.call(relatedNode as BaseNode, invReference);
        } else if (_private._back_referenceIdx[h]) {
            (relatedNode as any).removeReference(invReference);
        } else {
            //            throw new Error("Cannot find reference " + reference);
        }

        _handle_HierarchicalReference(this, reference);

        this.uninstall_extra_properties(reference);

        this._clear_caches();
    }

    /**
     *
     */
    public resolveNodeId(nodeId: NodeIdLike): NodeId {
        return this.addressSpace.resolveNodeId(nodeId);
    }

    public install_extra_properties(): void {
        const addressSpace = this.addressSpace;

        if (addressSpace.isFrugal) {
            // skipping
            return;
        }

        install_components_as_object_properties(this);

        function install_extra_properties_on_parent(ref: UAReference): void {
            const node = ReferenceImpl.resolveReferenceNode(addressSpace, ref) as BaseNode;
            install_components_as_object_properties(node);
        }

        // make sure parent have extra properties updated
        const parentComponents = this.findReferencesEx("HasComponent", BrowseDirection.Inverse);
        const parentSubfolders = this.findReferencesEx("Organizes", BrowseDirection.Inverse);
        const parentProperties = this.findReferencesEx("HasProperty", BrowseDirection.Inverse);

        for (const p of parentComponents) {
            install_extra_properties_on_parent(p);
        }
        for (const p of parentSubfolders) {
            install_extra_properties_on_parent(p);
        }
        for (const p of parentProperties) {
            install_extra_properties_on_parent(p);
        }
    }

    public uninstall_extra_properties(reference: UAReference): void {
        const addressSpace = this.addressSpace;

        if (addressSpace.isFrugal) {
            // skipping
            return;
        }
        const childNode = resolveReferenceNode(addressSpace, reference);

        const name = lowerFirstLetter(childNode.browseName.name!.toString());
        if (Object.prototype.hasOwnProperty.call(reservedNames, name)) {
            // istanbul ignore next
            if (doDebug) {
                // tslint:disable-next-line:no-console
                console.log(chalk.bgWhite.red("Ignoring reserved keyword                                     " + name));
            }
            return;
        }
        /* istanbul ignore next */
        if (!Object.prototype.hasOwnProperty.call(this, name)) {
            return;
        }

        Object.defineProperty(this, name, {
            value: undefined
        });
    }

    public toString(): string {
        const options = new ToStringBuilder();
        BaseNode_toString.call(this, options);
        return options.toString();
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
     * @method getFalseSubStates
     * @return {UAStateVariable[]} return an array with the SubStates of this object.
     */
    public getFalseSubStates(): UAStateVariable<LocalizedText>[] {
        return this.findReferencesAsObject("HasFalseSubState") as UAStateVariable<LocalizedText>[];
    }

    /**
     * @method getTrueSubStates
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
    public getChildByName(browseName: QualifiedNameLike, namespaceIndex?: number): BaseNode | null {
        // Attention: getChild doesn't care about namespace on browseName
        //            !!!!
        if (browseName instanceof QualifiedName) {
            browseName = browseName.name!.toString();
        }
        assert(typeof browseName === "string");

        const _cache = BaseNode_getCache(this);

        const addressSpace = this.addressSpace;

        if (!_cache._childByNameMap) {
            _cache._childByNameMap = {};

            const childReferenceTypes = this.findReferencesEx("HasChild");
            for (const r of childReferenceTypes) {
                const child = resolveReferenceNode(addressSpace, r);
                _cache._childByNameMap[child.browseName.name!.toString()] = child;
            }
        }
        const ret = _cache._childByNameMap[browseName.toString()] || null;
        return ret;
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
     */
    public propagate_back_references(): void {
        const _private = BaseNode_getPrivate(this);
        if ((this.addressSpace as AddressSpacePrivate).suspendBackReference) {
            // this indicates that the base node is constructed from an xml definition
            // propagate_back_references will be called later once the file has been completely processed.
            return;
        }
        const addressSpace = this.addressSpace;
        for (const reference of Object.values(_private._referenceIdx)) {
            _propagate_ref.call(this, addressSpace, reference);
        }
    }

    /**
     * the dispose method should be called when the node is no longer used, to release
     * back pointer to the address space and clear caches.
     *
     * @method dispose
     *
     */
    public dispose(): void {
        this.emit("dispose");

        this.removeAllListeners();
        this._clear_caches();

        const _private = BaseNode_getPrivate(this);
        Object.values(_private._back_referenceIdx).forEach((ref) => (ref as ReferenceImpl).dispose());
        Object.values(_private._referenceIdx).forEach((ref) => (ref as ReferenceImpl).dispose());

        BaseNode_removePrivate(this);
    }

    // istanbul ignore next
    public dumpXML(xmlWriter: XmlWriter): void {
        console.error(" This ", (NodeClass as any)[this.nodeClass]);
        assert(false, "BaseNode#dumpXML NOT IMPLEMENTED !");
        assert(xmlWriter);
    }

    /**
     * Undo the effect of propagate_back_references
     */
    public unpropagate_back_references(): void {
        const _private = BaseNode_getPrivate(this);

        const addressSpace = this.addressSpace;

        for (const reference of Object.values(_private._referenceIdx) as UAReference[]) {
            // filter out non  Hierarchical References
            const referenceType = resolveReferenceType(addressSpace, reference);

            // istanbul ignore next
            if (!referenceType) {
                console.error(chalk.red(" ERROR"), " cannot find reference ", reference.referenceType, reference.toString());
            }

            const related_node = resolveReferenceNode(addressSpace, reference) as BaseNode;
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

    public installPostInstallFunc(f: () => void): void {
        if (!f) {
            // nothing to do
            return;
        }

        function chain(f1: any, f2: any) {
            return function chaiFunc(this: BaseNode, ...args: any[]) {
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

    public _on_child_added(): void {
        this._clear_caches();
    }

    public _on_child_removed(obj: BaseNode): void {
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
        let result: UAReferenceType;
        if (typeof referenceType === "string") {
            result = this.addressSpace.findReferenceType(referenceType)!;
            /* istanbul ignore next */
            if (!result) {
                errorLog("referenceType ", referenceType, " cannot be found");
                throw new Error("Cannot coerce reference with name " + referenceType);
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

    private __addReference(referenceOpts: AddReferenceOpts): UAReference {
        const _private = BaseNode_getPrivate(this);

        assert(Object.prototype.hasOwnProperty.call(referenceOpts, "referenceType"));
        // xx isForward is optional : assert(Object.prototype.hasOwnProperty.call(reference,"isForward"));
        assert(Object.prototype.hasOwnProperty.call(referenceOpts, "nodeId"));

        const addressSpace = this.addressSpace as AddressSpacePrivate;
        const reference: UAReference = addressSpace.normalizeReferenceTypes([referenceOpts])[0];
        assert(reference instanceof ReferenceImpl);

        const h = (<ReferenceImpl>reference).hash;
        assert(!_private._back_referenceIdx[h], "reference exists already in _back_references");
        assert(!_private._referenceIdx[h], "reference exists already in _references");

        _private._referenceIdx[h] = reference;
        _handle_HierarchicalReference(this, reference);
        return reference;
    }

    private _setDisplayName(displayName: LocalizedTextLike | LocalizedTextLike[]) {
        const displayNames: LocalizedTextLike[] = Array.isArray(displayName) ? displayName : [displayName];
        const _displayNames = displayNames.map(coerceLocalizedText) as LocalizedText[];
        const _private = BaseNode_getPrivate(this);
        _private._displayName = _displayNames;
    }

    private _setDescription(description: LocalizedTextLike | null): void {
        const __description = coerceLocalizedText(description);
        const _private = BaseNode_getPrivate(this);
        _private._description = __description!;
    }

    private _notifyAttributeChange(attributeId: AttributeIds): void {
        const event_name = BaseNodeImpl.makeAttributeEventName(attributeId);
        this.emit(event_name, this.readAttribute(SessionContext.defaultContext, attributeId));
    }

    private _clear_caches() {
        BaseNode_clearCache(this);
    }
    private _readAccessRestrictions(context: ISessionContext | null): DataValue {
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
        if (context && !context?.checkPermission(this as any, PermissionType.ReadRolePermissions)) {
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
                roleId: toRoleNodeId(roleId!),
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
        if (this.rolePermissions === undefined) {
            // to do : If not specified, the value of DefaultUserRolePermissions Property from
            // the Namespace Metadata Object associated with the Node is used instead.
            return new DataValue({
                statusCode: StatusCodes.BadAttributeIdInvalid
            });
        }
        const context1: ISessionContext = context === null ? SessionContext.defaultContext : context;
        // for the time being ...
        // get user Permission
        const rolePermissions = this.rolePermissions
            .map(({ roleId, permissions }) => {
                return new RolePermissionType({
                    roleId: toRoleNodeId(roleId!),
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
        return resolveNodeId(WellKnownRolesNodeId[s as any]);
    }
    return coerceNodeId(s);
}

let displayWarning = true;

function toString_ReferenceDescription(ref: UAReference, options: { addressSpace: IAddressSpace }): string {
    const addressSpace = options.addressSpace as AddressSpacePrivate;
    // xx assert(ref instanceof ReferenceDescription);
    const refNode = addressSpace.findNode(ref.referenceType);
    if (!refNode) {
        return "Unknown Ref : " + ref;
    }
    const r = new ReferenceImpl({
        isForward: ref.isForward,
        nodeId: ref.nodeId,
        referenceType: refNode.browseName.toString()
    });
    const str = r.toString(options);
    r.dispose();
    return str;
}

function _setup_parent_item(this: BaseNode, references: { [key: string]: any }): BaseNode | null {
    references = Object.values(references);

    const _private = BaseNode_getPrivate(this);
    assert(!_private._parent, "_setup_parent_item has been already called");

    const addressSpace = this.addressSpace;

    if (references.length > 0) {
        references = this.findReferencesEx("Aggregates", BrowseDirection.Inverse);

        if (references.length >= 1) {
            // istanbul ignore next
            if (references.length > 1) {
                if (displayWarning) {
                    const options = { addressSpace };
                    // tslint:disable-next-line:no-console
                    console.warn("  More than one Aggregates reference have been found for parent of object");
                    // tslint:disable-next-line:no-console
                    console.warn("    object node id:", this.nodeId.toString(), chalk.cyan(this.browseName.toString()));
                    // tslint:disable-next-line:no-console
                    console.warn("    browseResults:");
                    // tslint:disable-next-line:no-console
                    console.warn(references.map((f: UAReference) => toString_ReferenceDescription(f, options)).join("\n"));
                    // tslint:disable-next-line:no-console
                    console.warn("    first one will be used as parent");
                    // xx assert(browseResults.length === 1);
                    displayWarning = false;
                }
            }
            return ReferenceImpl.resolveReferenceNode(addressSpace, references[0]);
        }
    }
    return null;
}

function _asObject<T extends BaseNode>(references: UAReference[], addressSpace: IAddressSpace): T[] {
    function toObject(reference: UAReference): T {
        const obj = resolveReferenceNode(addressSpace, reference);
        // istanbul ignore next
        if (false && !obj) {
            // tslint:disable-next-line:no-console
            console.log(
                chalk.red(" Warning :  object with nodeId ") +
                    chalk.cyan(reference.nodeId.toString()) +
                    chalk.red(" cannot be found in the address space !")
            );
        }
        return obj as any as T;
    }

    function remove_null(o: any): boolean {
        return !!o;
    }

    return references.map(toObject)!.filter(remove_null)! as T[];
}

function _filter_by_browse_name<T extends BaseNode>(components: T[], browseName: QualifiedNameLike, namespaceIndex?: number): T[] {
    let select: T[] = [];
    if ((namespaceIndex === null || namespaceIndex === undefined) && typeof browseName === "string") {
        select = components.filter((c: T) => c.browseName.name!.toString() === browseName);
        if (select && select.length > 1) {
            warningLog("Multiple children exist with name ", browseName, " please specify a namespace index");
        }
    } else {
        const _browseName = coerceQualifiedName(
            typeof browseName === "string" ? { name: browseName, namespaceIndex } : browseName
        )!;
        select = components.filter(
            (c: T) => c.browseName.name === _browseName.name && c.browseName.namespaceIndex === _browseName.namespaceIndex
        );
    }
    return select;
}

let displayWarningReferencePointingToItSelf = true;

function _is_massively_used_reference(referenceType: UAReferenceType): boolean {
    const name = referenceType.browseName.toString();
    return name === "HasTypeDefinition" || name === "HasModellingRule";
}

function _propagate_ref(this: BaseNode, addressSpace: MinimalistAddressSpace, reference: UAReference): void {
    // filter out non  Hierarchical References
    const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);

    // istanbul ignore next
    if (!referenceType) {
        // tslint:disable-next-line:no-console
        console.error(chalk.red(" ERROR"), " cannot find reference ", reference.referenceType, reference.toString());
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
    // ------------------------------- EXPERIMENT

    // xx if (!referenceType.isSupertypeOf(hierarchicalReferencesId)) { return; }
    const related_node = resolveReferenceNode(addressSpace, reference) as BaseNodeImpl;
    if (related_node) {
        // verify that reference doesn't point to object it this (see mantis 3099)
        if (sameNodeId(reference.nodeId, this.nodeId)) {
            // istanbul ignore next
            if (displayWarningReferencePointingToItSelf) {
                // this could happen with method
                console.warn("  Warning: a Reference is pointing to this ", this.nodeId.toString(), this.browseName.toString());
                displayWarningReferencePointingToItSelf = false;
            }
        }
        // xx ignore this assert(reference.nodeId.toString() !== this.nodeId.toString());
        // function w(s,l) { return (s+"                                                          ").substring(0,l);}
        // if (reference.isForward) {
        //    console.log("  CHILD => ",w(related_node.browseName   + " " + related_node.nodeId.toString(),30),
        //    "  PARENT   ",w(this.browseName + " " + this.nodeId.toString(),30) , reference.toString());
        // } else {
        //    console.log("  CHILD => ",w(this.browseName   + " " + this.nodeId.toString(),30),
        //   "  PARENT   ",w(related_node.browseName + " " + related_node.nodeId.toString(),30) , reference.toString());
        //
        // }
        (related_node as BaseNodeImpl)._add_backward_reference(
            new ReferenceImpl({
                _referenceType: getReferenceType(reference),
                isForward: !reference.isForward,
                node: this,
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
 * @method normalize_referenceTypeId
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
    let nodeId;
    try {
        nodeId = addressSpace.resolveNodeId(referenceTypeId);
    } catch (err) {
        console.log("cannot normalize_referenceTypeId", referenceTypeId);
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
        // istanbul ignore next
        if (!referenceType || referenceType.nodeClass !== NodeClass.ReferenceType) {
            throw new Error("Cannot find reference type");
        }

        if (!browseDescription.includeSubtypes && referenceType.isAbstract) {
            warningLog("filter by reference will skip all reference as referenceType is abstract and includeSubtypes is false");
        }

        references = references.filter((reference) => {
            const ref = resolveReferenceType(this.addressSpace, reference)!;
            // istanbul ignore next
            if (!ref) {
                throw new Error("Cannot find reference type " + reference.toString());
            }
            // unknown type ... this may happen when the address space is not fully build
            assert(ref.nodeClass === NodeClass.ReferenceType);

            const isSameType = sameNodeId(ref.nodeId, referenceType.nodeId);
            if (isSameType) {
                return true;
            }
            if (browseDescription.includeSubtypes) {
                return ref.isSupertypeOf(referenceType as UAReferenceType);
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
    assert(isFinite(nodeClassMask));
    if (nodeClassMask === 0) {
        return references;
    }
    const addressSpace = this.addressSpace;
    return references.filter((reference) => {
        const obj = resolveReferenceNode(addressSpace, reference);

        if (!obj) {
            return false;
        }

        const nodeClassName = NodeClass[obj.nodeClass];

        const value = makeNodeClassMask(nodeClassName);
        return (value & nodeClassMask) === value;
    });
}

function _filter_by_userFilter(this: BaseNode, references: UAReference[], context?: ISessionContext): UAReference[] {
    const addressSpace = this.addressSpace;
    return references.filter((reference: UAReference) => {
        const obj = resolveReferenceNode(addressSpace, reference) as BaseNode;
        // istanbul ignore next
        if (!obj) {
            return false;
        }

        const _private = BaseNode_getPrivate(obj);
        // istanbul ignore next
        if (!_private._browseFilter) {
            throw Error("Internal error : cannot find browseFilter");
        }

        const filter1 = _private._browseFilter.call(obj, context);
        return filter1;
    });
}

const reservedNames = {
    __description: 0,
    __displayName: 0,
    browseName: 0,
    description: 0,
    displayName: 0,
    nodeClass: 0,
    nodeId: 0,
    typeDefinition: 0
};

/*
 * install hierarchical references as javascript properties
 * Components/Properties/Organizes
 */
function install_components_as_object_properties(parentObj: BaseNode) {
    if (!parentObj) {
        return;
    }

    const addressSpace = parentObj.addressSpace;
    const hierarchicalRefs = (parentObj as BaseNodeImpl).findHierarchicalReferences();

    const children = hierarchicalRefs.map((r: UAReference) => ReferenceImpl.resolveReferenceNode(addressSpace, r));

    for (const child of children) {
        if (!child) {
            continue;
        }
        // assumption: we ignore namespace here .
        const name = lowerFirstLetter(child.browseName.name!.toString());

        if (Object.prototype.hasOwnProperty.call(reservedNames, name)) {
            // ignore reserved names
            if (doDebug) {
                console.log(chalk.bgWhite.red("Ignoring reserved keyword                                               " + name));
            }
            continue;
        }

        // ignore reserved names
        if (doDebug) {
            console.log("Installing property " + name, " on ", parentObj.browseName.toString());
        }

        /* istanbul ignore next */
        if (Object.prototype.hasOwnProperty.call(parentObj, name)) {
            continue;
        }

        Object.defineProperty(parentObj, name, {
            configurable: true, // set to true, so we can undefine later
            enumerable: true,
            // xx writable: false,
            get() {
                return child;
            }
            // value: child
        });
    }
}

export function getReferenceType(reference: UAReference): UAReferenceType {
    return (<ReferenceImpl>reference)._referenceType!;
}
