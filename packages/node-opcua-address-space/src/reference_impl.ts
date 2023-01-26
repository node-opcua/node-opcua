/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-console
import * as chalk from "chalk";
import { AddReferenceOpts, UAReference, BaseNode, UAReferenceType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { coerceNodeId, NodeId, NodeIdLike, sameNodeId } from "node-opcua-nodeid";
import * as utils from "node-opcua-utils";

export function isNodeIdString(str: string): boolean {
    assert(typeof str === "string");
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}

function is_valid_reference(ref: UAReference): boolean {
    const hasRequestedProperties =
        Object.prototype.hasOwnProperty.call(ref, "referenceType") &&
        Object.prototype.hasOwnProperty.call(ref, "nodeId") &&
        !utils.isNullOrUndefined(ref.isForward);

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
        return extra + h + " " + text + " " + h + "> ";
    }
    return "<" + h + " " + text + " " + h + extra + " ";
}

function _w(str: string, width: number): string {
    return str.padEnd(width).substring(0, width);
}

function _localCoerceToNodeID(nodeIdLike: string | NodeIdLike | { nodeId: NodeId }): NodeId {
    if (Object.prototype.hasOwnProperty.call(nodeIdLike, "nodeId")) {
        return (nodeIdLike as { nodeId: NodeId }).nodeId;
    }
    return coerceNodeId(nodeIdLike);
}

export interface MinimalistAddressSpace {
    findNode(nodeId: NodeIdLike): BaseNode | null;

    findReferenceType(referenceTypeId: NodeIdLike | UAReferenceType, namespaceIndex?: number): UAReferenceType | null;
}

export function resolveReferenceNode(addressSpace: MinimalistAddressSpace, reference: UAReference): BaseNode {
    const _reference = reference as ReferenceImpl;
    if (!_reference.node) {
        _reference.node = addressSpace.findNode(reference.nodeId)!;
    }
    return _reference.node;
}

export function resolveReferenceType(addressSpace: MinimalistAddressSpace, reference: UAReference): UAReferenceType {
    const _reference = reference as ReferenceImpl;
    if (!_reference._referenceType) {
        if (!_reference.referenceType) {
            console.log(chalk.red("ERROR MISSING reference"), reference);
        }
        _reference._referenceType = addressSpace.findReferenceType(reference.referenceType)!;
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

    constructor(options: AddReferenceOpts | UAReference) {
        assert(options.referenceType instanceof NodeId);
        assert(options.nodeId instanceof NodeId);

        this.referenceType = coerceNodeId(options.referenceType);
        this.isForward = options.isForward === undefined ? true : !!options.isForward;
        this.nodeId = _localCoerceToNodeID(options.nodeId);

        // optional to speed up when AddReferenceOpts is in fact a Reference !
        this._referenceType = (options as any)._referenceType;
        this.node = (options as any).node;

        assert(is_valid_reference(this));
    }

    /**
     * turn reference into a arrow :   ---- ReferenceType --> [NodeId]
     * @method toString
     * @return {String}
     */
    public toString(options?: { addressSpace?: any }): string {
        let infoNode = _w(this.nodeId.toString(), 24);
        let refType = this.referenceType.toString();

        if (options && options.addressSpace) {
            const node = options.addressSpace.findNode(this.nodeId);
            infoNode = "[" + infoNode + "]" + _w(node?.browseName.toString(), 40);

            const ref = options.addressSpace.findReferenceType(this.referenceType);
            const refNode = options.addressSpace.findNode(ref.nodeId);
            refType = refNode.browseName.toString() + " (" + ref.nodeId.toString() + ")";
        }
        return _arrow(refType, 40, this.isForward) + infoNode;
    }

    /**
     * @internal
     */
    get hash(): string {
        if (!this.__hash) {
            this.__hash = (this.isForward ? "" : "!") + this.referenceType.toString() + "-" + this.nodeId.toString();
        }
        return this.__hash;
    }

    /**
     * @internal
     */
    public dispose(): void {
        this.__hash = undefined;
        this.node = undefined;
        /*
        this._referenceType = null;
        this.nodeId = null as NodeId;
        this.referenceType = null as NodeId;
        */
    }
}
