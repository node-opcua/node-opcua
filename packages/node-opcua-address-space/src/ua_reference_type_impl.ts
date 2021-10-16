/**
 * @module node-opcua-address-space
 */

import { UAReference, UAReferenceType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { coerceLocalizedText, LocalizedTextOptions } from "node-opcua-data-model";
import { LocalizedText, NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import { SessionContext, UAReferenceType as UAReferenceTypePublic } from "../source";
import { BaseNodeImpl, InternalBaseNodeOptions } from "./base_node_impl";
import * as tools from "./tool_isSupertypeOf";
import { get_subtypeOf, get_subtypeOfObj } from "./tool_isSupertypeOf";
import { ReferenceImpl } from "./reference_impl";
import { BaseNode_getCache } from "./base_node_private";

const ReferenceTypeCounter = { count: 0 };

function _internal_getAllSubtypes(referenceType: UAReferenceType): UAReferenceTypePublic[] {
    const addressSpace = referenceType.addressSpace;
    const possibleReferenceTypes: UAReferenceType[] = [];

    const hasSubtypeReferenceType = addressSpace.findReferenceType("HasSubtype")!;

    function _findAllSubType(referenceTypeInner: UAReferenceType) {
        possibleReferenceTypes.push(referenceTypeInner);
        assert(referenceTypeInner.nodeClass === NodeClass.ReferenceType);
        const references = referenceTypeInner.findReferences(hasSubtypeReferenceType, true);
        for (const _r of references) {
            const subType: UAReferenceTypePublic = addressSpace.findReferenceType(_r.nodeId)!;
            _findAllSubType(subType);
        }
    }
    _findAllSubType(referenceType);
    return possibleReferenceTypes;
}

function _getAllSubtypes(ref: UAReferenceType) {
    const _cache = BaseNode_getCache(ref);

    if (!_cache._allSubTypesVersion || _cache._allSubTypesVersion < ReferenceTypeCounter.count) {
        _cache._allSubTypes = null;
    }
    if (!_cache._allSubTypes) {
        _cache._allSubTypes = _internal_getAllSubtypes(ref);
        _cache._allSubTypesVersion = ReferenceTypeCounter.count;
    }
    return _cache._allSubTypes;
}

function _internal_getSubtypeIndex(referenceType: UAReferenceType): { [key: string]: UAReferenceTypePublic } {
    const possibleReferenceTypes = _getAllSubtypes(referenceType);
    // create a index of reference type with browseName as key for faster search
    const keys: any = {};
    for (const refType of possibleReferenceTypes) {
        keys[refType.nodeId.toString()] = refType;
    }
    return keys;
}

function _getSubtypeIndex(referenceType: UAReferenceType): { [key: string]: UAReferenceTypePublic } {
    const _cache = BaseNode_getCache(referenceType);
    if (!_cache._subtype_idx || _cache._subtype_idxVersion < ReferenceTypeCounter.count) {
        // the cache need to be invalidated
        _cache._subtype_idx = null;
    }
    if (!_cache._subtype_idx) {
        _cache._subtype_idx = _internal_getSubtypeIndex(referenceType);
        _cache._subtype_idxVersion = ReferenceTypeCounter.count;
    }
    return _cache._subtype_idx;
}

export interface UAReferenceTypeOptions extends InternalBaseNodeOptions {
    isAbstract?: boolean;
    symmetric?: boolean;
    inverseName: null | string | LocalizedTextOptions;
}
export class UAReferenceTypeImpl extends BaseNodeImpl implements UAReferenceType {
    public readonly nodeClass = NodeClass.ReferenceType;
    public readonly isAbstract: boolean;
    public readonly symmetric: boolean;
    public readonly inverseName: LocalizedText;

    public get subtypeOfObj(): UAReferenceTypePublic | null {
        return get_subtypeOfObj.call(this) as UAReferenceType;
    }

    public get subtypeOf(): NodeId | null {
        return get_subtypeOf.call(this);
    }

    /**
     * returns true if self is  a super type of baseType
     */
    public isSupertypeOf = tools.construct_isSupertypeOf<UAReferenceType>(UAReferenceTypeImpl);

    /**
     * @private
     */
    public _slow_isSupertypeOf = tools.construct_slow_isSupertypeOf<UAReferenceType>(UAReferenceTypeImpl);

    constructor(options: UAReferenceTypeOptions) {
        super(options);
        this.isAbstract = options.isAbstract === undefined ? false : !!options.isAbstract;
        this.symmetric = options.symmetric === undefined ? false : !!options.symmetric;
        // Note: Inverse name is not required anymore in 1.0.4
        this.inverseName = coerceLocalizedText(options.inverseName || this.browseName.name)!;

        ReferenceTypeCounter.count += 1;
    }

    public readAttribute(context: SessionContext | null, attributeId: AttributeIds): DataValue {
        assert(!context || context instanceof SessionContext);

        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.IsAbstract:
                options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
                options.statusCode = StatusCodes.Good;
                break;
            case AttributeIds.Symmetric:
                options.value = { dataType: DataType.Boolean, value: !!this.symmetric };
                options.statusCode = StatusCodes.Good;
                break;
            case AttributeIds.InverseName: // LocalizedText
                options.value = { dataType: DataType.LocalizedText, value: this.inverseName };
                options.statusCode = StatusCodes.Good;
                break;
            default:
                return super.readAttribute(context, attributeId);
        }
        return new DataValue(options);
    }

    public toString(): string {
        let str = "";
        str += this.isAbstract ? "A" : " ";
        str += this.symmetric ? "S" : " ";
        str += " " + this.browseName.toString() + "/" + this.inverseName.text + " ";
        str += this.nodeId.toString();
        return str;
    }

    public install_extra_properties(): void {
        /**  */
    }

    /**
     * returns a array of all ReferenceTypes in the addressSpace that are self or a subType of self
     * recursively
     */
    public getAllSubtypes(): UAReferenceType[] {
        return _getAllSubtypes(this);
    }

    public checkHasSubtype(ref: UAReference | NodeId): boolean {
        const _index = _getSubtypeIndex(this);
        const referenceTypeNodeId = ref instanceof ReferenceImpl ? ref.nodeId : (ref as NodeId);
        const _key = referenceTypeNodeId.toString();
        return !!_index[_key];
    }
}
