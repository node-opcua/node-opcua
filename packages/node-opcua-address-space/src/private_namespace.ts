

import { Namespace } from "../source/namespace";
import { NamespacePrivate } from "./namespace_private";
import { NodeEntry1, NodeIdManager } from "./nodeid_manager";

export function getNodeIdManager(ns: Namespace): NodeIdManager {
    const nodeIdManager = (ns as any)._nodeIdManager as NodeIdManager;
    return nodeIdManager;
}
export function setSymbols(ns: Namespace, symbols: NodeEntry1[]) {
    const nodeIdManager = getNodeIdManager(ns);
    (ns as any).registerSymbolicNames = true;
    nodeIdManager.setSymbols(symbols);
}
export function getSymbols(ns: Namespace): NodeEntry1[] {
    const nodeIdManager = getNodeIdManager(ns);
    return nodeIdManager?.getSymbols() || [];
}