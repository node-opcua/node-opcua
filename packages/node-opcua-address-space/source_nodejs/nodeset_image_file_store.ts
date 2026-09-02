import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { make_debugLog } from "node-opcua-debug";
import type { NodesetImageStore } from "../dist/api/index.js";

const debugLog = make_debugLog("nodeset_image_file_store");

export interface FileNodesetImageStoreOptions {
    /**
     * the directory; defaults to `NODE_OPCUA_NODESET_IMAGE_DIR`, then
     * `$XDG_CACHE_HOME/node-opcua/nodeset-images`, then `~/.cache/node-opcua/nodeset-images`
     */
    directory?: string;
    /** the size the store stays under, oldest images dropped first @default 256 MiB */
    maxBytes?: number;
}

/** the default directory: per user, never the shared temp root, since a server trusts what it reads here */
export function defaultNodesetImageDirectory(): string {
    if (process.env.NODE_OPCUA_NODESET_IMAGE_DIR) {
        return process.env.NODE_OPCUA_NODESET_IMAGE_DIR;
    }
    const cache = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
    return path.join(cache, "node-opcua", "nodeset-images");
}

const IMAGE_EXTENSION = ".ndjson.gz";

/**
 * the images in a directory of the user's, one file per key, written atomically; a corrupt or
 * foreign file is the loader's to detect and this store's to replace; the store stays under a
 * size by dropping the least recently written images
 */
export class FileNodesetImageStore implements NodesetImageStore {
    public readonly directory: string;
    private readonly maxBytes: number;

    constructor(options: FileNodesetImageStoreOptions = {}) {
        this.directory = options.directory ?? defaultNodesetImageDirectory();
        this.maxBytes = options.maxBytes ?? 256 * 1024 * 1024;
    }

    private fileOf(key: string): string {
        if (!/^[A-Za-z0-9._-]+$/.test(key)) {
            throw new Error(`FileNodesetImageStore: not a key: ${key}`);
        }
        return path.join(this.directory, key + IMAGE_EXTENSION);
    }

    public async get(key: string): Promise<Uint8Array | undefined> {
        const file = this.fileOf(key);
        let stat: fs.Stats;
        try {
            stat = await fs.promises.stat(file);
        } catch {
            return undefined;
        }
        if (!stat.isFile()) {
            return undefined;
        }
        // on POSIX an image another user could have written is not one to trust
        if (process.platform !== "win32" && (stat.mode & 0o022) !== 0) {
            debugLog("ignoring an image writable by others:", file);
            return undefined;
        }
        try {
            const bytes = await fs.promises.readFile(file);
            return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        } catch (err) {
            debugLog("cannot read", file, (err as Error).message);
            return undefined;
        }
    }

    public async put(key: string, image: Uint8Array): Promise<void> {
        const file = this.fileOf(key);
        await fs.promises.mkdir(this.directory, { recursive: true, mode: 0o700 });
        const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
        await fs.promises.writeFile(temp, image, { mode: 0o600 });
        await fs.promises.rename(temp, file);
        await this.evict(file);
    }

    /** drop the oldest images until the directory fits, never the one just written */
    private async evict(keep: string): Promise<void> {
        const names = (await fs.promises.readdir(this.directory)).filter((n) => n.endsWith(IMAGE_EXTENSION));
        const entries: Array<{ file: string; size: number; mtime: number }> = [];
        for (const name of names) {
            const file = path.join(this.directory, name);
            try {
                const stat = await fs.promises.stat(file);
                entries.push({ file, size: stat.size, mtime: stat.mtimeMs });
            } catch {
                /* gone meanwhile */
            }
        }
        let total = entries.reduce((n, e) => n + e.size, 0);
        entries.sort((a, b) => a.mtime - b.mtime);
        for (const entry of entries) {
            if (total <= this.maxBytes) {
                break;
            }
            if (entry.file === keep) {
                continue;
            }
            try {
                await fs.promises.unlink(entry.file);
                total -= entry.size;
                debugLog("evicted", entry.file);
            } catch {
                /* gone meanwhile */
            }
        }
    }

    /** the keys the directory holds */
    public async keys(): Promise<string[]> {
        try {
            return (await fs.promises.readdir(this.directory))
                .filter((n) => n.endsWith(IMAGE_EXTENSION))
                .map((n) => n.slice(0, -IMAGE_EXTENSION.length));
        } catch {
            return [];
        }
    }
}
