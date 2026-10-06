/**
 * @module node-opcua-address-space
 *
 * A node object over a node index of the store: what the application reads of a node, and
 * the methods it calls, answered from the columns. Holds the index, never a row position, so
 * it stays valid when the reference table is re-indexed.
 */
import { EventEmitter } from "node:events";
import type { ISessionContext } from "node-opcua-address-space-base";
import { type BrowsedReference, NO_NODE } from "node-opcua-address-space-store";
import { AttributeIds, LocalizedText, type NodeClass, QualifiedName } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import type { Variant } from "node-opcua-variant";
import type { StoreAddressSpace } from "./store_address_space.js";
import { attributeDataValue } from "./store_data_value.js";

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
    /**
     * the view cache's mark: 1 when used since the hand last passed, 0 when not, -1 when the
     * ring let it go while it had listeners (a monitored item holds it): it then stays the
     * view of its node until the last listener leaves
     */
    public lastUse = 0;
    #nodeId: NodeId | undefined;
    #browseName: QualifiedName | undefined;

    constructor(space: StoreAddressSpace, index: number) {
        super();
        // the listener table only when the first listener comes (see BaseNodeImpl)
        (this as unknown as { _events?: unknown })._events = undefined;
        this.space = space;
        this.index = index;
    }

    // ---- attributes, straight from the columns
    public get nodeId(): NodeId {
        if (this.#nodeId === undefined) {
            this.#nodeId = this.space.store.nodes.nodeId(this.index);
        }
        return this.#nodeId;
    }
    public get nodeClass(): NodeClass {
        return this.space.store.nodes.nodeClass(this.index);
    }
    public get browseName(): QualifiedName {
        if (this.#browseName === undefined) {
            const nodes = this.space.store.nodes;
            this.#browseName = new QualifiedName({
                namespaceIndex: nodes.browseNameNamespace(this.index),
                name: nodes.browseName(this.index)
            });
        }
        return this.#browseName;
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

    /** true when something listens to this view: a monitored item, the application */
    public hasListeners(): boolean {
        return (this as unknown as { _eventsCount: number })._eventsCount > 0;
    }

    public override removeListener(event: string | symbol, listener: (...args: unknown[]) => void): this {
        super.removeListener(event, listener);
        this.#afterListenerRemoved();
        return this;
    }
    public override off(event: string | symbol, listener: (...args: unknown[]) => void): this {
        return this.removeListener(event, listener);
    }
    public override removeAllListeners(event?: string | symbol): this {
        super.removeAllListeners(event);
        this.#afterListenerRemoved();
        return this;
    }
    #afterListenerRemoved(): void {
        if (this.lastUse === -1 && !this.hasListeners()) {
            this.space.forgetView(this);
        }
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
    public readAttribute(_context: ISessionContext | null, attributeId: AttributeIds): DataValue {
        return attributeDataValue(this.space.reader, this.index, attributeId);
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
