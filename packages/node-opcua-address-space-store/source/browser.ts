/**
 * @module node-opcua-address-space-store
 *
 * Browse and TranslateBrowsePaths on the store, by node index: the reference rows of a node
 * filtered by direction and reference type (with or without its subtypes), the targets' browse
 * names compared as interned ids. No node object is created along the way.
 */
import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { CompactStore } from "./compact_store.js";
import { NO_NODE } from "./node_id_index.js";
import { ReferenceTypeHierarchy } from "./reference_type_hierarchy.js";

export interface BrowseOptions {
    /** the reference type to follow; omitted means every reference */
    referenceType?: NodeId;
    includeSubtypes?: boolean;
    /** true: forward references; false: inverse; omitted: both */
    forward?: boolean;
    /** a mask of NodeClass values the targets must belong to; 0 means any */
    nodeClassMask?: number;
}

export interface BrowsedReference {
    row: number;
    target: number;
    referenceTypeOrdinal: number;
    forward: boolean;
}

export interface RelativePathElement {
    referenceType?: NodeId;
    isInverse?: boolean;
    includeSubtypes?: boolean;
    targetName: { namespaceIndex: number; name: string };
}

export class Browser {
    public readonly hierarchy = new ReferenceTypeHierarchy();
    readonly #store: CompactStore;
    // the acceptors handed out, by ordinal * 2 + (subtypes included ? 1 : 0); a closure each
    // was most of what a child lookup cost
    #acceptors: ((ordinal: number) => boolean)[] = [];

    constructor(store: CompactStore) {
        this.#store = store;
        this.hierarchy.build(store);
    }

    /** to be called after reference types changed (a nodeset loaded, a type added) */
    public refresh(): void {
        this.hierarchy.build(this.#store);
        this.#acceptors = [];
    }

    #acceptor(referenceType: NodeId, includeSubtypes: boolean): (ordinal: number) => boolean {
        const base = this.#store.referenceTypeOrdinal(referenceType);
        const key = base * 2 + (includeSubtypes ? 1 : 0);
        let accept = this.#acceptors[key];
        if (accept === undefined) {
            accept = this.hierarchy.acceptor(base, includeSubtypes);
            this.#acceptors[key] = accept; // check-proto-pollution: ok - numeric key from an ordinal
        }
        return accept;
    }

    public browse(node: number, options: BrowseOptions = {}): BrowsedReference[] {
        const store = this.#store;
        const refs = store.references;
        let accept: (ordinal: number) => boolean;
        if (options.referenceType) {
            accept = this.#acceptor(options.referenceType, options.includeSubtypes ?? true);
        } else {
            accept = () => true;
        }
        const mask = options.nodeClassMask ?? 0;
        const out: BrowsedReference[] = [];
        const want = options.forward;
        for (const row of refs.rowsOf(node)) {
            const forward = refs.isForward(row);
            if (want !== undefined && forward !== want) continue;
            const ordinal = refs.typeOrdinal(row);
            if (!accept(ordinal)) continue;
            const target = refs.target(row);
            if (mask !== 0 && (mask & store.nodes.nodeClass(target)) === 0) continue;
            if (store.nodes.isDeleted(target)) continue;
            out.push({ row, target, referenceTypeOrdinal: ordinal, forward });
        }
        return out;
    }

    /** the child of `node` named `name` in namespace `ns`, reached through `referenceType` or its subtypes */
    public child(node: number, ns: number, name: string, referenceType: NodeId, includeSubtypes = true, forward = true): number {
        const store = this.#store;
        const nameId = store.nodes.strings.find(name);
        if (nameId === -1) {
            return NO_NODE;
        }
        const refs = store.references;
        const accept = this.#acceptor(referenceType, includeSubtypes);
        for (const row of refs.rowsNamed(node, nameId)) {
            if (refs.isForward(row) !== forward || !accept(refs.typeOrdinal(row))) continue;
            const target = refs.target(row);
            if (store.nodes.browseNameNamespace(target) === ns && !store.nodes.isDeleted(target)) {
                return target;
            }
        }
        return NO_NODE;
    }

    /**
     * TranslateBrowsePaths for one path: every node the path leads to from `start`
     * (several when a browse name is not unique under a node), or [] when it leads nowhere
     */
    public translate(start: number, path: RelativePathElement[], defaultReferenceType: NodeId): number[] {
        let current = [start];
        for (const element of path) {
            const next: number[] = [];
            const referenceType = element.referenceType ?? defaultReferenceType;
            for (const node of current) {
                const found = this.#allChildren(
                    node,
                    element.targetName.namespaceIndex,
                    element.targetName.name,
                    referenceType,
                    element.includeSubtypes ?? true,
                    !element.isInverse
                );
                for (const f of found) if (!next.includes(f)) next.push(f);
            }
            if (next.length === 0) return [];
            current = next;
        }
        return current;
    }

    #allChildren(
        node: number,
        ns: number,
        name: string,
        referenceType: NodeId,
        includeSubtypes: boolean,
        forward: boolean
    ): number[] {
        const store = this.#store;
        const nameId = store.nodes.strings.find(name);
        if (nameId === -1) return [];
        const refs = store.references;
        const accept = this.#acceptor(referenceType, includeSubtypes);
        const out: number[] = [];
        for (const row of refs.rowsNamed(node, nameId)) {
            if (refs.isForward(row) !== forward || !accept(refs.typeOrdinal(row))) continue;
            const target = refs.target(row);
            if (store.nodes.browseNameNamespace(target) === ns && !store.nodes.isDeleted(target)) {
                out.push(target);
            }
        }
        return out;
    }

    /** the type definition of a node as the store knows it, resolved through HasTypeDefinition when the column is unset */
    public typeDefinition(node: number, hasTypeDefinition: NodeId): number {
        const t = this.#store.nodes.typeDefinition(node);
        if (t !== NO_NODE) return t;
        const targets = this.#store.targets(node, hasTypeDefinition, true);
        return targets.length > 0 ? targets[0] : NO_NODE;
    }

    public isObjectOrVariable(node: number): boolean {
        const c = this.#store.nodes.nodeClass(node);
        return c === NodeClass.Object || c === NodeClass.Variable;
    }
}
