/**
 * @module node-opcua-address-space
 *
 * Where precompiled images are kept between loads. The loader keys an image by the record
 * schema and the SHA-256 of the source bytes: an edited file gets a fresh image, a schema bump
 * invalidates every image, and nothing else does. The package version is deliberately not part
 * of the key, so that an image built by one release stays valid for the next while the record
 * shape holds.
 */
import { NODESET_RECORD_SCHEMA } from "./nodeset_record.js";

export interface NodesetImageStore {
    /** the image stored under `key`, or undefined */
    get(key: string): Promise<Uint8Array | undefined>;
    /** keep `image` under `key`; a store may drop older images to stay within its size */
    put(key: string, image: Uint8Array): Promise<void>;
}

/** the key of the image of a source whose bytes hash to `sourceDigest` */
export function nodesetImageKey(sourceDigest: string): string {
    return `${NODESET_RECORD_SCHEMA}-${sourceDigest}`;
}

/** an in-memory store: for browsers, tests, and a process that loads the same files repeatedly */
export class MemoryNodesetImageStore implements NodesetImageStore {
    private readonly images = new Map<string, Uint8Array>();

    constructor(private readonly maxBytes = 64 * 1024 * 1024) {}

    public async get(key: string): Promise<Uint8Array | undefined> {
        const image = this.images.get(key);
        if (image) {
            // most recently used last: what eviction keeps
            this.images.delete(key);
            this.images.set(key, image);
        }
        return image;
    }

    public async put(key: string, image: Uint8Array): Promise<void> {
        this.images.delete(key);
        this.images.set(key, image);
        let total = 0;
        for (const stored of this.images.values()) {
            total += stored.length;
        }
        for (const [oldest, stored] of this.images) {
            if (total <= this.maxBytes || oldest === key) {
                break;
            }
            this.images.delete(oldest);
            total -= stored.length;
        }
    }

    public get size(): number {
        return this.images.size;
    }

    public keys(): string[] {
        return [...this.images.keys()];
    }
}

let sharedStore: MemoryNodesetImageStore | undefined;

/**
 * the store a plain `imageStore: true` selects where no file system store is available (the
 * browser, `generateAddressSpaceRaw`): one memory store for the process
 */
export function sharedMemoryNodesetImageStore(): MemoryNodesetImageStore {
    sharedStore = sharedStore || new MemoryNodesetImageStore();
    return sharedStore;
}
