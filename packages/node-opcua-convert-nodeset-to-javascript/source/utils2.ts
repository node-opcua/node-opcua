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

// to avoid clashes
export function toJavascritPropertyName(childName: string, { ignoreConflictingName }: { ignoreConflictingName: boolean }): string {
    childName = lowerFirstLetter(childName);

    if (ignoreConflictingName) {
        if (childName === "namespaceUri") {
            childName = "$namespaceUri";
        }
        if (childName === "rolePermissions") {
            childName = "$rolePermissions";
        }
        if (childName === "displayName") {
            childName = "$displayName";
        }
        if (childName === "eventNotifier") {
            childName = "$eventNotifier";
        }
        if (childName === "description") {
            childName = "$description";
        }
        if (childName === "decode") {
            childName = "$decode";
        }
        if (childName === "encode") {
            childName = "$encode";
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
