/**
 * @module node-opcua-address-space.Private
 */
// tslint:disable:no-bitwise
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import {
    AccessLevelFlag,
    BrowseDirection,
    coerceLocalizedText,
    coerceQualifiedName,
    LocalizedText,
    NodeClass,
    ResultMask
} from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { ReferenceDescription } from "node-opcua-types";
import {
    IAddressSpace,
    UADataType,
    UAReferenceType,
    ConstructNodeIdOptions,
    CloneExtraInfo,
    CloneFilter,
    BaseNode,
    UAVariable,
    UAMethod,
    UAObject,
    UAObjectType,
    UAVariableType,
    ISessionContext,
    UAReference,
    CloneOptions
} from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";

import { UANamespace_process_modelling_rule } from "./namespace_private";
import { ReferenceImpl } from "./reference_impl";
import { BaseNodeImpl, getReferenceType } from "./base_node_impl";
import { AddressSpacePrivate } from "./address_space_private";
import { UAObjectImpl } from "./ua_object_impl";

const g_weakMap = new WeakMap();

const warningLog = make_warningLog(__filename);

interface BaseNodeCache {
    __address_space: IAddressSpace | null;
    _browseFilter?: (this: BaseNode, context?: ISessionContext) => boolean;
    _cache: any;
    _description?: LocalizedText;
    _displayName: LocalizedText[];
    _parent?: BaseNode | null;

    _back_referenceIdx: { [key: string]: UAReference };
    _referenceIdx: { [key: string]: UAReference };

    _subtype_idxVersion: number;
    _subtype_idx: any;
}

export function BaseNode_initPrivate(self: BaseNode): BaseNodeCache {
    const _private: BaseNodeCache = {
        __address_space: null,

        _referenceIdx: {},
        _back_referenceIdx: {},

        _browseFilter: undefined,
        _cache: {},
        _description: undefined,
        _displayName: [],
        _parent: undefined,
        _subtype_idx: {},
        _subtype_idxVersion: 0
    };
    g_weakMap.set(self, _private);
    return _private;
}

export function BaseNode_removePrivate(self: BaseNode): void {
    // there is no need to delete object from weak map
    // the GC will take care of this in due course
    // g_weakMap.delete(self);
    const _private = BaseNode_getPrivate(self);
    _private._cache = {};
    _private.__address_space = null;
    _private._back_referenceIdx = {};
    _private._referenceIdx = {};
    _private._description = undefined;
    _private._displayName = [];
}

export function BaseNode_getPrivate(self: BaseNode): BaseNodeCache {
    return g_weakMap.get(self);
}

export function BaseNode_getCache(node: BaseNode): any {
    return BaseNode_getPrivate(node)._cache;
}
export function BaseNode_clearCache(node: BaseNode): void {
    const _private = BaseNode_getPrivate(node);
    if (_private && _private._cache) {
        _private._cache = {};
    }
}
const hasTypeDefinition_ReferenceTypeNodeId = resolveNodeId("HasTypeDefinition");

export interface ToStringOption {
    level: number;
    cycleDetector: any;
    padding: string;

    add(someLine: string): void;
    indent(a: string, b: string | null): void;
}

export class ToStringBuilder implements ToStringOption {
    public level = 0;
    public cycleDetector: any = {};
    public padding = "";

    private str: string[] = [];

    constructor() {
        //
        this.str = [];
    }
    public add(line: string): void {
        this.str.push(line);
    }
    public toString(): string {
        return this.str.join("\n");
    }

    public indent(str: string, padding: string | null): string {
        padding = padding || "          ";
        return str
            .split("\n")
            .map((r) => {
                return padding + r;
            })
            .join("\n");
    }
}

function set_as_processed(options: ToStringOption, nodeId: NodeId) {
    options.cycleDetector[nodeId.toString()] = nodeId;
}
function is_already_processed(options: ToStringOption, nodeId: NodeId): boolean {
    return !!options.cycleDetector[nodeId.toString()];
}

export function BaseNode_toString(this: BaseNode, options: ToStringOption): void {
    options.level = options.level || 1;

    set_as_processed(options, this.nodeId);

    options.add("");
    options.add(options.padding + chalk.yellow("          nodeId              : ") + this.nodeId.toString());
    options.add(
        options.padding + chalk.yellow("          nodeClass           : ") + NodeClass[this.nodeClass] + " (" + this.nodeClass + ")"
    );
    options.add(options.padding + chalk.yellow("          browseName          : ") + this.browseName.toString());
    options.add(
        options.padding +
            chalk.yellow("          displayName         : ") +
            this.displayName.map((f) => f.locale + " " + f.text).join(" | ")
    );

    options.add(
        options.padding + chalk.yellow("          description         : ") + (this.description ? this.description.toString() : "")
    );
}

export function BaseNode_References_toString(this: BaseNode, options: ToStringOption): void {
    const _private = BaseNode_getPrivate(this);

    const displayOptions = {
        addressSpace: this.addressSpace
    };

    const addressSpace = this.addressSpace;

    options.add(
        options.padding + chalk.yellow("          references    : ") + "  length =" + Object.keys(_private._referenceIdx).length
    );

    function dump_reference(follow: boolean, reference: UAReference | null) {
        if (!reference) {
            return;
        }
        const o = ReferenceImpl.resolveReferenceNode(addressSpace, reference);
        const name = o ? o.browseName.toString() : "<???>";
        options.add(
            options.padding + chalk.yellow("               +-> ") + reference.toString(displayOptions) + " " + chalk.cyan(name)
        );

        // ignore HasTypeDefinition as it has been already handled
        if (sameNodeId(reference.referenceType, hasTypeDefinition_ReferenceTypeNodeId) && reference.nodeId.namespace === 0) {
            return;
        }
        if (o) {
            if (!is_already_processed(options, o.nodeId)) {
                set_as_processed(options, o.nodeId);
                if (options.level > 1 && follow) {
                    const rr = (o as any).toString({
                        cycleDetector: options.cycleDetector,
                        level: options.level - 1,
                        padding: options.padding + "         "
                    });
                    options.add(rr);
                }
            }
        }
    }

    // direct reference
    (Object.values(_private._referenceIdx) as UAReference[]).forEach(dump_reference.bind(null, true));

    const br = Object.values(_private._back_referenceIdx).map((x) => x);

    options.add(
        options.padding +
            chalk.yellow("          back_references     : ") +
            chalk.cyan("  length =") +
            br.length +
            chalk.grey(" ( references held by other nodes involving this node)")
    );
    // backward reference
    br.forEach(dump_reference.bind(null, false));
}

function _UAType_toString(this: UAReferenceType | UADataType | UAObjectType | UAVariableType, options: ToStringOption): void {
    if (this.subtypeOfObj) {
        options.add(
            options.padding +
                chalk.yellow("          subtypeOf           : ") +
                this.subtypeOfObj.browseName.toString() +
                " (" +
                this.subtypeOfObj.nodeId.toString() +
                ")"
        );
    }
}

function _UAInstance_toString(this: UAVariable | UAMethod | UAObject, options: ToStringOption): void {
    if (this.typeDefinitionObj) {
        options.add(
            options.padding +
                chalk.yellow("          typeDefinition      : ") +
                this.typeDefinitionObj.browseName.toString() +
                " (" +
                this.typeDefinitionObj.nodeId.toString() +
                ")"
        );
    }
}

export function UAVariableType_toString(this: UAVariableType, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAType_toString.call(this, options);
    VariableOrVariableType_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function UAVariable_toString(this: UAVariable, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAInstance_toString.call(this, options);
    VariableOrVariableType_toString.call(this, options);
    AccessLevelFlags_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function UAObject_toString(this: UAObject, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAInstance_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function UAObjectType_toString(this: UAObjectType, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAType_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function valueRankToString(valueRank: number): string {
    switch (valueRank) {
        case 1:
            return "OneDimension (1)";
        case 0:
            return "OneOrMoreDimensions (0)"; // The value is an array with one or more dimensions
        case -1:
            return "Scalar (-1)";
        case -2:
            return "Any (-2)"; // The value can be a scalar or an array with any number of dimensions
        case -3:
            return "ScalarOrOneDimension (2)"; // The value can be a scalar or a one dimensional array.
        default:
            if (valueRank > 0) {
                return "" + valueRank + "-Dimensions";
            } else {
                return "Invalid (" + valueRank + ")";
            }
    }
}

function accessLevelFlagToString(flag: AccessLevelFlag): string {
    const str: string[] = [];
    if (flag & AccessLevelFlag.CurrentRead) {
        str.push("CurrentRead");
    }
    if (flag & AccessLevelFlag.CurrentWrite) {
        str.push("CurrentWrite");
    }
    if (flag & AccessLevelFlag.HistoryRead) {
        str.push("HistoryRead");
    }
    if (flag & AccessLevelFlag.HistoryWrite) {
        str.push("HistoryWrite");
    }
    if (flag & AccessLevelFlag.SemanticChange) {
        str.push("SemanticChange");
    }
    if (flag & AccessLevelFlag.StatusWrite) {
        str.push("StatusWrite");
    }
    if (flag & AccessLevelFlag.TimestampWrite) {
        str.push("TimestampWrite");
    }
    return str.join(" | ");
}

function AccessLevelFlags_toString(this: UAVariable, options: ToStringOption) {
    assert(options);
    options.add(
        options.padding + chalk.yellow("          accessLevel         : ") + " " + accessLevelFlagToString(this.accessLevel)
    );
    if (this.userAccessLevel !== undefined) {
        options.add(
            options.padding + chalk.yellow("          userAccessLevel     : ") + " " + accessLevelFlagToString(this.userAccessLevel)
        );
    }
}
export function VariableOrVariableType_toString(this: UAVariableType | UAVariable, options: ToStringOption): void {
    assert(options);
    if (this.dataType) {
        const addressSpace = this.addressSpace;
        const d = addressSpace.findNode(this.dataType);
        const n = d ? "(" + d.browseName.toString() + ")" : " (???)";
        options.add(options.padding + chalk.yellow("          dataType            : ") + this.dataType + "  " + n);
    }
    if (this.nodeClass === NodeClass.Variable) {
        const _dataValue = (<any>this)._dataValue as DataValue | undefined;
        if (_dataValue) {
            options.add(
                options.padding +
                    chalk.yellow("          value               : ") +
                    "\n" +
                    options.indent(_dataValue.toString(), options.padding + "                        | ")
            );
        }
    }

    if (Object.prototype.hasOwnProperty.call(this, "valueRank")) {
        if (this.valueRank !== undefined) {
            options.add(
                options.padding + chalk.yellow("          valueRank           : ") + " " + valueRankToString(this.valueRank)
            );
        } else {
            options.add(options.padding + chalk.yellow("          valueRank           : ") + " undefined");
        }
    }
    if (this.minimumSamplingInterval !== undefined) {
        options.add(
            options.padding +
                chalk.yellow(" minimumSamplingInterval      : ") +
                " " +
                this.minimumSamplingInterval.toString() +
                " ms"
        );
    }
    if (this.arrayDimensions) {
        options.add(
            options.padding +
                chalk.yellow(" arrayDimension               : ") +
                " [" +
                this.arrayDimensions.join(",").toString() +
                " ]"
        );
    }
}

/**
 * clone properties and methods
 * @private
 */
function _clone_collection_new(
    newParent: BaseNode,
    collectionRef: UAReference[],
    copyAlsoModellingRules: boolean,
    optionalFilter?: CloneFilter,
    extraInfo?: CloneExtraInfo
): void {
    const namespace = newParent.namespace;

    const addressSpace = newParent.addressSpace;
    assert(!optionalFilter || (typeof optionalFilter.shouldKeep === "function" && typeof optionalFilter.filterFor === "function"));

    for (const reference of collectionRef) {
        const node: BaseNode = ReferenceImpl.resolveReferenceNode(addressSpace, reference);

        // ensure node is of the correct type,
        // it may happen that the xml nodeset2 file was malformed

        // istanbul ignore next
        if (typeof (node as any).clone !== "function") {
            // tslint:disable-next-line:no-console
            warningLog(
                chalk.red("Warning : cannot clone node ") +
                    node.browseName.toString() +
                    " of class " +
                    NodeClass[node.nodeClass].toString() +
                    " while cloning " +
                    newParent.browseName.toString()
            );
            continue;
        }

        if (optionalFilter && node && !optionalFilter.shouldKeep(node)) {
            continue; // skip this node
        }

        assert(reference.isForward);
        assert(reference.referenceType instanceof NodeId, "" + reference.referenceType.toString());
        const options = {
            namespace,
            references: [new ReferenceImpl({ referenceType: reference.referenceType, isForward: false, nodeId: newParent.nodeId })],
            copyAlsoModellingRules
        };

        const clone = (node as UAVariable | UAMethod | UAObject).clone(options, optionalFilter, extraInfo);

        if (extraInfo) {
            extraInfo.registerClonedObject(node, clone);
        }
    }
}

export function _clone_children_references(
    node: BaseNode,
    newParent: BaseNode,
    copyAlsoModellingRules: boolean,
    optionalFilter?: CloneFilter,
    extraInfo?: CloneExtraInfo
): void {
    // find all reference that derives from the Aggregates
    const aggregatesRef = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
    _clone_collection_new(newParent, aggregatesRef, copyAlsoModellingRules, optionalFilter, extraInfo);
}

export function _clone_non_hierarchical_references(
    node: BaseNode,
    newParent: BaseNode,
    copyAlsoModellingRules: boolean,
    optionalFilter?: CloneFilter,
    extraInfo?: CloneExtraInfo
): void {
    // clone only some non hierarchical_references that we do want to clone
    // such as:
    //   HasSubStateMachine
    //   (may be other as well later ... to do )
    assert(newParent instanceof BaseNodeImpl);
    // find all reference that derives from the HasSubStateMachine
    const references = node.findReferencesEx("HasSubStateMachine", BrowseDirection.Forward);
    _clone_collection_new(newParent, references, copyAlsoModellingRules, optionalFilter, extraInfo);
}

/**
 * @method _clone
 * @private
 */
export function _clone<T extends UAObject | UAVariable | UAMethod>(
    this: T,
    Constructor: new (options: any) => T,
    options: CloneOptions,
    optionalFilter?: CloneFilter,
    extraInfo?: CloneExtraInfo
): T {
    assert(typeof Constructor === "function");
    assert(options !== null && typeof options === "object");
    assert(
        !extraInfo || (extraInfo !== null && typeof extraInfo === "object" && typeof extraInfo.registerClonedObject === "function")
    );
    assert(!(this as any).subtypeOf, "We do not do cloning of Type yet");

    const namespace = options.namespace;
    const constructorOptions: any = {
        ...options,
        addressSpace: namespace.addressSpace,
        browseName: this.browseName,
        description: this.description,
        displayName: this.displayName,
        nodeClass: this.nodeClass
    };
    constructorOptions.references = options.references || [];

    if (this.nodeClass === NodeClass.Variable || this.nodeClass === NodeClass.Object) {
        const voThis = this as UAObject | UAVariable;
        if (voThis.typeDefinition) {
            constructorOptions.references.push(
                new ReferenceImpl({
                    isForward: true,
                    nodeId: voThis.typeDefinition,
                    referenceType: resolveNodeId("HasTypeDefinition")
                })
            );
        }
    }

    if (!constructorOptions.modellingRule) {
        if (this.modellingRule && options.copyAlsoModellingRules) {
            const modellingRuleNode = this.findReferencesAsObject("HasModellingRule", true)[0];
            assert(modellingRuleNode);
            constructorOptions.references.push(
                new ReferenceImpl({
                    isForward: true,
                    nodeId: modellingRuleNode.nodeId,
                    referenceType: resolveNodeId("HasModellingRule")
                })
            );
        }
    } else {
        UANamespace_process_modelling_rule(constructorOptions.references, constructorOptions.modellingRule);
    }

    constructorOptions.nodeId = namespace.constructNodeId(constructorOptions as ConstructNodeIdOptions);

    assert(constructorOptions.nodeId instanceof NodeId);

    const cloneObj = new Constructor(constructorOptions);
    (this.addressSpace as AddressSpacePrivate)._register(cloneObj);

    options.copyAlsoModellingRules = options.copyAlsoModellingRules || false;

    const newFilter = optionalFilter ? optionalFilter.filterFor(cloneObj) : undefined;
    _clone_children_references(this, cloneObj, options.copyAlsoModellingRules, newFilter, extraInfo);
    _clone_non_hierarchical_references(this, cloneObj, options.copyAlsoModellingRules, newFilter, extraInfo);

    cloneObj.propagate_back_references();

    cloneObj.install_extra_properties();

    return cloneObj;
}

export function _handle_HierarchicalReference(node: BaseNode, reference: UAReference): void {
    const _cache = BaseNode_getCache(node);
    if (!reference.isForward) return;
    if (_cache._childByNameMap) {
        const addressSpace = node.addressSpace;
        const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);

        if (referenceType) {
            const HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");
            if (referenceType.isSupertypeOf(HierarchicalReferencesType!)) {
                assert(reference.isForward);
                const targetNode = ReferenceImpl.resolveReferenceNode(addressSpace, reference);
                _cache._childByNameMap[targetNode.browseName!.name!.toString()] = targetNode;
            }
        }
    }
}

function _remove_HierarchicalReference(node: BaseNode, reference: UAReference) {
    const _cache = BaseNode_getCache(node);
    if (_cache._childByNameMap) {
        const addressSpace = node.addressSpace;
        const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);

        if (referenceType) {
            const HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");
            if (referenceType.isSupertypeOf(HierarchicalReferencesType!)) {
                assert(reference.isForward);
                const targetNode = ReferenceImpl.resolveReferenceNode(addressSpace, reference);
                // Xx console.log(" adding object to map");
                delete _cache._childByNameMap[targetNode.browseName!.name!.toString()];
            }
        }
    }
}

function _makeReferenceDescription(addressSpace: IAddressSpace, reference: UAReference, resultMask: number): ReferenceDescription {
    const isForward = reference.isForward;

    const referenceTypeId = ReferenceImpl.resolveReferenceType(addressSpace, reference).nodeId;
    assert(referenceTypeId instanceof NodeId);

    const obj = ReferenceImpl.resolveReferenceNode(addressSpace, reference) as any;

    let data: any = {};

    if (!obj) {
        // cannot find reference node
        data = {
            isForward,
            nodeId: reference.nodeId,
            referenceTypeId: resultMask & ResultMask.ReferenceType ? referenceTypeId : null,
            typeDefinition: null
        };
    } else {
        assert(reference.nodeId, " obj.nodeId");
        data = {
            browseName: resultMask & ResultMask.BrowseName ? coerceQualifiedName(obj.browseName) : null,
            displayName: resultMask & ResultMask.DisplayName ? coerceLocalizedText(obj.displayName[0]) : null,
            isForward: resultMask & ResultMask.IsForward ? isForward : false,
            nodeClass: resultMask & ResultMask.NodeClass ? obj.nodeClass : NodeClass.Unspecified,
            nodeId: obj.nodeId,
            referenceTypeId: resultMask & ResultMask.ReferenceType ? referenceTypeId : null,
            typeDefinition: resultMask & ResultMask.TypeDefinition ? obj.typeDefinition : null
        };
    }
    if (data.typeDefinition === null) {
        data.typeDefinition = NodeId.nullNodeId;
    }
    const referenceDescription = new ReferenceDescription(data);
    return referenceDescription;
}

export function _constructReferenceDescription(
    addressSpace: IAddressSpace,
    references: UAReference[],
    resultMask: number
): ReferenceDescription[] {
    assert(Array.isArray(references));
    return references.map((reference: UAReference) => _makeReferenceDescription(addressSpace, reference, resultMask));
}

export function BaseNode_remove_backward_reference(this: BaseNode, reference: UAReference): void {
    const _private = BaseNode_getPrivate(this);
    _remove_HierarchicalReference(this, reference);
    const h = (<ReferenceImpl>reference).hash;
    if (_private._back_referenceIdx && _private._back_referenceIdx[h]) {
        // note : h may not exist in _back_referenceIdx since we are not indexing
        //        _back_referenceIdx to UAObjectType and UAVariableType for performance reasons
        (<ReferenceImpl>_private._back_referenceIdx[h]).dispose();
        delete _private._back_referenceIdx[h];
    }
    (<ReferenceImpl>reference).dispose();
}

export function BaseNode_add_backward_reference(this: BaseNode, reference: UAReference): void {
    const _private = BaseNode_getPrivate(this);

    const h = (<ReferenceImpl>reference).hash;
    assert(typeof h === "string");
    // istanbul ignore next
    if (_private._referenceIdx[h]) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <UAReference>
        //  in this case there is nothing to do
        return;
    }
    // istanbul ignore next
    if (_private._back_referenceIdx[h]) {
        const opts = { addressSpace: this.addressSpace };
        // tslint:disable-next-line:no-console
        console.warn(" Warning !", this.browseName.toString());
        // tslint:disable-next-line:no-console
        console.warn("    ", reference.toString(opts));
        // tslint:disable-next-line:no-console
        console.warn(" already found in ===>");
        // tslint:disable-next-line:no-console
        console.warn(
            (Object.values(_private._back_referenceIdx) as UAReference[]).map((c: UAReference) => c.toString(opts)).join("\n")
        );
        // tslint:disable-next-line:no-console
        console.warn("===>");
        throw new Error("reference exists already in _back_references");
    }

    if (!getReferenceType(reference)) {
        const stop_here = 1;
    }
    //  assert(reference._referenceType instanceof ReferenceType);
    _private._back_referenceIdx[h] = reference;
    _handle_HierarchicalReference(this, reference);
    (this as any)._clear_caches();
}
