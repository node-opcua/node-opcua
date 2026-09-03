/**
 * @module node-opcua-address-space
 */
import chalk from "chalk";
import type { AddReferenceOpts, BaseNode, IAddressSpace, UAReference, UAReferenceType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { ReferenceTypeIds } from "node-opcua-constants";
import { coerceNodeId, NodeId, type NodeIdLike, NodeIdType, sameNodeId } from "node-opcua-nodeid";
import { isNullOrUndefined } from "node-opcua-utils";

export function isNodeIdString(str: string): boolean {
    assert(typeof str === "string");
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}

function is_valid_reference(ref: UAReference): boolean {
    const hasRequestedProperties =
        Object.hasOwn(ref, "referenceType") && Object.hasOwn(ref, "nodeId") && !isNullOrUndefined(ref.isForward);

    if (!hasRequestedProperties) {
        return false;
    }
    assert(ref.referenceType instanceof NodeId);
    assert(!ref.node || sameNodeId(ref.node.nodeId, ref.nodeId));
    // xx assert(!ref.referenceTypeName || typeof ref.referenceTypeName === "string");
    // xx // referenceType shall no be a nodeId string (this could happen by mistake)
    // xx assert(!isNodeIdString(ref.referenceType));
    return true;
}

/**
 * @private
 *
 * @example
 *       ---- some text ----->
 */
function _arrow(text: string, length: number, isForward: boolean): string {
    length = Math.max(length, text.length + 8);
    const nb = Math.floor((length - text.length - 2) / 2);
    const h = Array(nb).join("-");

    const extra = text.length % 2 === 1 ? "-" : "";

    if (isForward) {
        return `${extra + h} ${text} ${h}> `;
    }
    return `<${h} ${text} ${h}${extra} `;
}

function _w(str: string, width: number): string {
    return str.padEnd(width).substring(0, width);
}

function _localCoerceToNodeID(nodeIdLike: string | NodeIdLike | { nodeId: NodeId }): NodeId {
    if (typeof nodeIdLike === "object" && Object.hasOwn(nodeIdLike, "nodeId")) {
        return (nodeIdLike as { nodeId: NodeId }).nodeId;
    }
    return coerceNodeId(nodeIdLike);
}

export interface MinimalistAddressSpace {
    findNode(nodeId: NodeIdLike): BaseNode | null;

    findReferenceType(referenceTypeId: NodeIdLike | UAReferenceType, namespaceIndex?: number): UAReferenceType | null;
}

/**
 * The key a reference is indexed under in a node: one safe integer for the common case, a string
 * otherwise. A load of the standard nodeset indexes 17 000 references; building a string for each
 * (two NodeId.toString and a concatenation) was a measurable share of node construction and of
 * the retained heap.
 */
export type ReferenceKey = number | string;

/** what a reference key needs from the address space: a small ordinal per reference type */
export interface ReferenceTypeOrdinals {
    referenceTypeOrdinal(referenceType: NodeId): number;
}

const NODE_KEY_SPAN = 0x10000000000; // 2^40: a namespace index below 256 and a 32-bit numeric identifier
const MAX_PACKED_ORDINAL = 4096; // (2 * 4096) * 2^40 = 2^53, the safe-integer limit

/**
 * the key of a node in reference indexes: a number below 2^40 for a numeric NodeId in a namespace
 * below 256, which is what nodesets carry, a string for the rest
 */
/**
 * HasTypeDefinition and HasModellingRule never get a back reference: there would be thousands
 * per type or modelling rule, and nothing browses them that way
 */
export function isMassivelyUsedReferenceType(referenceType: NodeId): boolean {
    return (
        referenceType.namespace === 0 &&
        (referenceType.value === ReferenceTypeIds.HasTypeDefinition || referenceType.value === ReferenceTypeIds.HasModellingRule)
    );
}

export function nodeIdKey(nodeId: NodeId): number | string {
    if (nodeId.identifierType === NodeIdType.NUMERIC && nodeId.namespace < 256) {
        return nodeId.namespace * 0x100000000 + (nodeId.value as number);
    }
    return nodeId.toString();
}

/**
 * the key of a reference (direction, reference type, target) given the reference type ordinal
 * and the target key; a safe integer when both fit, a string otherwise
 */
export function referenceKey(isForward: boolean, referenceTypeOrdinal: number, targetKey: number | string): ReferenceKey {
    if (typeof targetKey === "number" && referenceTypeOrdinal < MAX_PACKED_ORDINAL) {
        return (referenceTypeOrdinal * 2 + (isForward ? 1 : 0)) * NODE_KEY_SPAN + targetKey;
    }
    return `${isForward ? "" : "!"}${referenceTypeOrdinal}-${targetKey}`;
}

export function resolveReferenceNode(addressSpace: MinimalistAddressSpace, reference: UAReference): BaseNode {
    const _reference = reference as ReferenceImpl;
    if (!_reference.node) {
        _reference.node = addressSpace.findNode(reference.nodeId) as BaseNode;
    }
    return _reference.node;
}

export function resolveReferenceType(addressSpace: MinimalistAddressSpace, reference: UAReference): UAReferenceType {
    const _reference = reference as ReferenceImpl;
    if (!_reference._referenceType) {
        if (!_reference.referenceType) {
            errorLog(chalk.red("ERROR MISSING reference"), reference);
        }
        _reference._referenceType = addressSpace.findReferenceType(reference.referenceType) as UAReferenceType;
    }
    return _reference._referenceType;
}

/**
 * @class Reference
 * @param options.referenceType {NodeId}
 * @param options.nodeId        {NodeId}
 * @param options.isForward     {Boolean}
 * @constructor
 */
export class ReferenceImpl implements UAReference {
    public static resolveReferenceNode(addressSpace: MinimalistAddressSpace, reference: UAReference): BaseNode {
        return resolveReferenceNode(addressSpace, reference);
    }

    public static resolveReferenceType(addressSpace: MinimalistAddressSpace, reference: UAReference): UAReferenceType {
        return resolveReferenceType(addressSpace, reference);
    }

    public nodeId: NodeId;
    public referenceType: NodeId;
    public _referenceType?: UAReferenceType;
    public readonly isForward: boolean;

    public node?: BaseNode;

    // cache
    private __hash?: string;
    private __key?: ReferenceKey;

    constructor(options: AddReferenceOpts | UAReference) {
        assert(options.referenceType instanceof NodeId);
        assert(options.nodeId instanceof NodeId);

        this.referenceType = coerceNodeId(options.referenceType);
        this.isForward = options.isForward === undefined ? true : !!options.isForward;
        this.nodeId = _localCoerceToNodeID(options.nodeId);
        // optional to speed up when AddReferenceOpts is in fact a Reference !
        this._referenceType = (options as Partial<ReferenceImpl>)._referenceType;
        this.node = options.node;
        assert(is_valid_reference(this));
    }

    /**
     * turn reference into a arrow :   ---- ReferenceType --> [NodeId]

     * @return {String}
     */
    public toString(options?: { addressSpace?: IAddressSpace }): string {
        let infoNode = _w(this.nodeId.toString(), 24);
        let refType = this.referenceType.toString();

        if (options?.addressSpace) {
            const node = options.addressSpace.findNode(this.nodeId);
            infoNode = `[${infoNode}]${_w(node?.browseName.toString() || "", 40)}`;

            const ref = options.addressSpace.findReferenceType(this.referenceType);
            if (ref) {
                const refNode = options.addressSpace.findNode(ref.nodeId);
                refType = `${refNode?.browseName.toString() || "<unknown>"} (${ref.nodeId.toString()})`;
            }
        }
        return _arrow(refType, 40, this.isForward) + infoNode;
    }

    /**
     * @internal
     */
    get hash(): string {
        if (!this.__hash) {
            this.__hash = `${(this.isForward ? "" : "!") + this.referenceType.toString()}-${this.nodeId.toString()}`;
        }
        return this.__hash;
    }

    /**
     * @internal
     * the key this reference is indexed under in the node holding it, computed once
     */
    key(ordinals: ReferenceTypeOrdinals): ReferenceKey {
        if (this.__key === undefined) {
            this.__key = referenceKey(this.isForward, ordinals.referenceTypeOrdinal(this.referenceType), nodeIdKey(this.nodeId));
        }
        return this.__key;
    }

    /**
     * @internal
     * the key of the reference that the node `sourceNodeKey` would hold to point back at us: what
     * `BaseNode_add_backward_reference` would create, so that the caller can find out first
     * whether it exists already, without allocating anything
     */
    inverseKey(ordinals: ReferenceTypeOrdinals, sourceNodeKey: number | string): ReferenceKey {
        return referenceKey(!this.isForward, ordinals.referenceTypeOrdinal(this.referenceType), sourceNodeKey);
    }

    /**
     * @internal
     */
    public dispose(): void {
        this.__hash = undefined;
        this.__key = undefined;
        this.node = undefined;
        /*
        this._referenceType = null;
        this.nodeId = null as NodeId;
        this.referenceType = null as NodeId;
        */
    }
}
function errorLog(_arg0: string, _reference: UAReference) {
    throw new Error("Function not implemented.");
}
