import type { NodeClass } from "node-opcua-data-model";
import { lowerFirstLetter } from "node-opcua-utils";
import wrap from "wordwrap";

const wrapText = wrap(0, 50);

export function toComment(prefix: string, description: string) {
    const d = wrapText(description);
    return d
        .split("\n")
        .map((x) => prefix + x)
        .join("\n");
}

/**
 * the names under which the runtime never exposes a child of a node of the given class, by the
 * rule node-opcua-address-space applies (`childAccessorNamesShadowedBy`); registered by main()
 * once the address space is loaded, absent in a unit test
 */
export type ChildAccessorShadowing = (parentNodeClass: NodeClass) => ReadonlySet<string> | undefined;

let childAccessorShadowing: ChildAccessorShadowing | undefined;

export function setChildAccessorShadowing(provider: ChildAccessorShadowing | undefined): void {
    childAccessorShadowing = provider;
}

/**
 * the names the generated interfaces have always escaped: kept whatever the runtime rule says, so
 * that an interface published under one of them does not change under its users
 */
const historicallyEscaped = new Set([
    "namespaceUri",
    "rolePermissions",
    "displayName",
    "eventNotifier",
    "description",
    "decode",
    "encode"
]);

/**
 * the TypeScript property name of a child: its browse name lower-cased the way the runtime does,
 * and `$`-prefixed when the runtime could not expose it under that name on a node of
 * `parentNodeClass` (a child named NamespaceUri, DataType on a variable, Then on anything)
 */
export function toJavascritPropertyName(
    childName: string,
    { ignoreConflictingName, parentNodeClass }: { ignoreConflictingName: boolean; parentNodeClass?: NodeClass }
): string {
    childName = lowerFirstLetter(childName);

    if (ignoreConflictingName) {
        const shadowed = parentNodeClass === undefined ? undefined : childAccessorShadowing?.(parentNodeClass);
        if (historicallyEscaped.has(childName) || shadowed?.has(childName)) {
            childName = `$${childName}`;
        }
    }
    return childName.replace(/</g, "$").replace(/>/g, "$").replace(/ |\./g, "_").replace(/#/g, "_");
}

export function quotifyIfNecessary(s: string): string {
    if (s.match(/(^[^a-zA-Z])|([^a-zA-Z_0-9])/)) {
        return `"${s}"`;
    }
    if (s === "nodeClass") {
        return `["$nodeClass"]`;
    }
    return s;
}

export const f2 = (str: string) => str.padEnd(60, "-");
export const f1 = (str: string) => str.padEnd(60, " ");
