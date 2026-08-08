/**
 * @module node-opcua-alias-name-server
 *
 * `LastChange` (OPC 10000-17 clause 6.3.1).
 *
 * A `VersionTime` — **a UInt32 count of seconds since 2000-01-01T00:00:00Z, not
 * a DateTime**. Every other "last changed" Property in the SDK is a DateTime and
 * the name gives no hint, which is what makes this the easiest thing here to get
 * wrong.
 *
 * Clause 6.3.1 lists three things that move it:
 *
 * - an AliasName was added to or deleted from the category,
 * - an AliasNameCategory was added or deleted,
 * - the referenced Nodes of an AliasName in the category changed.
 *
 * and one rule that makes it a tree rather than a set of independent counters:
 * *"For AliasNameCategoryType instances that are nested, the value of LastChange
 * shall always be the latest VersionTime of all Organized AliasNames and
 * AliasNameCategories."* So a change deep in the hierarchy moves every ancestor
 * up to the root.
 *
 * ## One second of resolution
 *
 * Two changes inside the same second are indistinguishable — the value simply
 * does not move. A Client must therefore treat an **equal** `LastChange` as
 * "re-browse to be sure" rather than "nothing changed"; only a value *older*
 * than the cached one carries the strong meaning clause 6.3.1 gives it, namely
 * clear the cache. This is a property of `VersionTime`, not of this
 * implementation, and there is nothing a Server can do about it.
 */

import type { BaseNode, IAddressSpace, UAObject, UAVariable } from "node-opcua-address-space-base";
import { maxVersionTime, nowVersionTime } from "node-opcua-alias-name-common";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import {
    ALIAS_NAME_ARCHIVE_VERSION,
    type AliasNameArchive,
    readAliasNameArchive,
    writeAliasNameArchive
} from "./alias_name_archive.js";
import { WellKnownCategories } from "./well_known.js";

/** BrowseName of the Property, per clause 6.3.1 Table 2. */
export const LAST_CHANGE_BROWSE_NAME = "LastChange";

export interface LastChangeTrackerOptions {
    /** File backing the persisted values. Omit to keep them in memory only. */
    persistencePath?: string;
    /**
     * Supplies "now" as a VersionTime. Injectable so a test can pin it; a
     * one-second resolution is otherwise painful to assert against.
     */
    now?: () => number;
}

/**
 * Keeps every category's `LastChange` Property correct, including the rollup to
 * ancestors, and persists the values across restart.
 */
export class LastChangeTracker {
    private readonly addressSpace: IAddressSpace;
    private readonly persistencePath?: string;
    private readonly now: () => number;
    /** Category NodeId string to VersionTime. */
    private readonly values = new Map<string, number>();
    /** Serialises saves so two rapid changes cannot interleave their writes. */
    private savingChain: Promise<void> = Promise.resolve();

    constructor(addressSpace: IAddressSpace, options?: LastChangeTrackerOptions) {
        this.addressSpace = addressSpace;
        this.persistencePath = options?.persistencePath;
        this.now = options?.now ?? nowVersionTime;
    }

    /** The `VersionTime` currently recorded for a category. */
    public get(categoryNodeId: NodeId): number {
        return this.values.get(categoryNodeId.toString()) ?? 0;
    }

    /**
     * Record that a category changed, and roll the change up to every ancestor.
     *
     * Ancestors are walked at write time rather than computed at read time, so
     * the Property a Client subscribes to actually carries the value — a
     * rollup that existed only inside the Server would be invisible on the
     * wire, which is the whole point of the Property.
     */
    public async touch(categoryNodeId: NodeId, versionTime?: number): Promise<number> {
        const value = versionTime ?? this.now();
        for (const nodeId of this.selfAndAncestors(categoryNodeId)) {
            const key = nodeId.toString();
            this.values.set(key, maxVersionTime(this.values.get(key) ?? 0, value));
            this.writeProperty(nodeId);
        }
        await this.save();
        return value;
    }

    /** Restore persisted values and publish them to the address space. */
    public async restore(): Promise<void> {
        if (this.persistencePath) {
            const archive = await readAliasNameArchive(this.persistencePath);
            if (archive) {
                for (const [key, value] of Object.entries(archive.lastChange)) {
                    this.values.set(key, value);
                }
            }
        }
        for (const key of this.values.keys()) {
            const node = this.addressSpace.findNode(key);
            if (node) {
                this.writeProperty(node.nodeId);
            }
        }
    }

    /** Publish the current value of every known category, including zeros. */
    public publishAll(categoryNodeIds: NodeId[]): void {
        for (const nodeId of categoryNodeIds) {
            this.writeProperty(nodeId);
        }
    }

    /** Snapshot for persistence or inspection. */
    public snapshot(): Record<string, number> {
        return Object.fromEntries(this.values.entries());
    }

    /** Persist, if a path was given. Saves are serialised, never concurrent. */
    public async save(): Promise<void> {
        if (!this.persistencePath) {
            return;
        }
        const path = this.persistencePath;
        const archive: AliasNameArchive = { version: ALIAS_NAME_ARCHIVE_VERSION, lastChange: this.snapshot() };
        this.savingChain = this.savingChain.then(() => writeAliasNameArchive(path, archive));
        await this.savingChain;
    }

    /** Write the value onto the category's `LastChange` Property, if it has one. */
    private writeProperty(categoryNodeId: NodeId): void {
        const node = this.addressSpace.findNode(categoryNodeId);
        if (!node || node.nodeClass !== NodeClass.Object) {
            return;
        }
        const property = (node as UAObject).getPropertyByName(LAST_CHANGE_BROWSE_NAME);
        if (!property) {
            // LastChange is Optional on AliasNameCategoryType; a category
            // without one simply does not publish its version
            return;
        }
        // VersionTime (i=20998) is a UInt32 subtype - not a DateTime
        (property as UAVariable).setValueFromSource({
            dataType: DataType.UInt32,
            value: this.values.get(categoryNodeId.toString()) ?? 0
        });
    }

    /**
     * The category itself, then every `AliasNameCategoryType` ancestor up to and
     * including the `Aliases` root.
     *
     * Cycle-safe: an address space that nests categories in a loop would
     * otherwise hang the Method call that triggered the change.
     */
    private selfAndAncestors(categoryNodeId: NodeId): NodeId[] {
        const result: NodeId[] = [];
        const seen = new Set<string>();

        const visit = (nodeId: NodeId): void => {
            const key = nodeId.toString();
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            result.push(nodeId);

            const node = this.addressSpace.findNode(nodeId);
            if (!node) {
                return;
            }
            for (const parent of (node as BaseNode).findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Inverse)) {
                if (parent.nodeClass === NodeClass.Object) {
                    visit(parent.nodeId);
                }
            }
        };

        visit(categoryNodeId);
        // the root is always included even when the category was reached by a
        // path that does not pass through it
        const rootKey = WellKnownCategories.Aliases.toString();
        if (!seen.has(rootKey) && this.addressSpace.findNode(WellKnownCategories.Aliases)) {
            result.push(WellKnownCategories.Aliases);
        }
        return result;
    }
}
