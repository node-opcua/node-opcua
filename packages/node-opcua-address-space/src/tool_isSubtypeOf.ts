/**
 * @module node-opcua-address-space
 */

import { assert } from "node-opcua-assert";
import { NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { sameNodeId } from "node-opcua-nodeid";
import { NodeClass } from "node-opcua-data-model";
import { BaseNode, UADataType, UAObjectType, UAReference, UAReferenceType, UAVariableType } from "node-opcua-address-space-base";

import { BaseNode_getCache } from "./base_node_private";
import { ReferenceImpl } from "./reference_impl";
import { BaseNodeImpl } from "./base_node_impl";

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
        const subTypeNode = this.addressSpace.findNode(subTypeId) as any as T;
        // istanbul ignore next
        if (!subTypeNode) {
            throw new Error("Cannot find object with nodeId " + subTypeId.toString());
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


const g_WeakMap = new WeakMap<Object, Map<string, unknown>>();

export function wipeMemorizedStuff(node: Object) {
    if (g_WeakMap.has(node)) {
        g_WeakMap.delete(node);
    }
}

//  http://jsperf.com/underscore-js-memoize-refactor-test
//  http://addyosmani.com/blog/faster-javascript-memoization/
function wrap_memoize<T, P, R>(
    func: MemberFuncValue<T, P, R>,
    hashFunc?: (this: T, param: any) => string
): MemberFuncValue<T, P, R> {
    if (undefined === hashFunc) {
        hashFunc = (_p: T) => (_p as any).toString();
    }
    return function memoize(this: any, param: any) {
        const self = this;
        if (!g_WeakMap.has(self)) {
            g_WeakMap.set(self,new Map());
        }
        const memoMap = g_WeakMap.get(self)!;

        const hash = hashFunc!.call(this, param);
        if (memoMap.has(hash)) {
            return memoMap.get(hash) as R;
        }
        const cache_value = func.call(this, param);
        memoMap.set(hash,cache_value);
        return cache_value as R;
    };
}

function hashBaseNode(e: BaseNode): string {
    return e.nodeId.toString();
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
            throw new Error("expecting this to be " + Class.name + " but got " + baseType.toString());
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

export function get_subtypeOfObj(this: BaseNode): BaseNode | null {
    const _cache = BaseNode_getCache(this);

    if (_cache._subtypeOfObj == undefined) {
        const is_subtype_of_ref = this.findReference("HasSubtype", false);
        if (is_subtype_of_ref ) {
            _cache._subtypeOfObj = ReferenceImpl.resolveReferenceNode(this.addressSpace, is_subtype_of_ref);
        } else {
            _cache._subtypeOfObj = null;
        }
    }
    return _cache._subtypeOfObj;
}
