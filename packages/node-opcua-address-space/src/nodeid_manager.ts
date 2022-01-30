import { assert } from "node-opcua-assert";
import { NodeClass, QualifiedName } from "node-opcua-data-model";
import { makeNodeId, NodeId, NodeIdLike, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { make_debugLog } from "node-opcua-debug";

import { BaseNode, UAReference, UAReferenceType } from "node-opcua-address-space-base";
import { getReferenceType } from "./base_node_impl";

const debugLog = make_debugLog(__filename);

export const NamespaceOptions = {
    nodeIdNameSeparator: "-"
};
function isValidNodeClass(nodeClass: NodeClass) {
    return typeof (NodeClass as any)[nodeClass] === "string";
}

const regExp1 = /^(s|i|b|g)=/;
const regExp2 = /^ns=[0-9]+;(s|i|b|g)=/;
const hasPropertyRefId = resolveNodeId("HasProperty");
const hasComponentRefId = resolveNodeId("HasComponent");
const hasEncoding = resolveNodeId("HasEncoding");

function _identifyParentInReference(references: UAReference[]): [NodeId, string] | null {
    const candidates = references.filter((r: UAReference) => {
        return (
            !r.isForward &&
            (sameNodeId(r.referenceType, hasComponentRefId) ||
                sameNodeId(r.referenceType, hasPropertyRefId) ||
                sameNodeId(r.referenceType, hasEncoding))
        );
    });
    assert(candidates.length <= 1);
    if (candidates.length === 0) {
        return null;
    }
    const ref = candidates[0];
    if (sameNodeId(ref.referenceType, hasEncoding)) {
        return [ref.nodeId, "_Encoding"];
    }
    return [ref.nodeId, ""];
}

export interface AddressSpacePartial {
    findNode(nodeId: NodeIdLike): BaseNode | null;
    findReferenceType(refType: NodeIdLike, namespaceIndex?: number): UAReferenceType | null;
}
export interface ConstructNodeIdOptions {
    nodeId?: string | NodeIdLike | null;
    browseName: QualifiedName;
    nodeClass: NodeClass;
    references?: UAReference[];
}
export type NodeEntry = [string, number, NodeClass];
export type NodeEntry1 = [string, number, string /*"Object" | "Variable" etc...*/];

export class NodeIdManager {
    private _cache: { [key: string]: number } = {};
    private _reverseCache: { [key: number]: { name: string; nodeClass: NodeClass } } = {};

    private _internal_id_counter: number;
    private namespaceIndex: number;
    private addressSpace: AddressSpacePartial;

    constructor(namespaceIndex: number, addressSpace: AddressSpacePartial) {
        this._internal_id_counter = 1000;
        this.namespaceIndex = namespaceIndex;
        this.addressSpace = addressSpace;
    }

    public setCache(cache: NodeEntry[]): void {
        this._cache = {};
        this._reverseCache = {};
        for (const [key, value, nodeClass] of cache) {
            this._addInCache(key, value, nodeClass);
        }
    }

    public setSymbols(symbols: NodeEntry1[]): void {
        function convertNodeClass(nodeClass: string): NodeClass {
            return (NodeClass as any)[nodeClass as any] as NodeClass;
        }
        const symbols2 = symbols.map((e: [string, number, string]) => [e[0] as string, e[1] as number, convertNodeClass(e[2])]) as [
            string,
            number,
            NodeClass
        ][];
        this.setCache(symbols2);
    }

    public getSymbols(): NodeEntry1[] {
        const line: NodeEntry1[] = [];
        for (const [key, value] of Object.entries(this._cache)) {
            const nodeClass = NodeClass[this._reverseCache[value].nodeClass];
            line.push([key, value, nodeClass]);
        }
        return line;
    }

    public getSymbolCSV(): string {
        const line: string[] = [];
        for (const [name, value, nodeClass] of this.getSymbols()) {
            line.push([name, value, nodeClass].join(";"));
        }
        return line.join("\n");
    }

    public buildNewNodeId(): NodeId {
        let nodeId: NodeId;
        do {
            nodeId = makeNodeId(this._internal_id_counter, this.namespaceIndex);
            this._internal_id_counter += 1;
        } while (this.addressSpace.findNode(nodeId) || this._isInCache(nodeId.value as number));
        return nodeId;
    }

    public constructNodeId(options: ConstructNodeIdOptions): NodeId {
        function prepareName(browseName: QualifiedName): string {
            assert(browseName instanceof QualifiedName);
            const m = browseName.name!.toString().replace(/[ ]/g, "").replace(/(<|>)/g, "");
            return m;
        }
        let nodeId = options.nodeId;
        const nodeClass = options.nodeClass;

        if (!nodeId) {
            //    console.log("xx constructNodeId", options.browseName.toString());

            const parentInfo = this.findParentNodeId(options);

            if (parentInfo) {
                const [parentNodeId, linkName] = parentInfo;
                const name = prepareName(options.browseName);
                nodeId = null;
                if (parentNodeId.identifierType === NodeId.NodeIdType.STRING) {
                    // combining string nodeId => not stored in chache
                    const childName = parentNodeId.value + NamespaceOptions.nodeIdNameSeparator + name;
                    nodeId = new NodeId(NodeId.NodeIdType.STRING, childName, parentNodeId.namespace);
                    return nodeId;
                } else if (parentNodeId.identifierType === NodeId.NodeIdType.NUMERIC) {
                    //
                    const baseNameInCache = this._reverseCache[parentNodeId.value as number];
                    if (baseNameInCache) {
                        const newName = baseNameInCache.name + linkName + "_" + name;
                        const nodeIdValueInCache = this._cache[newName];
                        if (nodeIdValueInCache) {
                            return new NodeId(NodeIdType.NUMERIC, nodeIdValueInCache, this.namespaceIndex);
                        } else {
                            return this._getOrCreateFromName(newName, nodeClass);
                        }
                    }
                }
                // }} has parent ...
            } else {
                const isRootType =
                    options.nodeClass === NodeClass.DataType ||
                    options.nodeClass === NodeClass.ObjectType ||
                    options.nodeClass === NodeClass.ReferenceType ||
                    options.nodeClass === NodeClass.VariableType;
                // try to find
                if (isRootType) {
                    const baseName = options.browseName.name!.toString();
                    return this._getOrCreateFromName(baseName, nodeClass);
                }
            }
        } else if (typeof nodeId === "string") {
            if (this.namespaceIndex !== 0) {
                if (nodeId.match(regExp2)) {
                    // nothing
                } else if (nodeId.match(regExp1)) {
                    nodeId = "ns=" + this.namespaceIndex + ";" + nodeId;
                } else {
                    nodeId = this._getOrCreateFromName(nodeId, nodeClass);
                }
            }
        }
        nodeId = nodeId || this.buildNewNodeId();
        if (nodeId instanceof NodeId) {
            assert(nodeId.namespace === this.namespaceIndex);
            return nodeId;
        }
        nodeId = resolveNodeId(nodeId);
        assert(nodeId.namespace === this.namespaceIndex);
        return nodeId;
    }

    public findParentNodeId(options: ConstructNodeIdOptions): [NodeId, string] | null {
        if (!options.references) {
            return null;
        }
        for (const ref of options.references) {
            (ref as any)._referenceType = this.addressSpace.findReferenceType(ref.referenceType);
            /* istanbul ignore next */
            if (!getReferenceType(ref)) {
                throw new Error("Cannot find referenceType " + JSON.stringify(ref));
            }
            (ref as any).referenceType = (ref as any)._referenceType.nodeId;
        }
        // find HasComponent, or has Property reverse
        return _identifyParentInReference(options.references);
    }

    private _addInCache(name: string, nodeIdValue: number, nodeClass: NodeClass) {
        assert(!name.includes(":"), "Alias name should not contain special characters");
        assert(typeof name === "string" && name[0] !== "[");
        if (this._isInCache(nodeIdValue) || this._cache[name]) {
            throw new Error("Already in Cache !" + name + " " + nodeIdValue + " = " + this._cache[name]);
        }
        this._cache[name] = nodeIdValue;
        this._reverseCache[nodeIdValue] = { name, nodeClass };
    }

    private _isInCache(nodeIdValue: number) {
        return this._reverseCache[nodeIdValue] ? true : false;
    }

    private _getOrCreateFromName(aliasName: string, nodeClass: NodeClass): NodeId {
        assert(isValidNodeClass(nodeClass), "invalid node class " + nodeClass);
        if (aliasName.includes(":")) {
            debugLog("alias name should not contain special characters");
        }
        assert(!aliasName.includes(":"), "Alias name should not contain special characters");
        if (this._cache[aliasName]) {
            return new NodeId(NodeIdType.NUMERIC, this._cache[aliasName], this.namespaceIndex);
        } else {
            const nodeIdResult = this.buildNewNodeId();
            this._addInCache(aliasName, nodeIdResult.value as number, nodeClass);
            return nodeIdResult;
        }
    }
}