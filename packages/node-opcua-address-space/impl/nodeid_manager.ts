import type { BaseNode, UAReference, UAReferenceType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { BrowseDirection, NodeClass, type QualifiedName, type QualifiedNameOptions } from "node-opcua-data-model";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { makeNodeId, NodeId, type NodeIdLike, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { setOwnProperty } from "node-opcua-utils";
import { BaseNodeImpl } from "./base_node_impl.js";
import { type ReferenceImpl, resolveReferenceType } from "./reference_impl.js";

const _debugLog = make_debugLog("nodeid_manager");
const _warningLog = make_warningLog("nodeid_manager");

export const NamespaceOptions = {
    nodeIdNameSeparator: "-"
};
function _isValidNodeClass(nodeClass: NodeClass) {
    return typeof NodeClass[nodeClass] === "string";
}

const regExp1 = /^(s|i|b|g)=/;
const regExp2 = /^ns=[0-9]+;(s|i|b|g)=/;
const hasEncoding = resolveNodeId("HasEncoding");

type Suffix = string;

function _filterAggregates(addressSpace: AddressSpacePartial, references: UAReference[]): [NodeId, Suffix] | null {
    const aggregatesRefType = addressSpace.findNode(resolveNodeId("Aggregates")) as UAReferenceType;
    const hasEncodinRefType = addressSpace.findNode(resolveNodeId("HasEncoding")) as UAReferenceType;

    const checkAggregate = (reference: UAReference): boolean => {
        if (reference.isForward) return false;
        const r = resolveReferenceType(addressSpace, reference);
        if (!r) {
            return false;
        }
        return r.isSubtypeOf(aggregatesRefType) || r.isSubtypeOf(hasEncodinRefType);
    };

    const candidates = references.filter(checkAggregate);

    assert(
        candidates.length <= 1,
        "a node shall not have more than one parent (link to a parent with a reference derived from 'Aggregates')"
    );
    if (candidates.length === 0) {
        return null;
    }
    const ref = candidates[0];
    if (sameNodeId(ref.referenceType, hasEncoding)) {
        return [ref.nodeId, "_Encoding"];
    }
    return [ref.nodeId, ""];
}

function _declaredParent(options: ConstructNodeIdOptions): NodeId | null {
    const declared = options.parentNodeId;
    if (!declared) return null;
    if (declared instanceof BaseNodeImpl) return declared.nodeId;
    const nodeId = resolveNodeId(declared as NodeIdLike);
    return nodeId.isEmpty() ? null : nodeId;
}

function _findParentNodeId(addressSpace: AddressSpacePartial, options: ConstructNodeIdOptions): [NodeId, Suffix] | null {
    const references = options.references ?? [];
    for (const ref of references) {
        const _ref = ref as ReferenceImpl;
        _ref._referenceType = addressSpace.findReferenceType(ref.referenceType) ?? undefined;
        /* c8 ignore next */
        if (!_ref._referenceType) {
            throw new Error(`Cannot find referenceType ${JSON.stringify(ref)}`);
        }
        _ref.referenceType = _ref._referenceType.nodeId;
    }
    // A declared parent names the node, whatever reference links the two, as it
    // is the node's parent: an Organizes-only member of a type is
    // `<Type>_MachineryBuildingBlocks` in the ModelCompiler's NodeIds.csv, and a
    // node with two aggregating parents is named after the declared one.
    const declared = _declaredParent(options);
    if (declared) {
        const viaEncoding = references.some(
            (ref) => !ref.isForward && sameNodeId(ref.nodeId, declared) && sameNodeId(ref.referenceType, hasEncoding)
        );
        return [declared, viaEncoding ? "_Encoding" : ""];
    }
    // find HasComponent, or has Property reverse
    return references.length ? _filterAggregates(addressSpace, references) : null;
}

/** whether the node being built hangs, through an inverse reference, from a node `occupant` hangs from */
function _shareAnOrganizer(occupant: BaseNode, options: ConstructNodeIdOptions): boolean {
    const references = (options.references ?? []).filter((r) => !r.isForward);
    if (references.length === 0) {
        return false;
    }
    const parents = occupant.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse).map((r) => r.nodeId);
    return references.some((r) => parents.some((p) => sameNodeId(p, r.nodeId)));
}

function prepareName(browseName?: QualifiedName | QualifiedNameOptions): string {
    const m = browseName?.name?.toString().replace(/[ ]/g, "").replace(/(<|>)/g, "");
    return m || "";
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
    /**
     * The declared parent (NodeSet `ParentNodeId`, or `parentNodeId` on the add* API).
     * When present it names the node, as it is the node's parent (see `BaseNode.parent`).
     */
    parentNodeId?: NodeIdLike | BaseNode | null;
}
export type NodeEntry = [string, number, NodeClass];
export type NodeEntry1 = [string, number, string /*"Object" | "Variable" etc...*/];

/** the separator of a disambiguated symbolic name (`X__2`): prepareName never produces it from a browse name */
export const SYMBOLIC_NAME_OCCURRENCE_SEPARATOR = "__";

export class NodeIdManager {
    private _cacheSymbolicName: { [key: string]: [number, NodeClass] } = {};
    private _cacheSymbolicNameRev: Set<number> = new Set<number>();
    /** the symbolic name each id was registered under, so that a node's members are named after it */
    private _nameOfId: Map<number, string> = new Map<number, string>();

    private _internal_id_counter: number;
    private namespaceIndex: number;
    private addressSpace: AddressSpacePartial;

    constructor(namespaceIndex: number, addressSpace: AddressSpacePartial) {
        this._internal_id_counter = 1000;
        this.namespaceIndex = namespaceIndex;
        this.addressSpace = addressSpace;
    }

    /**
     * Put the id counter back where a fresh manager starts, so that a namespace emptied and
     * populated again hands out the same generated ids as the first time.
     *
     * The symbolic name table is deliberately kept: it is the mapping the caller supplied (or
     * that the first population established) between a name and the id that name must keep, and
     * a recycled namespace has to honour it again. Nothing can clash with a retired id -
     * `buildNewNodeId` skips both the ids in that table and any nodeId still registered.
     */
    public reset(): void {
        this._internal_id_counter = 1000;
    }

    public setSymbols(symbols: NodeEntry1[]): void {
        function convertNodeClass(nodeClass: string): NodeClass {
            return (NodeClass as unknown as Record<string, NodeClass>)[nodeClass];
        }
        const symbols2 = symbols.map((e: [string, number, string]) => [e[0] as string, e[1] as number, convertNodeClass(e[2])]) as [
            string,
            number,
            NodeClass
        ][];
        for (const [name, value, nodeClass] of symbols2) {
            setOwnProperty(this._cacheSymbolicName, name, [value, nodeClass]);
            this._cacheSymbolicNameRev.add(value);
            if (!this._nameOfId.has(value)) {
                this._nameOfId.set(value, name);
            }
        }
    }

    private _registerName(name: string, value: number, nodeClass: NodeClass | undefined): void {
        setOwnProperty(this._cacheSymbolicName, name, [value, nodeClass || NodeClass.Unspecified]);
        this._cacheSymbolicNameRev.add(value);
        this._nameOfId.set(value, name);
    }

    /**
     * The first `name__n` (n >= 2) a node may take: one the table does not list, or, for a node
     * whose id is not fixed yet, one listed with an id that no node holds (a preset). A node whose
     * id is fixed (`nodeId`) takes the name listed with that id, or a new one.
     */
    private _nextFreeName(fullName: string, nodeId?: number): { name: string; value?: number } {
        for (let n = 2; ; n++) {
            const name = `${fullName}${SYMBOLIC_NAME_OCCURRENCE_SEPARATOR}${n}`;
            const cached = this._cacheSymbolicName[name];
            if (!cached) {
                return { name };
            }
            if (
                nodeId === undefined
                    ? !this.addressSpace.findNode(makeNodeId(cached[0], this.namespaceIndex))
                    : cached[0] === nodeId
            ) {
                return { name, value: cached[0] };
            }
        }
    }

    /**
     * Whether a node whose symbolic name another node holds takes the next free `name__n`: a
     * parentless node (its name is its browse name alone, which distinct nodes share), and a
     * child whose browse name differs from its sibling's by the namespace only (`1:Speed` next to
     * `0:Speed`), which the name does not spell. A child of a string NodeId is not named at all:
     * its id is built from its parent's.
     */
    private _mayTakeAnotherName(parentInfo: [NodeId, Suffix] | null): boolean {
        return parentInfo === null || parentInfo[0].identifierType === NodeIdType.NUMERIC;
    }

    public getSymbols(): NodeEntry1[] {
        const line: NodeEntry1[] = [];
        for (const [key, [value, nodeClass1]] of Object.entries(this._cacheSymbolicName)) {
            const _node = this.addressSpace.findNode(makeNodeId(value, this.namespaceIndex));
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
        const compose = (left: string, right: string) => {
            return right ? (left ? `${left}_${right}` : right) : left;
        };

        const buildUpName2 = (nodeId: NodeId, suffix: string) => {
            // a parent registered under a name of its own (`X__2`) passes that name on to its members
            if (nodeId.namespace === this.namespaceIndex && nodeId.identifierType === NodeIdType.NUMERIC) {
                const registered = this._nameOfId.get(nodeId.value as number);
                if (registered !== undefined) {
                    return registered + suffix;
                }
            }
            const namespaceIndex = nodeId.namespace;
            let name = "";
            let n: BaseNode | null = this.addressSpace.findNode(nodeId);
            while (n && n.nodeId.namespace === namespaceIndex) {
                const e = prepareName(n.browseName) + suffix;
                name = compose(e, name);
                n = n.parentNodeId ? this.addressSpace.findNode(n.parentNodeId) : null;
            }
            return name;
        };

        if (!options.nodeId && options.registerSymbolicNames) {
            const parentInfo = this.findParentNodeId(options);
            let fullParentName = "";
            if (parentInfo) {
                const [parentNodeId, suffix] = parentInfo;
                fullParentName = buildUpName2(parentNodeId, suffix);
            }
            const fullName = compose(fullParentName, prepareName(options.browseName));
            let name = fullName;
            const cached = this._cacheSymbolicName[fullName];
            if (cached) {
                if (this._isCacheHitReusable(cached[0], options, parentInfo)) {
                    return makeNodeId(cached[0], this.namespaceIndex);
                }
                if (!this._mayTakeAnotherName(parentInfo)) {
                    // a fresh id, with no name
                    return this._constructNodeId(options);
                }
                // another node holds the name: this one takes the next free `name__n`
                const free = this._nextFreeName(fullName);
                if (free.value !== undefined) {
                    this._nameOfId.set(free.value, free.name);
                    return makeNodeId(free.value, this.namespaceIndex);
                }
                name = free.name;
            }
            const nodeId = this._constructNodeId(options);
            if (nodeId.identifierType === NodeIdType.NUMERIC) {
                this._registerName(name, nodeId.value as number, options.nodeClass);
            }
            return nodeId;
        }
        const nodeId = this._constructNodeId(options);
        // When registerSymbolicNames is true and a nodeId was already
        // provided (e.g. loaded from XML during reverse engineering),
        // also record the BrowseName → NodeId mapping in the symbol
        // cache so that getSymbols() returns the original NodeIds.
        if (options.registerSymbolicNames && nodeId.identifierType === NodeIdType.NUMERIC) {
            const parentInfo = this.findParentNodeId(options);
            let fullParentName = "";
            if (parentInfo) {
                const [parentNodeId, suffix] = parentInfo;
                fullParentName = buildUpName2(parentNodeId, suffix);
            }
            const fullName = compose(fullParentName, prepareName(options.browseName));
            const value = nodeId.value as number;
            const cached = this._cacheSymbolicName[fullName];
            if (!cached) {
                this._registerName(fullName, value, options.nodeClass);
            } else if (cached[0] === value) {
                this._nameOfId.set(value, fullName);
            } else if (this._mayTakeAnotherName(parentInfo)) {
                // another node holds the name (OPC 40502 CNC's three parentless X axes): this
                // one is listed under the next free `name__n`, as it would be named when built
                const free = this._nextFreeName(fullName, value);
                this._registerName(free.name, value, options.nodeClass);
            }
        }
        return nodeId;
    }

    /**
     * A symbol-cache hit is only safe to reuse when it actually refers to
     * the node we are about to construct. Because the cache key is built
     * from a (possibly truncated, e.g. during a clone where parentNodeId
     * isn't linked yet) parent-name chain, two unrelated nodes can end up
     * sharing the same key. When that happens, reusing the cached nodeId
     * would hand a brand-new node the identity of a completely different,
     * already-registered one.
     *
     * We only trust the cache hit when either:
     *  - nothing occupies that nodeId yet (first-time reservation), or
     *  - the occupant is genuinely the same node (same browseName AND same
     *    parent) - in which case we deliberately return the same id so
     *    that the caller's duplicate-registration error still fires.
     */
    private _isCacheHitReusable(value: number, options: ConstructNodeIdOptions, parentInfo: [NodeId, Suffix] | null): boolean {
        const candidate = makeNodeId(value, this.namespaceIndex);
        const occupant = this.addressSpace.findNode(candidate);
        if (!occupant) {
            return true;
        }
        // options.browseName is expected to already carry its real, resolved namespaceIndex by the
        // time it reaches here: internalCreateNode() normalizes plain-string browseNames to
        // `namespaceIndex: this.index` before construction, so `0` here means "explicitly namespace 0"
        // (e.g. the standard "0:EURange" / "0:EngineeringUnits" properties), not "unspecified".
        // Comparing literally keeps genuinely different namespaces (own-namespace vs explicit ns 0)
        // from being treated as the same node.
        const sameBrowseName =
            !!occupant.browseName &&
            occupant.browseName.name === (options.browseName?.name ?? null) &&
            (occupant.browseName.namespaceIndex ?? 0) === (options.browseName?.namespaceIndex ?? 0);

        const expectedParentNodeId = parentInfo ? parentInfo[0] : null;
        // two parentless nodes are the same node only when one node organizes both (the same
        // node declared twice in a folder); otherwise they merely share a browse name
        const sameParent = expectedParentNodeId
            ? !!occupant.parentNodeId && sameNodeId(occupant.parentNodeId, expectedParentNodeId)
            : !occupant.parentNodeId && _shareAnOrganizer(occupant, options);

        return sameBrowseName && sameParent;
    }

    private _constructNodeId(options: ConstructNodeIdOptions): NodeId {
        const resolveNodeIdEx = (nodeId: BaseNode | NodeIdLike) =>
            nodeId && typeof nodeId === "object" && nodeId instanceof BaseNodeImpl
                ? nodeId.nodeId
                : resolveNodeId(nodeId as NodeIdLike);

        let nodeId = options.nodeId;

        if (!nodeId) {
            const parentInfo = this.findParentNodeId(options);
            if (parentInfo) {
                const [parentNodeId, _linkName] = parentInfo;
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
                    nodeId = `ns=${this.namespaceIndex};${nodeId}`;
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
        return !!this._cacheSymbolicNameRev.has(nodeId.value as number);
    }
}
