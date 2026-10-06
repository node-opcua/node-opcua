/**
 * @module node-opcua-address-space-store
 *
 * An address space backed by the compact store. The store holds the data; the node objects
 * the application sees (`findNode()`, `folder.getChildByName()`) are views over a node index,
 * built on demand and kept in a bounded most-recently-used cache, so that a model of ten
 * million nodes costs ten million rows and only as many objects as are being looked at.
 */

import { NodeClass } from "node-opcua-data-model";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { AttributeReader } from "../attribute_reader.js";
import { Browser } from "../browser.js";
import { CompactStore } from "../compact_store.js";
import { DataTypeResolver } from "../data_type_resolver.js";
import { NO_NODE } from "../node_id_index.js";
import {
    type StoreAddNodeOptions,
    type StoreAddObjectOptions,
    type StoreAddVariableOptions,
    StoreNodeBuilder
} from "./store_node_builder.js";
import { StoreNodeView, type VariableBinding } from "./store_node_view.js";
import { StoreObjectView } from "./store_object_view.js";
import { StorePermissions, type UnresolvedPermissionPolicy } from "./store_permissions.js";
import { StoreVariableView } from "./store_variable_view.js";

export interface StoreAddressSpaceOptions {
    expectedNodes?: number;
    /** how many views are kept alive at most; the least recently used go first */
    viewCacheSize?: number;
    /** what a session whose roles match no policy gets: everything (the default) or nothing */
    unresolvedPermissionPolicy?: UnresolvedPermissionPolicy;
    /** the columns in SharedArrayBuffers, for readers in other threads (see CompactStore#shareForReaders) */
    shared?: boolean;
}

/**
 * a bounded cache of views, replaced the CLOCK way: the views sit in a ring, a hit marks the
 * view used, and an insertion takes the first slot past the hand whose view was not used since
 * the hand last passed it, clearing the marks it walks over. Constant work per insertion, no
 * ordering kept, and a view the application holds keeps working after it left the ring.
 *
 * A view with listeners (a monitored item) gives up its ring slot but stays the view of its
 * node, so that every writer of the node reaches the listeners; it is forgotten when the last
 * listener leaves (see StoreNodeView#removeListener).
 */
class ViewCache {
    readonly #views = new Map<number, StoreNodeView>();
    readonly #ring: (StoreNodeView | undefined)[];
    #hand = 0;
    constructor(capacity: number) {
        this.#ring = new Array(Math.max(16, capacity)).fill(undefined);
    }
    get(index: number): StoreNodeView | undefined {
        const view = this.#views.get(index);
        if (view !== undefined && view.lastUse !== -1) {
            // a view out of the ring (listeners) keeps its mark: it is forgotten by its last listener
            view.lastUse = 1;
        }
        return view;
    }
    set(index: number, view: StoreNodeView): void {
        const ring = this.#ring;
        const n = ring.length;
        let hand = this.#hand;
        for (;;) {
            const occupant = ring[hand];
            if (occupant === undefined) {
                break;
            }
            if (occupant.lastUse === 0 || occupant.isDisposed()) {
                if (occupant.hasListeners() && !occupant.isDisposed()) {
                    occupant.lastUse = -1; // out of the ring, still the node's view
                } else {
                    this.#views.delete(occupant.index);
                }
                break;
            }
            occupant.lastUse = 0;
            hand = hand + 1 === n ? 0 : hand + 1;
        }
        view.lastUse = 1;
        ring[hand] = view; // check-proto-pollution: ok - numeric ring position
        this.#hand = hand + 1 === n ? 0 : hand + 1;
        this.#views.set(index, view);
    }
    delete(index: number): void {
        // the ring slot is left to the hand: a disposed view is taken at the first pass
        this.#views.delete(index);
    }
    /** the view, if it is the one the cache holds for its node */
    forget(view: StoreNodeView): void {
        if (this.#views.get(view.index) === view) {
            this.#views.delete(view.index);
        }
    }
    get size(): number {
        return this.#views.size;
    }
}

export class StoreAddressSpace {
    public readonly store: CompactStore;
    public readonly browser: Browser;
    public readonly reader: AttributeReader;
    /** what each Variable's DataType accepts on a write */
    public readonly dataTypes: DataTypeResolver;
    public readonly namespaceUris: string[] = [];
    /** the getters, setters and refresh functions bound to Variables, by node index */
    public readonly bindings = new Map<number, VariableBinding>();
    /** what a session may read: the access restrictions and role permissions of the nodes */
    public readonly permissions: StorePermissions;
    readonly #views: ViewCache;
    readonly #builder: StoreNodeBuilder;

    constructor(options: StoreAddressSpaceOptions = {}) {
        this.store = new CompactStore({ expectedNodes: options.expectedNodes ?? 4096, shared: options.shared });
        this.browser = new Browser(this.store);
        this.reader = new AttributeReader(this.store);
        this.dataTypes = new DataTypeResolver(this.store);
        this.permissions = new StorePermissions(this, options.unresolvedPermissionPolicy);
        this.#views = new ViewCache(options.viewCacheSize ?? 10000);
        this.#builder = new StoreNodeBuilder(this);
    }

    // ---- loading
    /**
     * after a load wrote its records into the store (the nodeset loader of node-opcua-address-space
     * does, through its StoreRecordApplier): what was derived from the columns is derived again
     */
    public finishLoad(): void {
        this.browser.refresh();
        this.dataTypes.invalidate();
        this.permissions.invalidate();
    }

    /** a namespace of the application: the index new nodes default to */
    public registerNamespace(uri: string): number {
        return this.namespaceIndexOf(uri);
    }

    /**
     * after a burst of additions: the reference rows re-indexed and the growth slack dropped,
     * as after a load. The rows added since the last index wait in per-node lists, which is
     * what a model built node by node mostly costs; this folds them into the table.
     */
    public compact(): void {
        this.store.finish();
        this.browser.refresh();
        this.dataTypes.invalidate();
        this.permissions.invalidate();
    }

    public namespaceIndexOf(uri: string): number {
        let index = this.namespaceUris.indexOf(uri);
        if (index === -1) {
            index = this.namespaceUris.push(uri) - 1;
        }
        return index;
    }

    // ---- nodes
    public get nodeCount(): number {
        return this.store.nodeCount;
    }

    public findNode(nodeId: NodeId | string): StoreNodeView | null {
        const index = this.store.find(resolveNodeId(nodeId));
        return index === NO_NODE ? null : this.viewOf(index);
    }

    /** the view of a node index: the one in the cache, or a new one */
    public viewOf(index: number): StoreNodeView {
        let view = this.#views.get(index);
        if (view === undefined) {
            view = this.#makeView(index);
            this.#views.set(index, view);
        }
        return view;
    }

    public get viewCount(): number {
        return this.#views.size;
    }

    /** a view that left the ring and lost its last listener: no longer the node's view */
    public forgetView(view: StoreNodeView): void {
        this.#views.forget(view);
    }

    #makeView(index: number): StoreNodeView {
        switch (this.store.nodes.nodeClass(index)) {
            case NodeClass.Variable:
                return new StoreVariableView(this, index);
            case NodeClass.Object:
                return new StoreObjectView(this, index);
            default:
                return new StoreNodeView(this, index);
        }
    }

    // ---- changes while running: the records go into the columns, the view comes back
    public addVariable(options: StoreAddVariableOptions): StoreVariableView {
        return this.#builder.addVariable(options);
    }
    public addObject(options: StoreAddObjectOptions): StoreNodeView {
        return this.#builder.addObject(options);
    }
    public addFolder(parent: StoreNodeView | NodeId | string, options: StoreAddNodeOptions | string): StoreNodeView {
        return this.#builder.addFolder(parent, options);
    }
    /** both ends written; false when the reference is there already */
    public addReference(
        source: StoreNodeView | NodeId | string,
        referenceType: NodeId | string,
        target: StoreNodeView | NodeId | string,
        forward = true
    ): boolean {
        return this.#builder.addReference(source, referenceType, target, forward);
    }
    public removeReference(
        source: StoreNodeView | NodeId | string,
        referenceType: NodeId | string,
        target: StoreNodeView | NodeId | string,
        forward = true
    ): boolean {
        return this.#builder.removeReference(source, referenceType, target, forward);
    }

    /**
     * forget a node: gone for clients at once, with its references from both ends; its index
     * goes to the next node added. A view the application still holds answers isDisposed()
     */
    public deleteNode(node: StoreNodeView | NodeId | string | number): void {
        const index = typeof node === "number" ? node : this.#builder.indexOf(node);
        const view = this.#views.get(index);
        const nodeClass = this.store.nodes.nodeClass(index);
        this.store.deleteNode(index);
        this.bindings.delete(index);
        this.#views.delete(index);
        this.permissions.invalidate();
        if (nodeClass === NodeClass.ReferenceType) {
            this.browser.refresh();
        } else if (nodeClass === NodeClass.DataType) {
            this.dataTypes.invalidate();
        }
        // what a monitored item on the node listens to, as on the node objects
        view?.emit("dispose");
    }
}
