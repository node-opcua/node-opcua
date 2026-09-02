/**
 * @module node-opcua-address-space
 *
 * Hierarchical children exposed as JavaScript properties: `server.serverStatus.currentTime`,
 * `alarm.enabledState.id`, `dataType.enumStrings`.
 *
 * Every child used to be installed as an own accessor on its parent, one `Object.defineProperty`
 * per child, in a sweep at the end of every nodeset load and again each time a node was created.
 * That sweep was 12% of a load, gave every node its own hidden class, and let a child shadow an
 * attribute or a method of the same name (`eventNotifier`, `namespaceUri`).
 *
 * A name seen while a nodeset loads now gets ONE getter, on `BaseNodeImpl.prototype`, shared by
 * every node; the getter resolves the child at access time through the node's child index. Names
 * first seen at runtime never touch the prototype: adding a property to a prototype invalidates
 * the V8 inline caches of everything inheriting from it, which must not happen inside a loop that
 * creates a hundred thousand uniquely named variables. Those names keep the per-parent own
 * accessor installed by `install_extra_properties`, as before.
 *
 * This module knows nothing about nodes: the prototype to extend and the resolver are handed in,
 * so it takes part in no import cycle.
 */
import { lowerFirstLetter } from "node-opcua-utils";

/**
 * names that would break the node object itself if a child could claim them, on top of
 * whatever the prototype chain already defines (attributes, methods, EventEmitter members)
 */
const forbiddenNames = new Set(["then", "catch", "finally", "toJSON", "length", "prototype", "constructor", "__proto__"]);

/** accessor name (`enabledState`) -> browse names mapping to it (`EnabledState`), first seen first */
const browseNamesByAccessor = new Map<string, string[]>();

/** accessor names carried by a shared getter on the prototype */
const sharedAccessors = new Set<string>();

export type ChildAccessorResolver<Node> = (node: Node, accessorName: string) => unknown;

/**
 * the property name a child is exposed as: `EnabledState` -> `enabledState`, `EURange` -> `euRange`.
 * The mapping is not invertible, hence the registry kept by {@link registerChildName}.
 */
export function childAccessorName(browseName: string): string {
    return lowerFirstLetter(browseName);
}

export function hasSharedChildAccessor(accessorName: string): boolean {
    return sharedAccessors.has(accessorName);
}

/**
 * true for the names no child may claim on any node, shared getter or own accessor alike:
 * `then` would turn every node into a thenable, `__proto__` would corrupt it
 */
export function isReservedChildAccessorName(accessorName: string): boolean {
    return !accessorName || accessorName.startsWith("$") || forbiddenNames.has(accessorName);
}

/**
 * Record that a node named `browseName` exists, so that `resolveChildInIndex` can map the accessor
 * name back to it, and, when `defineShared` is set, make sure the prototype carries a getter for it.
 *
 * @returns true when this call defined a new getter
 */
export function registerChildName<Node extends object>(
    browseName: string | null | undefined,
    prototype: Node,
    resolve: ChildAccessorResolver<Node>,
    defineShared: boolean
): boolean {
    if (!browseName) {
        return false;
    }
    const accessorName = lowerFirstLetter(browseName);
    const known = browseNamesByAccessor.get(accessorName);
    if (!known) {
        browseNamesByAccessor.set(accessorName, [browseName]);
    } else if (!known.includes(browseName)) {
        known.push(browseName);
    }
    if (!defineShared || sharedAccessors.has(accessorName)) {
        return false;
    }
    // a child never shadows what the node already has: attributes, methods, fields, and
    // the names that would turn a node into a thenable or corrupt its prototype chain
    if (isReservedChildAccessorName(accessorName) || accessorName in prototype) {
        return false;
    }
    Object.defineProperty(prototype, accessorName, {
        configurable: true,
        enumerable: false,
        get(this: Node) {
            return resolve(this, accessorName);
        },
        // assigning to the name keeps its old meaning, an own property of that node, rather than
        // being swallowed by the prototype accessor (a stub built with Object.create relies on it)
        set(this: Node, value: unknown) {
            Object.defineProperty(this, accessorName, { value, writable: true, configurable: true, enumerable: true });
        }
    });
    sharedAccessors.add(accessorName);
    return true;
}

export interface IndexedChild {
    node?: unknown;
}

/**
 * The child that `parent.<accessorName>` designates, given the parent's child index
 * (browse name -> reference, or references when several children share a browse name) and
 * which references count: the index holds every hierarchical reference, while a dotted child
 * is one reached through a structural reference (a component, a property, a subtype, an
 * organized node), not through an event reference such as HasNotifier.
 *
 * When two children map to the same accessor name the first one indexed wins, which is what the
 * own-accessor installation did too.
 */
export function resolveChildInIndex<Child extends IndexedChild>(
    index: Map<string, Child | Child[]>,
    accessorName: string,
    accept: (reference: Child) => boolean
): Child["node"] | undefined {
    const browseNames = browseNamesByAccessor.get(accessorName);
    if (!browseNames) {
        return undefined;
    }
    for (const browseName of browseNames) {
        const entry = index.get(browseName);
        if (!entry) {
            continue;
        }
        const references = Array.isArray(entry) ? entry : [entry];
        for (const reference of references) {
            if (reference.node && accept(reference)) {
                return reference.node;
            }
        }
    }
    return undefined;
}
