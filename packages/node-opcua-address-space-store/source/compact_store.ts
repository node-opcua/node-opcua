/**
 * @module node-opcua-address-space-store
 *
 * The store as one object: nodes, references, values, and the small tables that bind them
 * (reference type ordinals, references waiting for a node that is not there yet).
 */
import type { NodeClass } from "node-opcua-data-model";
import { type NodeId, NodeIdType } from "node-opcua-nodeid";
import { NO_NODE, type NodeRecord, NodeStore } from "./node_store.js";
import { ReferenceTable } from "./reference_table.js";
import { ValueStore } from "./value_store.js";

export interface CompactStoreOptions {
    expectedNodes?: number;
}

/** a reference declared before its target existed: resolved by `resolvePending()` */
interface PendingReference {
    source: number;
    typeOrdinal: number;
    forward: boolean;
    target: NodeId;
}

export class CompactStore {
    public readonly nodes: NodeStore;
    public readonly references: ReferenceTable;
    public readonly values: ValueStore;
    // reference types are few (hundreds): a Map keyed by a packed NodeId is fine here
    readonly #ordinalByReferenceType = new Map<number | string, number>();
    readonly #referenceTypeByOrdinal: NodeId[] = [];
    #pending: PendingReference[] = [];

    constructor(options: CompactStoreOptions = {}) {
        const expected = options.expectedNodes ?? 1024;
        this.nodes = new NodeStore(expected);
        this.references = new ReferenceTable(expected * 3);
        this.values = new ValueStore(expected);
    }

    public get nodeCount(): number {
        return this.nodes.count;
    }

    /** the ordinal of a reference type, assigned on first sight */
    public referenceTypeOrdinal(referenceType: NodeId): number {
        const key = packedKey(referenceType);
        let ordinal = this.#ordinalByReferenceType.get(key);
        if (ordinal === undefined) {
            ordinal = this.#referenceTypeByOrdinal.length;
            this.#referenceTypeByOrdinal.push(referenceType);
            this.#ordinalByReferenceType.set(key, ordinal);
        }
        return ordinal;
    }

    public referenceTypeOf(ordinal: number): NodeId {
        return this.#referenceTypeByOrdinal[ordinal];
    }

    public get referenceTypeCount(): number {
        return this.#referenceTypeByOrdinal.length;
    }

    public addNode(record: NodeRecord): number {
        const i = this.nodes.add(record);
        this.values.ensure(this.nodes.count);
        return i;
    }

    public find(nodeId: NodeId): number {
        return this.nodes.find(nodeId);
    }

    /**
     * one end of a reference, by NodeIds. A target that does not exist yet (a nodeset declares
     * nodes in any order) is kept aside and resolved by resolvePending(), which a load calls
     * once at its end.
     */
    public addReference(source: number, referenceType: NodeId, forward: boolean, target: NodeId): void {
        const typeOrdinal = this.referenceTypeOrdinal(referenceType);
        const targetIndex = this.nodes.find(target);
        if (targetIndex === NO_NODE) {
            this.#pending.push({ source, typeOrdinal, forward, target });
            return;
        }
        this.references.add(source, typeOrdinal, forward, targetIndex);
    }

    /** the references whose target was missing when they were declared */
    public get pendingCount(): number {
        return this.#pending.length;
    }

    /**
     * resolve the references that waited for their target; those whose target is still
     * missing are returned, as (source index, reference type, target NodeId)
     */
    public resolvePending(): { source: number; referenceType: NodeId; forward: boolean; target: NodeId }[] {
        const unresolved: { source: number; referenceType: NodeId; forward: boolean; target: NodeId }[] = [];
        const pending = this.#pending;
        this.#pending = [];
        for (const p of pending) {
            const targetIndex = this.nodes.find(p.target);
            if (targetIndex === NO_NODE) {
                unresolved.push({
                    source: p.source,
                    referenceType: this.#referenceTypeByOrdinal[p.typeOrdinal],
                    forward: p.forward,
                    target: p.target
                });
                continue;
            }
            this.references.add(p.source, p.typeOrdinal, p.forward, targetIndex);
        }
        return unresolved;
    }

    /**
     * after a load: forget the growth slack, order the references by source, and give every
     * declared reference its inverse row where the other end did not declare it
     */
    public finish(): void {
        this.nodes.compact();
        this.values.compact(this.nodes.count);
        this.references.index(this.nodes.count);
        this.#addMissingInverses();
    }

    /**
     * a NodeSet2 file declares most references from both ends; the ones it declares from one
     * end only get their inverse row here, so that browsing in either direction sees them
     */
    #addMissingInverses(): void {
        const refs = this.references;
        const rows = refs.rowCount;
        for (let row = 0; row < rows; row++) {
            if (!refs.isLive(row)) continue;
            const source = refs.source(row);
            const target = refs.target(row);
            const typeOrdinal = refs.typeOrdinal(row);
            const forward = refs.isForward(row);
            if (refs.find(target, typeOrdinal, !forward, source) === -1) {
                refs.add(target, typeOrdinal, !forward, source);
            }
        }
        if (refs.overflowSize > 0) {
            refs.index(this.nodes.count);
        }
    }

    /** the node indexes `source` points at through `referenceType`, in the given direction */
    public targets(source: number, referenceType: NodeId, forward: boolean): number[] {
        const key = packedKey(referenceType);
        const ordinal = this.#ordinalByReferenceType.get(key);
        if (ordinal === undefined) {
            return [];
        }
        const refs = this.references;
        return refs.collect(source, forward, (o) => o === ordinal).map((row) => refs.target(row));
    }
}

/** a Map key for the few NodeIds the store keeps in maps (reference types): not for nodes */
export function packedKey(nodeId: NodeId): number | string {
    if (nodeId.identifierType === NodeIdType.NUMERIC && nodeId.namespace < 0x10000) {
        return nodeId.namespace * 0x100000000 + (nodeId.value as number);
    }
    return nodeId.toString();
}

export type { NodeClass };
