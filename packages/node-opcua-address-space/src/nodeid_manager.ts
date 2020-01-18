import { assert } from "node-opcua-assert";
import { NodeId, resolveNodeId, makeNodeId, sameNodeId, NodeIdLike, NodeIdType } from "node-opcua-nodeid";
import { QualifiedName, NodeClass } from "node-opcua-data-model";

import { Reference } from "./reference";
import {
    BaseNode as BaseNodePublic,
    UAReferenceType as UAReferenceTypePublic
} from "../source";
import { AddressSpace } from "./address_space";
import { LineFile } from "node-opcua-utils";

export const NamespaceOptions = {
    nodeIdNameSeparator: "-"
};

const regExp1 = /^(s|i|b|g)=/;
const regExp2 = /^ns=[0-9]+;(s|i|b|g)=/;
const hasPropertyRefId = resolveNodeId("HasProperty");
const hasComponentRefId = resolveNodeId("HasComponent");

function __combineNodeId(parentNodeId: NodeId, name: string) {
    let nodeId = null;
    if (parentNodeId.identifierType === NodeId.NodeIdType.STRING) {
        const childName = parentNodeId.value + NamespaceOptions.nodeIdNameSeparator + name.toString();
        nodeId = new NodeId(NodeId.NodeIdType.STRING, childName, parentNodeId.namespace);
    }
    return nodeId;
}


function _identifyParentInReference(references: Reference[]) {

    const candidates = references.filter((ref: Reference) => {
        return ref.isForward === false &&
            (sameNodeId(ref.referenceType, hasComponentRefId) || sameNodeId(ref.referenceType, hasPropertyRefId));
    });
    assert(candidates.length <= 1);
    return candidates[0];
}

interface AddressSpacePartial {

    findNode(nodeId: NodeIdLike): BaseNodePublic | null;
    findReferenceType(refType: NodeIdLike, namespaceIndex?: number): UAReferenceTypePublic | null;

}

export class NodeIdManager {

    private _cache: { [key: string]: number } = {};
    private _reverseCache: { [key: number]: { name: string, nodeClass: NodeClass } } = {};

    private _internal_id_counter: number;
    private namespaceIndex: number;

    constructor(namespaceIndex: number) {
        this._internal_id_counter = 1000;
        this.namespaceIndex = namespaceIndex;

    }
    public setCache(cache: [string, number, NodeClass][]) {
        this._cache = {};
        this._reverseCache = {};
        for (const [key, value, nodeClass] of cache) {
            this._addInCache(key, value, nodeClass);
        }
    }

    public getSymbols(): [string, number, string][] {
        const line: [string, number, string][] = [];
        for (const [key, value] of Object.entries(this._cache)) {
            const nodeClass = NodeClass[this._reverseCache[value].nodeClass];
            line.push([key, value, nodeClass]);
        }
        return line;
    }

    public getSymbolCSV(): string {

        const line: string[] = [];
        for (const [name, value, nodeClass] of this.getSymbols()) {
            line.push([name, value, nodeClass].join(","))
        }
        return line.join("\n");
    }

    public buildNewNodeId(addressSpace: AddressSpacePartial): NodeId {
        let nodeId: NodeId;
        do {
            nodeId = makeNodeId(this._internal_id_counter, this.namespaceIndex);
            this._internal_id_counter += 1;
        } while (addressSpace.findNode(nodeId) || this._isInCache(nodeId.value as number));
        return nodeId;
    }

    public constructNodeId(addressSpace: AddressSpacePartial, options: any): NodeId {

        let nodeId = options.nodeId;
        const nodeClass = options.nodeClass;

        if (!nodeId) {

            const parentNodeId = this.findParentNodeId(addressSpace, options);

            if (parentNodeId) {
                assert(options.browseName instanceof QualifiedName);
                const name = options.browseName.toString();

                nodeId = null;
                if (parentNodeId.identifierType === NodeId.NodeIdType.STRING) {
                    const childName = parentNodeId.value + NamespaceOptions.nodeIdNameSeparator + name;
                    nodeId = new NodeId(NodeId.NodeIdType.STRING, childName, parentNodeId.namespace);

                } else if (parentNodeId.identifierType === NodeId.NodeIdType.NUMERIC) {
                    //
                    const baseName = this._reverseCache[parentNodeId.value as number];
                    if (baseName) {
                        const newName = baseName.name + "_" + name;
                        const nodeIdValue = this._cache[newName];
                        if (nodeIdValue) {
                            return new NodeId(NodeIdType.NUMERIC, nodeIdValue, this.namespaceIndex);
                        } else {
                            return this._getOrCreateFromName(newName, nodeClass, addressSpace);
                        }
                    }
                }
            } else {
                const isRootType =
                    options.nodeClass === NodeClass.DataType ||
                    options.nodeClass === NodeClass.ObjectType ||
                    options.nodeClass === NodeClass.ReferenceType ||
                    options.nodeClass === NodeClass.VariableType;
                if (isRootType) {
                    // try to find 
                    const baseName = options.browseName.toString();
                    return this._getOrCreateFromName(baseName, nodeClass, addressSpace);
                }

            }
        } else if (typeof nodeId === "string") {

            if (this.namespaceIndex !== 0) {

                if (nodeId.match(regExp2)) {
                    // nothing
                } else if (nodeId.match(regExp1)) {
                    nodeId = "ns=" + this.namespaceIndex + ";" + nodeId;
                } else {
                    nodeId = this._getOrCreateFromName(nodeId, nodeClass, addressSpace);
                }
            }
        }
        nodeId = nodeId || this.buildNewNodeId(addressSpace);
        if (nodeId instanceof NodeId) {
            assert(nodeId.namespace === this.namespaceIndex);
            return nodeId;
        }
        nodeId = resolveNodeId(nodeId);
        assert(nodeId.namespace === this.namespaceIndex);
        return nodeId;
    }

    public findParentNodeId(addressSpace: AddressSpacePartial, options: any): NodeId | null {

        if (!options.references) {
            return null;
        }
        for (const ref of options.references) {
            ref._referenceType = addressSpace.findReferenceType(ref.referenceType);
            /* istanbul ignore next */
            if (!ref._referenceType) {
                throw new Error("Cannot find referenceType " + JSON.stringify(ref));
            }
            ref.referenceType = ref._referenceType.nodeId;
        }
        // find HasComponent, or has Property reverse
        const parentRef = _identifyParentInReference(options.references);
        return parentRef ? parentRef.nodeId : null;
    }

    private _addInCache(name: string, nodeIdValue: number, nodeClass: NodeClass) {

        assert(typeof name === "string" && name[0] !== "[");
        this._cache[name] = nodeIdValue;
        this._reverseCache[nodeIdValue] = { name, nodeClass };
    }

    private _isInCache(nodeIdValue: number) {
        return this._reverseCache[nodeIdValue] ? true : false;
    }

    private _getOrCreateFromName(
        aliasName: string,
        nodeClass: NodeClass,
        addressSpace: AddressSpacePartial
    ): NodeId {

        if (this._cache[aliasName]) {
            return new NodeId(NodeIdType.NUMERIC, this._cache[aliasName], this.namespaceIndex);
        } else {
            const nodeIdResult = this.buildNewNodeId(addressSpace);
            this._addInCache(aliasName, nodeIdResult.value as number, nodeClass);
            return nodeIdResult;
        }

    }
}
