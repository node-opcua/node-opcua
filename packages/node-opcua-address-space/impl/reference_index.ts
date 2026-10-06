import type { UAReference } from "node-opcua-address-space-base";
import type { ReferenceImpl, ReferenceKey } from "./reference_impl.js";

/**
 * above this many references a node indexes them in a Map; below, a plain array scanned on
 * lookup. A leaf node holds two or three references, and a Map with its hash table costs
 * about 280 bytes even when nearly empty: a quarter of what a node weighs. On a model of a
 * million nodes that is the difference between fitting in memory and not.
 */
const MAP_THRESHOLD = 16;

/**
 * The references a node holds, by key (see ReferenceImpl#key). It offers what the code uses of
 * a Map: get, has, set, delete, values, size and iteration.
 *
 * The key is not stored twice: a reference caches its own key when it is indexed, and a scan
 * compares that cached key.
 */
export class ReferenceIndex {
    #refs: UAReference[] | null = null;
    #map: Map<ReferenceKey, UAReference> | null = null;

    public get size(): number {
        return this.#map ? this.#map.size : this.#refs ? this.#refs.length : 0;
    }

    #indexOf(key: ReferenceKey): number {
        const refs = this.#refs as ReferenceImpl[];
        for (let i = 0; i < refs.length; i++) {
            if (refs[i]._key === key) {
                return i;
            }
        }
        return -1;
    }

    public has(key: ReferenceKey): boolean {
        if (this.#map) {
            return this.#map.has(key);
        }
        return this.#refs !== null && this.#indexOf(key) !== -1;
    }

    public get(key: ReferenceKey): UAReference | undefined {
        if (this.#map) {
            return this.#map.get(key);
        }
        if (this.#refs === null) {
            return undefined;
        }
        const index = this.#indexOf(key);
        return index === -1 ? undefined : this.#refs[index];
    }

    /** `key` must be the reference's own key (ReferenceImpl#key), which is what callers index by */
    public set(key: ReferenceKey, reference: UAReference): this {
        if (this.#map) {
            this.#map.set(key, reference);
            return this;
        }
        if (this.#refs === null) {
            this.#refs = [reference];
            return this;
        }
        const index = this.#indexOf(key);
        if (index !== -1) {
            this.#refs[index] = reference; // check-proto-pollution: ok - numeric index
            return this;
        }
        if (this.#refs.length >= MAP_THRESHOLD) {
            const map = new Map<ReferenceKey, UAReference>();
            for (const ref of this.#refs) {
                map.set((ref as ReferenceImpl)._key as ReferenceKey, ref);
            }
            map.set(key, reference);
            this.#map = map;
            this.#refs = null;
            return this;
        }
        // concat allocates exactly the length needed; push would grow the backing store to 17
        // slots, which is more than the Map this replaces
        this.#refs = this.#refs.concat(reference);
        return this;
    }

    public delete(key: ReferenceKey): boolean {
        if (this.#map) {
            return this.#map.delete(key);
        }
        if (this.#refs === null) {
            return false;
        }
        const index = this.#indexOf(key);
        if (index === -1) {
            return false;
        }
        this.#refs = this.#refs.length === 1 ? null : this.#refs.filter((_r, i) => i !== index);
        return true;
    }

    public clear(): void {
        this.#refs = null;
        this.#map = null;
    }

    public values(): IterableIterator<UAReference> {
        if (this.#map) {
            return this.#map.values();
        }
        return (this.#refs ?? []).values();
    }

    public [Symbol.iterator](): IterableIterator<UAReference> {
        return this.values();
    }
}
