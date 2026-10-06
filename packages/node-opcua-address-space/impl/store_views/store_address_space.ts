/**
 * @module node-opcua-address-space
 *
 * An address space backed by the compact store. The store holds the data; the node objects
 * the application sees (`findNode()`, `folder.getChildByName()`) are views over a node index,
 * built on demand and kept in a bounded most-recently-used cache, so that a model of ten
 * million nodes costs ten million rows and only as many objects as are being looked at.
 */
import { AttributeReader, Browser, CompactStore, DataTypeResolver, NO_NODE } from "node-opcua-address-space-store";
import { NodeClass } from "node-opcua-data-model";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import type { NodeSetPermissionsPolicy } from "../../api/interfaces/nodeset_loader_options.js";
import type { NodesetRecord } from "../../api/loader/nodeset_record.js";
import { StoreRecordApplier, type StoreRecordApplierOptions } from "../../api/loader/store_record_applier.js";
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
    /** what the nodeset's RolePermissions and AccessRestrictions become: enforced, or ignored */
    permissions?: NodeSetPermissionsPolicy;
    accessRestrictions?: NodeSetPermissionsPolicy;
}

/**
 * a bounded cache of views: a Map keeps insertion order, so the first entry is the least
 * recently used once a hit re-inserts its entry
 */
class ViewCache {
    readonly #views = new Map<number, StoreNodeView>();
    readonly #capacity: number;
    #tick = 0;
    constructor(capacity: number) {
        this.#capacity = Math.max(16, capacity);
    }
    get(index: number): StoreNodeView | undefined {
        const view = this.#views.get(index);
        if (view !== undefined) {
            // a hit only stamps the view: no reordering of the map on the hot path
            view.lastUse = ++this.#tick;
        }
        return view;
    }
    set(index: number, view: StoreNodeView): void {
        view.lastUse = ++this.#tick;
        this.#views.set(index, view);
        if (this.#views.size > this.#capacity) {
            this.#evict();
        }
    }
    /**
     * drop the older quarter of the stamp range, which is the least recently used quarter or
     * so without a sort; when the stamps bunch up and that frees too little, sort once. A view
     * the application holds keeps working either way.
     */
    #evict(): void {
        let oldest = this.#tick;
        for (const v of this.#views.values()) if (v.lastUse < oldest) oldest = v.lastUse;
        let cutoff = oldest + (this.#tick - oldest) / 4;
        const target = this.#views.size - this.#capacity * 0.75;
        let freed = 0;
        for (const v of this.#views.values()) if (v.lastUse <= cutoff) freed++;
        if (freed < target) {
            const stamps: number[] = [];
            for (const v of this.#views.values()) stamps.push(v.lastUse);
            stamps.sort((a, b) => a - b);
            cutoff = stamps[Math.floor(stamps.length / 4)];
        }
        for (const [index, v] of this.#views) {
            if (v.lastUse <= cutoff) this.#views.delete(index);
        }
    }
    delete(index: number): void {
        this.#views.delete(index);
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
    readonly #applierOptions: StoreRecordApplierOptions;
    #applier: StoreRecordApplier | null = null;

    constructor(options: StoreAddressSpaceOptions = {}) {
        this.store = new CompactStore({ expectedNodes: options.expectedNodes ?? 4096 });
        this.browser = new Browser(this.store);
        this.reader = new AttributeReader(this.store);
        this.dataTypes = new DataTypeResolver(this.store);
        this.permissions = new StorePermissions(this, options.unresolvedPermissionPolicy);
        this.#views = new ViewCache(options.viewCacheSize ?? 10000);
        this.#builder = new StoreNodeBuilder(this);
        this.#applierOptions = { permissions: options.permissions, accessRestrictions: options.accessRestrictions };
    }

    // ---- loading
    /** the consumer a nodeset producer feeds; finishLoad() once the records are all in */
    public recordConsumer(): { apply(record: NodesetRecord): void } {
        if (!this.#applier) {
            this.#applier = new StoreRecordApplier(
                this.store,
                { indexOf: (uri) => this.namespaceIndexOf(uri) },
                this.#applierOptions
            );
        }
        return this.#applier;
    }
    public finishLoad(): { unresolved: number } {
        const result = this.#applier ? this.#applier.finish() : { unresolved: 0 };
        this.#applier = null;
        this.browser.refresh();
        this.dataTypes.invalidate();
        this.permissions.invalidate();
        return result;
    }

    /** a namespace of the application: the index new nodes default to */
    public registerNamespace(uri: string): number {
        return this.namespaceIndexOf(uri);
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
     * forget a node: gone for clients at once, with its references from both ends; its row is
     * reclaimed at the next compaction. A view the application still holds answers isDisposed()
     */
    public deleteNode(node: StoreNodeView | NodeId | string | number): void {
        const index = typeof node === "number" ? node : this.#builder.indexOf(node);
        this.store.deleteNode(index);
        this.bindings.delete(index);
        this.#views.delete(index);
        this.permissions.invalidate();
    }
}
