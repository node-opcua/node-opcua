/**
 * a fingerprint of an address space: node count, reference count, and a digest over every node's
 * id, browse name, class, reference count and (for variables) status code and value
 */
import { createHash } from "node:crypto";
import type { AddressSpace, UAVariable } from "../dist/api/index.js";

export interface AddressSpaceDigest {
    nodes: number;
    references: number;
    hash: string;
}

export function digestAddressSpace(addressSpace: AddressSpace): AddressSpaceDigest {
    const lines: string[] = [];
    let references = 0;
    for (const namespace of addressSpace.getNamespaceArray()) {
        for (const node of namespace.nodeIterator()) {
            const refs = node.allReferences();
            references += refs.length;
            let line = `${node.nodeId.toString()}|${node.browseName.toString()}|${node.nodeClass}|${refs.length}`;
            if ((node as UAVariable).readValue) {
                const dataValue = (node as UAVariable).readValue();
                // JSON, not toString(): the printers colour their output when a terminal is attached and
                // elide long arrays, so a text digest is neither complete nor the same on every machine
                line += `|${dataValue.statusCode.toString()}|${JSON.stringify(dataValue.value)}`;
            }
            lines.push(line);
        }
    }
    lines.sort();
    return { nodes: lines.length, references, hash: createHash("sha1").update(lines.join("\n")).digest("hex") };
}
