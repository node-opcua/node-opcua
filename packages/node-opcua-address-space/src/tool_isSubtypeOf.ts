/**
 * @module node-opcua-address-space
 */

import type {
    BaseNode,
    BaseNodeEvents,
    UADataType,
    UAObjectType,
    UAReference,
    UAReferenceType,
    UAVariableType
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { type NodeId, type NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import type { BaseNodeImpl } from "./base_node_impl";
import { BaseNode_getCache } from "./base_node_private";
import { ReferenceImpl } from "./reference_impl";

const HasSubTypeNodeId = resolveNodeId("HasSubtype");

function _filterSubType(reference: UAReference) {
    return sameNodeId(reference.referenceType, HasSubTypeNodeId) && !reference.isForward;
}

export type BaseNodeConstructor<T extends BaseNode> = new () => T;

function _slow_isSubtypeOf<T extends UAType>(
    this: T,
    Class: typeof BaseNodeImpl,
    baseType: T | NodeIdLike
): boolean {
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

const g_WeakMap = new WeakMap<object, Map<string, unknown>>();

export function wipeMemorizedStuff(node: object) {
    if (g_WeakMap.has(node)) {
        g_WeakMap.delete(node);
    }
}

//  http://jsperf.com/underscore-js-memoize-refactor-test
//  http://addyosmani.com/blog/faster-javascript-memoization/
function wrap_memoize<T extends object, P, R>(
    func: MemberFuncValue<T, P, R>,
    hashFunc?: (this: T, param: P) => string
): MemberFuncValue<T, P, R> {
    const effectiveHashFunc: (this: T, param: P) => string =
        hashFunc ??
        function (this: T, param: P) {
            return (param as unknown as object).toString();
        };
    return function memoize(this: T, param: P): R {
        let memoMap = g_WeakMap.get(this) as Map<string, R> | undefined;
        if (!memoMap) {
            memoMap = new Map<string, R>();
            g_WeakMap.set(this, memoMap as Map<string, unknown>);
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

function hashBaseNode(e: BaseNode | NodeIdLike): string {
    if (e && typeof e === "object" && "nodeId" in e) {
        return (e as BaseNode).nodeId.toString();
    }
    return resolveNodeId(e as NodeIdLike).toString();
}

export type IsSubtypeOfFunc<T extends UAType> = (this: T, baseType: T) => boolean;

export type UAType = UAReferenceType | UADataType | UAObjectType | UAVariableType;

export function construct_isSubtypeOf<T extends UAType>(
    Class: typeof BaseNodeImpl
): IsSubtypeOfFunc<T> {
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
