/**
 * @module node-opcua-role-set-common
 *
 * Binary persistence for identity-to-role mappings.
 *
 * File format (all OPC UA binary encoding):
 *   UInt32                          — number of roles
 *   For each role:
 *     NodeId                        — role NodeId
 *     Variant(ExtensionObject[])    — identity mapping rules as Variant array
 */
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { decodeNodeId, decodeUInt32, encodeNodeId, encodeUInt32 } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import type { NodeId } from "node-opcua-nodeid";
import { IdentityMappingRuleType } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import type { IIdentityMappingStore } from "./identity_mapping_store.js";

/**
 * Build a Variant wrapping an array of IdentityMappingRuleType for a role.
 */
function makeRulesVariant(rules: IdentityMappingRuleType[]): Variant {
    return new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: rules
    });
}

/**
 * Calculate the exact binary size of the encoded store.
 */
export function identityStoreBinaryStoreSize(store: IIdentityMappingStore): number {
    const sizeCalculator = new BinaryStreamSizeCalculator();
    encodeIdentityStore(store, sizeCalculator);
    return sizeCalculator.length;
}

/**
 * Encode the full store content into a binary stream.
 */
export function encodeIdentityStore(store: IIdentityMappingStore, stream: BinaryStream | BinaryStreamSizeCalculator): void {
    const roleIds = store.getRoleIds();
    encodeUInt32(roleIds.length, stream);
    for (const roleId of roleIds) {
        encodeNodeId(roleId, stream);
        const rules = store.getIdentitiesForRole(roleId);
        const variant = makeRulesVariant(rules);
        variant.encode(stream);
    }
}

/**
 * Decode the full store content from a binary stream.
 * Existing store content is **not** cleared — decoded entries are merged.
 */
export function decodeIdentityStore(store: IIdentityMappingStore, stream: BinaryStream): void {
    const roleCount = decodeUInt32(stream);
    for (let i = 0; i < roleCount; i++) {
        const roleId: NodeId = decodeNodeId(stream);
        const variant = new Variant();
        variant.decode(stream);
        if (variant.arrayType === VariantArrayType.Array && Array.isArray(variant.value)) {
            for (const rule of variant.value) {
                if (rule instanceof IdentityMappingRuleType) {
                    store.addIdentity(roleId, rule);
                }
            }
        }
    }
}

/**
 * Save identity store to a binary file.
 *
 * Uses {@link BinaryStreamSizeCalculator} for exact buffer sizing.
 * Creates the directory if it doesn't exist.
 */
export async function saveToBinaryFile(store: IIdentityMappingStore, filePath: string): Promise<void> {
    const size = identityStoreBinaryStoreSize(store);
    const stream = new BinaryStream(Buffer.alloc(size));
    encodeIdentityStore(store, stream);

    const buffer = (stream.buffer as Buffer).subarray(0, stream.length);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
}

/**
 * Load identity store from a binary file.
 *
 * If the file does not exist, the store is left unchanged (no error). A
 * corrupt/truncated file is reported as a clear `Error` (naming the path)
 * rather than a cryptic decoding failure, so the operator can react instead
 * of the Server silently losing the role configuration.
 */
export async function loadFromBinaryFile(store: IIdentityMappingStore, filePath: string): Promise<void> {
    let buffer: Buffer;
    try {
        buffer = await fs.readFile(filePath);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return; // missing file → no-op
        }
        throw err;
    }
    if (buffer.length === 0) {
        return; // empty file → no-op
    }
    const stream = new BinaryStream(buffer);
    try {
        decodeIdentityStore(store, stream);
    } catch (err) {
        throw new Error(`loadFromBinaryFile: '${filePath}' appears to be corrupt or truncated: ${(err as Error).message}`);
    }
}
