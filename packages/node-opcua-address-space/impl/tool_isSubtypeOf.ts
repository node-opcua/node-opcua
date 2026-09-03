/**
 * @module node-opcua-address-space
 */

import type {
    BaseNode,
    UADataType,
    UAObjectType,
    UAReference,
    UAReferenceType,
    UAVariableType
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { type NodeId, type NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import type { BaseNodeImpl } from "./base_node_impl.js";
import { BaseNode_getCache } from "./base_node_private.js";
import { nodeIdKey, ReferenceImpl } from "./reference_impl.js";
import { typeHierarchyVersion } from "./reference_type_version.js";

const HasSubTypeNodeId = resolveNodeId("HasSubtype");

function _filterSubType(reference: UAReference) {
    return sameNodeId(reference.referenceType, HasSubTypeNodeId) && !reference.isForward;
}

export type BaseNodeConstructor<T extends BaseNode> = new () => T;

function _slow_isSubtypeOf<T extends UAType>(this: T, Class: typeof BaseNodeImpl, baseType: T | NodeIdLike): boolean {
    if (!(baseType instanceof Class)) {
        const node = this.addressSpace.findNode(baseType as NodeIdLike);
        if (!node || !(node instanceof Class)) {
            throw new Error("Invalid argument");
        }
        return _slow_isSubtypeOf.call(this, Class, node as unknown as T);
    }
    assert(this instanceof Class);
    assert(baseType instanceof Class, " Object must have same type");
    assert(this.addressSpace);

    if (sameNodeId(this.nodeId, baseType.nodeId)) {
        return true;
    }
    const references = this.allReferences();

    const subTypes = references.filter(_filterSubType);
    assert(subTypes.length <= 1, "should have zero or one subtype no more");

    for (const subType1 of subTypes) {
        const subTypeId = subType1.nodeId;
        const subTypeNode = this.addressSpace.findNode(subTypeId) as unknown as T;
        // c8 ignore next
        if (!subTypeNode) {
            throw new Error(`Cannot find object with nodeId ${subTypeId.toString()}`);
        }
        if (sameNodeId(subTypeNode.nodeId, baseType.nodeId)) {
            return true;
        } else {
            if (_slow_isSubtypeOf.call(subTypeNode, Class, baseType)) {
                return true;
            }
        }
    }
    return false;
}

export type MemberFuncValue<T, P, R> = (this: T, param: P) => R;

// per node, the memo of its isSubtypeOf answers, keyed by the argument's NodeId (a number for a
// numeric id, so that the common call builds no string): a memo keyed by the node itself would
// keep every type ever asked about alive, deleted or not
const g_WeakMap = new WeakMap<object, Map<string | number, unknown>>();
/** the typeHierarchyVersion each memo was built against */
const g_memoVersion = new WeakMap<object, number>();

export function wipeMemorizedStuff(node: object) {
    if (g_WeakMap.has(node)) {
        g_WeakMap.delete(node);
    }
}

//  http://jsperf.com/underscore-js-memoize-refactor-test
//  http://addyosmani.com/blog/faster-javascript-memoization/
function wrap_memoize<T extends object, P, R>(
    func: MemberFuncValue<T, P, R>,
    hashFunc?: (this: T, param: P) => string | number
): MemberFuncValue<T, P, R> {
    const effectiveHashFunc: (this: T, param: P) => string | number =
        hashFunc ??
        function (this: T, param: P) {
            return (param as unknown as object).toString();
        };
    return function memoize(this: T, param: P): R {
        let memoMap = g_WeakMap.get(this) as Map<string | number, R> | undefined;
        if (!memoMap || g_memoVersion.get(this) !== typeHierarchyVersion.count) {
            // no memo yet, or a HasSubtype reference moved somewhere since it was built
            memoMap = new Map<string | number, R>();
            g_WeakMap.set(this, memoMap as Map<string | number, unknown>);
            g_memoVersion.set(this, typeHierarchyVersion.count);
        }

        const hash = effectiveHashFunc.call(this, param);
        if (memoMap.has(hash)) {
            return memoMap.get(hash) as R;
        }
        const cache_value = func.call(this, param);
        memoMap.set(hash, cache_value);
        return cache_value;
    };
}

function hashBaseNode(e: BaseNode | NodeIdLike): string | number {
    if (e && typeof e === "object" && "nodeId" in e) {
        return nodeIdKey((e as BaseNode).nodeId);
    }
    return nodeIdKey(resolveNodeId(e as NodeIdLike));
}

export type IsSubtypeOfFunc<T extends UAType> = (this: T, baseType: T) => boolean;

export type UAType = UAReferenceType | UADataType | UAObjectType | UAVariableType;

export function construct_isSubtypeOf<T extends UAType>(Class: typeof BaseNodeImpl): IsSubtypeOfFunc<T> {
    return wrap_memoize(function (this: T, baseType: T | NodeIdLike): boolean {
        if (!(baseType instanceof Class)) {
            throw new Error(
                "expecting baseType to be " +
                    Class.name +
                    " but got " +
                    baseType.toString() +
                    " " +
                    NodeClass[(baseType as BaseNode).nodeClass]
            );
        }
        if (!(this instanceof Class)) {
            throw new Error(`expecting this to be ${Class.name} but got ${baseType.toString()}`);
        }
        return _slow_isSubtypeOf.call(this, Class, baseType as T);
    }, hashBaseNode);
}

export function construct_slow_isSubtypeOf<T extends UAType>(Class: typeof BaseNodeImpl) {
    return function (this: T, baseType: T | NodeIdLike): boolean {
        return _slow_isSubtypeOf.call(this, Class, baseType);
    };
}

/**
 * returns the nodeId of the Type which is the super type of this
 */
export function get_subtypeOf<T extends BaseNode>(this: T): NodeId | null {
    const s = get_subtypeOfObj.call(this);
    return s ? s.nodeId : null;
}

export function get_subtypeOfObj<T extends BaseNode>(this: T): T | null {
    const _cache = BaseNode_getCache(this);

    if (_cache._subtypeOfObj === undefined) {
        const is_subtype_of_ref = this.findReference("HasSubtype", false);
        if (is_subtype_of_ref) {
            _cache._subtypeOfObj = ReferenceImpl.resolveReferenceNode(this.addressSpace, is_subtype_of_ref);
        } else {
            _cache._subtypeOfObj = null;
        }
    }
    return (_cache._subtypeOfObj as T) || null;
}
