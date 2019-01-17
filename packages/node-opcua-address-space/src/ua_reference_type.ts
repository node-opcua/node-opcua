/**
 * @module opcua.address_space
 */

import * as util from "util";

import { assert } from "node-opcua-assert";
import { coerceLocalizedText } from "node-opcua-data-model";
import { LocalizedText, NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { SessionContext, UAReferenceType  as UAReferenceTypePublic} from "../source";
import { BaseNode } from "./base_node";
import { getSubtypeIndex, ReferenceTypeCounter } from "./base_node_private";
import * as tools from "./tool_isSupertypeOf";
import { get_subtypeOf, get_subtypeOfObj } from "./tool_isSupertypeOf";

export class UAReferenceType extends BaseNode implements UAReferenceTypePublic {

    public readonly nodeClass = NodeClass.ReferenceType;
    public get subtypeOfObj(): UAReferenceTypePublic  | null {
        return get_subtypeOfObj.call(this) as UAReferenceType;
    }
    public get subtypeOf(): NodeId  | null {
        return get_subtypeOf.call(this);
    }
    public isAbstract: boolean;
    public symmetric: boolean;
    public inverseName: LocalizedText;

    /**
     * returns true if self is  a super type of baseType
     */
     public isSupertypeOf: (baseType: UAReferenceType) => boolean
      = tools.construct_isSupertypeOf<UAReferenceType>(UAReferenceType);

    public _slow_isSupertypeOf: (baseType: UAReferenceType) => boolean
      = tools.construct_slow_isSupertypeOf<UAReferenceType>(UAReferenceType);

    constructor(options: any) {
        super(options);
        this.isAbstract = util.isNullOrUndefined(options.isAbstract) ? false : !!options.isAbstract;
        this.symmetric = util.isNullOrUndefined(options.symmetric) ? false : !!options.symmetric;
        this.inverseName = coerceLocalizedText(options.inverseName)!;
        ReferenceTypeCounter.count += 1;
    }

    public readAttribute(context: SessionContext  | null, attributeId: AttributeIds): DataValue {

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
                return BaseNode.prototype.readAttribute.call(this, context, attributeId);
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
        //
    }

    /**
     * returns a array of all ReferenceTypes in the addressSpace that are self or a subType of self
     */
    public getAllSubtypes(): UAReferenceType[] {

        const _cache = BaseNode._getCache(this);

        if (!_cache._allSubTypesVersion || _cache._allSubTypesVersion < ReferenceTypeCounter) {

            _cache._allSubTypes = null;
        }
        if (!_cache._allSubTypes) {
            _cache._allSubTypes = findAllSubTypes(this);
            _cache._allSubTypesVersion = ReferenceTypeCounter.count;
        }
        return _cache._allSubTypes;
    }

    private is(referenceTypeString: string): boolean {
        const referenceType: UAReferenceTypePublic = this.addressSpace.findReferenceType(referenceTypeString)!;
        return getSubtypeIndex.call(this).hasOwnProperty(referenceType.toString());
    }

}

function findAllSubTypes(referenceType: UAReferenceType): UAReferenceTypePublic[] {

    const addressSpace = referenceType.addressSpace;
    const possibleReferenceTypes: UAReferenceTypePublic[] = [];

    const hasSubtypeReferenceType = addressSpace.findReferenceType("HasSubtype")!;

    function _findAllSubType(referenceTypeInner: UAReferenceTypePublic) {
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
