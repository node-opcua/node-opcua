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

/**
 * accessor name -> the browse names mapping to it that cannot be derived back from it.
 * `enabledState` needs no entry (`EnabledState` is the accessor name capitalised, and a name that
 * is already lower case maps to itself); `euRange` does (`EURange`), and so does a name with an
 * underscore. Only the shared getters read this map, so it holds the names a nodeset declared
 * and the runtime names those getters resolve: a model with a hundred thousand runtime names
 * costs nothing here.
 */
const irregularBrowseNames = new Map<string, string[]>();

function upperFirstLetter(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

/** accessor names carried by a shared getter on the prototype */
const sharedAccessors = new Set<string>();

/**
 * accessor names waiting for their shared getter. Defining a property on a prototype invalidates
 * the inline caches of every object inheriting from it, so the getters of a nodeset are not
 * defined one at a time while its nodes are being created but in one batch once the load is done.
 */
const pendingSharedAccessors = new Set<string>();

export type ChildAccessorResolver<Node> = (node: Node, accessorName: string) => unknown;

/**
 * the property name a child is exposed as: `EnabledState` -> `enabledState`, `EURange` -> `euRange`.
 * The mapping is not invertible, hence the registry kept by {@link registerChildName}.
 */
export function childAccessorName(browseName: string): string {
    // lowerFirstLetter splits on underscores and lower-cases every part, several passes and a
    // join for a name it then returns unchanged; a name without an upper-case letter is its own
    // accessor name, and that is what a model built at runtime mostly carries (tag_0001)
    for (let i = 0; i < browseName.length; i++) {
        const code = browseName.charCodeAt(i);
        if (code >= 65 && code <= 90) {
            return lowerFirstLetter(browseName);
        }
    }
    return browseName;
}

export function hasSharedChildAccessor(accessorName: string): boolean {
    return sharedAccessors.has(accessorName);
}

/** the names no child may claim on any node, see {@link isReservedChildAccessorName} */
export function reservedChildAccessorNames(): readonly string[] {
    return [...forbiddenNames];
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
 * name back to it; with `requestShared`, also queue a shared getter for it, to be defined by the
 * next {@link defineSharedChildAccessors}.
 */
/**
 * browse name to accessor name, computed once for the names a nodeset declares: a nodeset repeats
 * a few hundred names over thousands of nodes. A name first seen at runtime is computed and not
 * remembered: it is seen once, and a server naming its nodes per job must leave no trace here.
 */
const accessorNameOf = new Map<string, string>();

export function registerChildName(browseName: string | null | undefined, requestShared: boolean): string | undefined {
    if (!browseName) {
        return undefined;
    }
    let accessorName = accessorNameOf.get(browseName);
    if (accessorName !== undefined) {
        return accessorName;
    }
    accessorName = childAccessorName(browseName);
    // a shared getter resolves the child by browse name through the index: it must know the
    // irregular spellings of the names it serves, whether a nodeset or the runtime brought them.
    // A runtime name with no shared getter is served by an own accessor that holds its child
    const shared = requestShared || sharedAccessors.has(accessorName);
    if (shared && browseName !== accessorName && browseName !== upperFirstLetter(accessorName)) {
        const known = irregularBrowseNames.get(accessorName);
        if (!known) {
            irregularBrowseNames.set(accessorName, [browseName]);
        } else if (!known.includes(browseName)) {
            known.push(browseName);
        }
    }
    if (requestShared) {
        accessorNameOf.set(browseName, accessorName);
        if (!sharedAccessors.has(accessorName)) {
            pendingSharedAccessors.add(accessorName);
        }
    }
    return accessorName;
}

/** how much the registries hold, for the tests that check they stay bounded by the nodeset vocabulary */
export function childAccessorRegistrySizes(): { accessorNames: number; irregularNames: number; shared: number; pending: number } {
    let irregularNames = 0;
    for (const names of irregularBrowseNames.values()) {
        irregularNames += names.length;
    }
    return {
        accessorNames: accessorNameOf.size,
        irregularNames,
        shared: sharedAccessors.size,
        pending: pendingSharedAccessors.size
    };
}

/**
 * Define the shared getter of every accessor name queued by {@link registerChildName}.
 *
 * @returns the number of getters defined
 */
export function defineSharedChildAccessors<Node extends object>(prototype: Node, resolve: ChildAccessorResolver<Node>): number {
    let defined = 0;
    for (const accessorName of pendingSharedAccessors) {
        if (defineSharedChildAccessor(prototype, resolve, accessorName)) {
            defined += 1;
        }
    }
    pendingSharedAccessors.clear();
    return defined;
}

function defineSharedChildAccessor<Node extends object>(
    prototype: Node,
    resolve: ChildAccessorResolver<Node>,
    accessorName: string
): boolean {
    if (sharedAccessors.has(accessorName)) {
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
 * The capitalised name is tried first, then the accessor name itself, then the irregular
 * browse names on record; among children sharing a browse name the first one indexed wins,
 * which is what the own-accessor installation did too.
 */
export function resolveChildInIndex<Child extends IndexedChild>(
    index: Map<string, Child | Child[]>,
    accessorName: string,
    accept: (reference: Child) => boolean
): Child["node"] | undefined {
    const lookup = (browseName: string): Child["node"] | undefined => {
        const entry = index.get(browseName);
        if (!entry) {
            return undefined;
        }
        const references = Array.isArray(entry) ? entry : [entry];
        for (const reference of references) {
            if (reference.node && accept(reference)) {
                return reference.node;
            }
        }
        return undefined;
    };
    const capitalised = upperFirstLetter(accessorName);
    const found = lookup(capitalised) ?? (capitalised === accessorName ? undefined : lookup(accessorName));
    if (found) {
        return found;
    }
    const irregular = irregularBrowseNames.get(accessorName);
    if (irregular) {
        for (const browseName of irregular) {
            const node = lookup(browseName);
            if (node) {
                return node;
            }
        }
    }
    return undefined;
}
