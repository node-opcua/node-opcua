/* eslint-disable max-depth */
/* eslint-disable max-statements */
import { assert } from "node-opcua-assert";
import { NodeClass, QualifiedName, QualifiedNameLike, QualifiedNameOptions } from "node-opcua-data-model";
import { makeNodeId, NodeId, NodeIdLike, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { AddReferenceOpts, BaseNode, UAReference, UAReferenceType } from "node-opcua-address-space-base";
import { getReferenceType } from "./base_node_impl";
import { resolveReferenceNode, resolveReferenceType } from "./reference_impl";

const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);

export const NamespaceOptions = {
    nodeIdNameSeparator: "-"
};
function isValidNodeClass(nodeClass: NodeClass) {
    return typeof (NodeClass as any)[nodeClass] === "string";
}

const regExp1 = /^(s|i|b|g)=/;
const regExp2 = /^ns=[0-9]+;(s|i|b|g)=/;
const hasEncoding = resolveNodeId("HasEncoding");

type Suffix = string;

function _filterAggregates(addressSpace: AddressSpacePartial, references: UAReference[]): [NodeId, Suffix] | null {

    const aggregatesRefType = addressSpace.findNode(resolveNodeId("Aggregates")) as UAReferenceType;
    const hasEncodinRefType = addressSpace.findNode(resolveNodeId("HasEncoding")) as UAReferenceType;

    const checkAggregate = (
        reference: UAReference,
    ): boolean => {
        if (reference.isForward) return false;
        const r = resolveReferenceType(addressSpace, reference);
        if (!r) {
            return false;
        }
        return r.isSubtypeOf(aggregatesRefType) || r.isSubtypeOf(hasEncodinRefType)
    }

    const candidates = references.filter(checkAggregate);

    assert(candidates.length <= 1, "a node shall not have more than one parent (link to a parent with a reference derived from 'Aggregates')");
    if (candidates.length === 0) {
        return null;
    }
    const ref = candidates[0];
    if (sameNodeId(ref.referenceType, hasEncoding)) {
        return [ref.nodeId, "_Encoding"];
    }
    return [ref.nodeId, ""];
}

function _findParentNodeId(addressSpace: AddressSpacePartial, options: ConstructNodeIdOptions): [NodeId, Suffix] | null {
    if (!options.references) {
        return null;
    }
    for (const ref of options.references) {
        (ref as any)._referenceType = addressSpace.findReferenceType(ref.referenceType);
        /* istanbul ignore next */
        if (!getReferenceType(ref)) {
            throw new Error("Cannot find referenceType " + JSON.stringify(ref));
        }
        (ref as any).referenceType = (ref as any)._referenceType.nodeId;
    }
    // find HasComponent, or has Property reverse
    return _filterAggregates(addressSpace, options.references);
}

function prepareName(browseName?: QualifiedName | QualifiedNameOptions): string {
    const m = browseName!.name!.toString().replace(/[ ]/g, "").replace(/(<|>)/g, "");
    return m;
}

export interface AddressSpacePartial {
    findNode(nodeId: NodeIdLike): BaseNode | null;
    findReferenceType(refType: NodeIdLike, namespaceIndex?: number): UAReferenceType | null;
}
export interface ConstructNodeIdOptions {
    nodeId?: string | NodeIdLike | BaseNode | null;
    browseName: QualifiedNameOptions;
    nodeClass?: NodeClass;
    references?: UAReference[];
    registerSymbolicNames?: boolean;
}
export type NodeEntry = [string, number, NodeClass];
export type NodeEntry1 = [string, number, string /*"Object" | "Variable" etc...*/];

export class NodeIdManager {
    private _cacheSymbolicName: { [key: string]: [number, NodeClass] } = {};
    private _cacheSymbolicNameRev: Set<number> = new Set<number>();

    private _internal_id_counter: number;
    private namespaceIndex: number;
    private addressSpace: AddressSpacePartial;

    constructor(namespaceIndex: number, addressSpace: AddressSpacePartial) {
        this._internal_id_counter = 1000;
        this.namespaceIndex = namespaceIndex;
        this.addressSpace = addressSpace;
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
        for (const [name, value, nodeClass] of symbols2) {
            this._cacheSymbolicName[name] = [value, nodeClass];
            this._cacheSymbolicNameRev.add(value);
        }
    }

    public getSymbols(): NodeEntry1[] {
        const line: NodeEntry1[] = [];
        for (const [key, [value, nodeClass1]] of Object.entries(this._cacheSymbolicName)) {
            const node = this.addressSpace.findNode(makeNodeId(value, this.namespaceIndex));
            const nodeClass = NodeClass[nodeClass1 || NodeClass.Unspecified];
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
        } while (this.addressSpace.findNode(nodeId) || this._isInCache(nodeId));
        return nodeId;
    }

    public constructNodeId(options: ConstructNodeIdOptions): NodeId {

        const compose = (left: string, right: string) => { return right ? (left ? left + '_' + right : right) : left };

        
        const buildUpName2 = (nodeId: NodeId, suffix: string) => {
            const namespaceIndex = nodeId.namespace;
            let name = "";
            let n: BaseNode | null = this.addressSpace.findNode(nodeId);
            while (n && n.nodeId.namespace === namespaceIndex) {
                const e = prepareName(n.browseName) + suffix;
                name = compose(e, name);
                n = n.parentNodeId ? this.addressSpace.findNode(n.parentNodeId) : null;
            }
            return name;
        }

        if (!options.nodeId && options.registerSymbolicNames) {
            const parentInfo = this.findParentNodeId(options);
            let fullParentName = "";
            if (parentInfo) {
                const [parentNodeId, suffix] = parentInfo;
                fullParentName = buildUpName2(parentNodeId, suffix);
            }
            const fullName = compose(fullParentName, prepareName(options.browseName!));
            if (this._cacheSymbolicName[fullName]) {
                return makeNodeId(this._cacheSymbolicName[fullName][0], this.namespaceIndex);
            }
            const nodeId = this._constructNodeId(options);
            if (nodeId.identifierType === NodeIdType.NUMERIC) {
                this._cacheSymbolicName[fullName] = [nodeId.value as number, options.nodeClass!];
                this._cacheSymbolicNameRev.add(nodeId.value as number);
            }
            return nodeId;
        }
        return this._constructNodeId(options);
    }

    private _constructNodeId(options: ConstructNodeIdOptions): NodeId {

        const resolveNodeIdEx = (nodeId: BaseNode | NodeIdLike) =>
            (nodeId && typeof nodeId == "object" && nodeId instanceof BaseNode) ? nodeId.nodeId : resolveNodeId(nodeId);

        let nodeId = options.nodeId;

        if (!nodeId) {
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
                }
            }
        } else if (typeof nodeId === "string") {
            if (this.namespaceIndex !== 0) {
                if (nodeId.match(regExp2)) {
                    // nothing
                } else if (nodeId.match(regExp1)) {
                    nodeId = "ns=" + this.namespaceIndex + ";" + nodeId;
                    // } else {
                    //     nodeId = this._getOrCreateFromName(nodeId, nodeClass);
                }
            }
        }
        nodeId = nodeId || this.buildNewNodeId();
        if (nodeId instanceof NodeId) {
            assert(nodeId.namespace === this.namespaceIndex);
            return nodeId;
        }
        nodeId = resolveNodeIdEx(nodeId);
        assert(nodeId.namespace === this.namespaceIndex);
        return nodeId;
    }

    public findParentNodeId(options: ConstructNodeIdOptions): [NodeId, Suffix] | null {
        return _findParentNodeId(this.addressSpace, options);
    }

    private _isInCache(nodeId: NodeId): boolean {
        if (nodeId.namespace !== this.namespaceIndex || nodeId.identifierType !== NodeIdType.NUMERIC) return false;
        return this._cacheSymbolicNameRev.has(nodeId.value as number) ? true : false;
    }
}
