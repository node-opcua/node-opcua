/**
 * @module node-opcua-address-space
 *
 * A node object over a node index of the store: what the application reads of a node, and
 * the methods it calls, answered from the columns. Holds the index, never a row position, so
 * it stays valid when the reference table is re-indexed.
 */
import { EventEmitter } from "node:events";
import { type BrowsedReference, NO_NODE, ReadStatus } from "node-opcua-address-space-store";
import { AttributeIds, LocalizedText, type NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant, type VariantOptions } from "node-opcua-variant";
import type { StoreAddressSpace } from "./store_address_space.js";

const HIERARCHICAL_REFERENCES = new NodeId(NodeIdType.NUMERIC, 33, 0);
const AGGREGATES = new NodeId(NodeIdType.NUMERIC, 44, 0);
const HAS_COMPONENT = new NodeId(NodeIdType.NUMERIC, 47, 0);
const HAS_PROPERTY = new NodeId(NodeIdType.NUMERIC, 46, 0);
const HAS_TYPE_DEFINITION = new NodeId(NodeIdType.NUMERIC, 40, 0);

/** what binds a Variable to the application: see StoreVariableView#bindVariable */
export interface VariableBinding {
    get?: () => Variant;
    /** returns the status of the write, Good when it returns nothing */
    set?: (value: Variant) => number | undefined;
    timestampedGet?: () => DataValue | Promise<DataValue>;
    refreshFunc?: (callback: (err: Error | null, dataValue?: DataValue) => void) => void;
}

/** a reference as the application sees it: the other end by NodeId, resolved to a view on request */
export class StoreReferenceView {
    constructor(
        private readonly space: StoreAddressSpace,
        public readonly referenceType: NodeId,
        public readonly isForward: boolean,
        public readonly targetIndex: number
    ) {}
    public get nodeId(): NodeId {
        return this.space.store.nodes.nodeId(this.targetIndex);
    }
    public get node(): StoreNodeView {
        return this.space.viewOf(this.targetIndex);
    }
}

export class StoreNodeView extends EventEmitter {
    public readonly space: StoreAddressSpace;
    public readonly index: number;

    constructor(space: StoreAddressSpace, index: number) {
        super();
        // the listener table only when the first listener comes (see BaseNodeImpl)
        (this as unknown as { _events?: unknown })._events = undefined;
        this.space = space;
        this.index = index;
    }

    // ---- attributes, straight from the columns
    public get nodeId(): NodeId {
        return this.space.store.nodes.nodeId(this.index);
    }
    public get nodeClass(): NodeClass {
        return this.space.store.nodes.nodeClass(this.index);
    }
    public get browseName(): QualifiedName {
        const nodes = this.space.store.nodes;
        return new QualifiedName({ namespaceIndex: nodes.browseNameNamespace(this.index), name: nodes.browseName(this.index) });
    }
    public get displayName(): LocalizedText[] {
        return [new LocalizedText({ text: this.space.store.nodes.displayName(this.index) })];
    }
    public get description(): LocalizedText {
        return new LocalizedText({ text: this.space.store.nodes.description(this.index) ?? "" });
    }
    public get namespaceIndex(): number {
        return this.space.store.nodes.namespace(this.index);
    }
    public get typeDefinition(): NodeId {
        const t = this.space.browser.typeDefinition(this.index, HAS_TYPE_DEFINITION);
        return t === NO_NODE ? new NodeId() : this.space.store.nodes.nodeId(t);
    }
    public get typeDefinitionObj(): StoreNodeView | null {
        const t = this.space.browser.typeDefinition(this.index, HAS_TYPE_DEFINITION);
        return t === NO_NODE ? null : this.space.viewOf(t);
    }
    public get parent(): StoreNodeView | null {
        // the parent the document declared wins, as it does in the object address space
        const declared = this.space.store.nodes.parent(this.index);
        if (declared !== NO_NODE) {
            return this.space.viewOf(declared);
        }
        const parents = this.space.browser.browse(this.index, { referenceType: AGGREGATES, includeSubtypes: true, forward: false });
        return parents.length > 0 ? this.space.viewOf(parents[0].target) : null;
    }
    public isDisposed(): boolean {
        return this.space.store.nodes.isDeleted(this.index);
    }

    // ---- references
    public findReferencesEx(referenceType: NodeId | string, forward = true): StoreReferenceView[] {
        const type = typeof referenceType === "string" ? wellKnownReferenceType(referenceType) : referenceType;
        return this.space.browser
            .browse(this.index, { referenceType: type, includeSubtypes: true, forward })
            .map((r) => this.#reference(r));
    }
    public findReferences(referenceType: NodeId | string, forward = true): StoreReferenceView[] {
        const type = typeof referenceType === "string" ? wellKnownReferenceType(referenceType) : referenceType;
        return this.space.browser
            .browse(this.index, { referenceType: type, includeSubtypes: false, forward })
            .map((r) => this.#reference(r));
    }
    public allReferences(): StoreReferenceView[] {
        return this.space.browser.browse(this.index).map((r) => this.#reference(r));
    }
    #reference(r: BrowsedReference): StoreReferenceView {
        return new StoreReferenceView(this.space, this.space.store.referenceTypeOf(r.referenceTypeOrdinal), r.forward, r.target);
    }

    // ---- children
    public getChildByName(name: string, namespaceIndex = this.namespaceIndex): StoreNodeView | null {
        return this.#child(name, namespaceIndex, HIERARCHICAL_REFERENCES);
    }
    public getComponentByName(name: string, namespaceIndex = this.namespaceIndex): StoreNodeView | null {
        return this.#child(name, namespaceIndex, HAS_COMPONENT);
    }
    public getPropertyByName(name: string, namespaceIndex = this.namespaceIndex): StoreNodeView | null {
        return this.#child(name, namespaceIndex, HAS_PROPERTY);
    }
    public getComponents(): StoreNodeView[] {
        return this.space.browser
            .browse(this.index, { referenceType: HAS_COMPONENT, forward: true })
            .map((r) => this.space.viewOf(r.target));
    }
    public getProperties(): StoreNodeView[] {
        return this.space.browser
            .browse(this.index, { referenceType: HAS_PROPERTY, forward: true })
            .map((r) => this.space.viewOf(r.target));
    }
    #child(name: string, namespaceIndex: number, referenceType: NodeId): StoreNodeView | null {
        // a child is looked up in the node's own namespace first, then in the base namespace
        let child = this.space.browser.child(this.index, namespaceIndex, name, referenceType);
        if (child === NO_NODE && namespaceIndex !== 0) {
            child = this.space.browser.child(this.index, 0, name, referenceType);
        }
        return child === NO_NODE ? null : this.space.viewOf(child);
    }

    // ---- read
    public readAttribute(_context: unknown, attributeId: AttributeIds): DataValue {
        const read = this.space.reader.read(this.index, attributeId);
        if (read.statusCode !== ReadStatus.Good) {
            return new DataValue({ statusCode: coerceStatusCode(read.statusCode) });
        }
        const now = getCurrentClock();
        return new DataValue({
            value: new Variant({ dataType: read.dataType, arrayType: read.arrayType, value: read.value } as VariantOptions),
            statusCode: StatusCodes.Good,
            sourceTimestamp: read.sourceTimestamp ? new Date(read.sourceTimestamp) : now.timestamp,
            sourcePicoseconds: read.sourcePicoseconds,
            serverTimestamp: now.timestamp,
            serverPicoseconds: now.picoseconds
        });
    }

    public toString(): string {
        return `${this.nodeId.toString()} ${this.browseName.toString()}`;
    }
}

const wellKnown: Record<string, NodeId> = {
    HierarchicalReferences: HIERARCHICAL_REFERENCES,
    Aggregates: AGGREGATES,
    HasComponent: HAS_COMPONENT,
    HasProperty: HAS_PROPERTY,
    HasTypeDefinition: HAS_TYPE_DEFINITION,
    Organizes: new NodeId(NodeIdType.NUMERIC, 35, 0),
    HasSubtype: new NodeId(NodeIdType.NUMERIC, 45, 0),
    HasChild: new NodeId(NodeIdType.NUMERIC, 34, 0)
};
function wellKnownReferenceType(name: string): NodeId {
    const id = wellKnown[name];
    if (!id) {
        throw new Error(`StoreNodeView: unknown reference type name ${name}`);
    }
    return id;
}

export { AttributeIds };
