/**
 * @module node-opcua-address-space-store
 *
 * Which reference type is a subtype of which, as one bitset per reference type ordinal, built
 * from the HasSubtype rows between the ReferenceType nodes of the store. Browse asks this for
 * every reference it looks at ("is HasComponent a HierarchicalReference?"), so the answer is one
 * bit test. Rebuilt when a reference type is added or re-parented, which is rare.
 */
import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import type { CompactStore } from "./compact_store.js";

const HAS_SUBTYPE = new NodeId(NodeIdType.NUMERIC, 45, 0);

export class ReferenceTypeHierarchy {
    // subtypes[ordinal] = bitset over ordinals of the types that are `ordinal` or a subtype of it
    #subtypes: Uint32Array[] = [];
    #words = 0;
    #ordinalOfNode = new Map<number, number>(); // node index -> ordinal
    #version = -1;

    /** the ordinal of the reference type node `i`, or -1 when it is not a reference type */
    public ordinalOf(node: number): number {
        return this.#ordinalOfNode.get(node) ?? -1;
    }

    /** true when `ordinal` is `base` itself or one of its subtypes */
    public isSubtypeOf(ordinal: number, base: number): boolean {
        const bits = this.#subtypes[base];
        if (!bits || ordinal < 0) return false;
        const word = ordinal >>> 5;
        return word < bits.length && (bits[word] & (1 << (ordinal & 31))) !== 0;
    }

    /** the test `collect` wants: every type at or below `base`, or exactly `base` */
    public acceptor(base: number, includeSubtypes: boolean): (ordinal: number) => boolean {
        if (!includeSubtypes) {
            return (ordinal) => ordinal === base;
        }
        const bits = this.#subtypes[base];
        if (!bits) {
            return () => false;
        }
        return (ordinal) => (bits[ordinal >>> 5] & (1 << (ordinal & 31))) !== 0;
    }

    public get version(): number {
        return this.#version;
    }

    /** (re)build from the store: every ReferenceType node gets an ordinal, then the closure of HasSubtype */
    public build(store: CompactStore, version = this.#version + 1): void {
        const nodes = store.nodes;
        const count = nodes.count;
        this.#ordinalOfNode.clear();
        const typeNodes: number[] = [];
        for (let i = 0; i < count; i++) {
            if (nodes.nodeClass(i) === NodeClass.ReferenceType && !nodes.isDeleted(i)) {
                const ordinal = store.referenceTypeOrdinal(nodes.nodeId(i));
                this.#ordinalOfNode.set(i, ordinal);
                typeNodes.push(i);
            }
        }
        const n = store.referenceTypeCount;
        this.#words = (n + 31) >>> 5;
        const sets: Uint32Array[] = new Array(n);
        for (let o = 0; o < n; o++) {
            sets[o] = new Uint32Array(this.#words);
            sets[o][o >>> 5] |= 1 << (o & 31);
        }
        // children of each type, by ordinal
        const children: number[][] = new Array(n).fill(null).map(() => []);
        for (const i of typeNodes) {
            const parentOrdinal = this.#ordinalOfNode.get(i) as number;
            for (const child of store.targets(i, HAS_SUBTYPE, true)) {
                const childOrdinal = this.#ordinalOfNode.get(child);
                if (childOrdinal !== undefined) children[parentOrdinal].push(childOrdinal);
            }
        }
        // closure: a type's set is the union of its children's sets, depth first with a guard
        const done = new Uint8Array(n);
        const visit = (o: number, depth: number): void => {
            if (done[o] === 1 || depth > n) return;
            done[o] = 1;
            for (const c of children[o]) {
                visit(c, depth + 1);
                const mine = sets[o];
                const theirs = sets[c];
                for (let w = 0; w < this.#words; w++) mine[w] |= theirs[w];
            }
        };
        for (let o = 0; o < n; o++) visit(o, 0);
        this.#subtypes = sets;
        this.#version = version;
    }
}
