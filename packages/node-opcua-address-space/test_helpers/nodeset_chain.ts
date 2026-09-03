/**
 * a nodeset with its dependencies, the standard nodeset first, in load order: what a test loads
 * to get a complete address space for one catalog entry
 */
import { nodesetCatalog } from "node-opcua-nodesets";

export function chainOf(name: string): string[] {
    const byName = new Map(nodesetCatalog.map((m) => [m.name as string, m]));
    const acc: string[] = [];
    const visit = (n: string) => {
        const meta = byName.get(n);
        if (!meta) throw new Error(`unknown nodeset ${n}`);
        for (const dep of meta.dependencies) visit(dep);
        if (!acc.includes(n)) acc.push(n);
    };
    visit(name);
    if (!acc.includes("standard")) acc.unshift("standard");
    return acc;
}
