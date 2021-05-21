/**
 * @module node-opcua-address-space
 */

import { assert } from "node-opcua-assert";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { sameNodeId } from "node-opcua-nodeid";
import { BaseNode as BaseNodePublic, UADataType, UAObjectType, UAReference, UAReferenceType, UAVariableType } from "../source";
import { BaseNode } from "./base_node";
import { BaseNode_getCache } from "./base_node_private";
import { Reference } from "./reference";

const HasSubTypeNodeId = resolveNodeId("HasSubtype");

function _filterSubType(reference: UAReference) {
    return sameNodeId(reference.referenceType, HasSubTypeNodeId) && !reference.isForward;
}

export type BaseNodeConstructor<T extends BaseNode> = new () => T;

function _slow_isSupertypeOf<T extends UAType>(this: T, Class: typeof BaseNode, baseType: T): boolean {
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
        const subTypeNode = (this.addressSpace.findNode(subTypeId) as any) as T;
        // istanbul ignore next
        if (!subTypeNode) {
            throw new Error("Cannot find object with nodeId " + subTypeId.toString());
        }
        if (sameNodeId(subTypeNode.nodeId, baseType.nodeId)) {
            return true;
        } else {
            if (_slow_isSupertypeOf.call(subTypeNode, Class, baseType)) {
                return true;
            }
        }
    }
    return false;
}

export type MemberFuncValue<T, P, R> = (this: T, param: P) => R;

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
        if (!this.__cache) {
            this.__cache = {};
        }

        const hash = hashFunc!.call(this, param);

        let cache_value = this.__cache[hash];

        if (cache_value === undefined) {
            cache_value = func.call(this, param);
            this.__cache[hash] = cache_value;
        }
        return cache_value;
    };
}

function hashBaseNode(e: BaseNode): string {
    return e.nodeId.value.toString();
}

export type IsSupertypeOfFunc<T extends UAType> = (this: T, baseType: T) => boolean;

export type UAType = UAReferenceType | UADataType | UAObjectType | UAVariableType;

export function construct_isSupertypeOf<T extends UAType>(Class: typeof BaseNode): IsSupertypeOfFunc<T> {
    assert(typeof Class === "function");
    return wrap_memoize(function (this: T, baseType: T): boolean {
        assert(baseType instanceof Class);
        assert(this instanceof Class);
        return _slow_isSupertypeOf.call(this, Class, baseType);
    }, hashBaseNode);
}

export function construct_slow_isSupertypeOf<T extends UAType>(Class: typeof BaseNode) {
    return function (this: T, baseType: T) {
        return _slow_isSupertypeOf.call(this, Class, baseType);
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

    if (!_cache._subtypeOfObj) {
        const is_subtype_of_ref = this.findReference("HasSubtype", false);
        if (is_subtype_of_ref) {
            _cache._subtypeOfObj = Reference.resolveReferenceNode(this.addressSpace, is_subtype_of_ref);
        } else {
            _cache._subtypeOfObj = null;
        }
    }
    return _cache._subtypeOfObj;
}
