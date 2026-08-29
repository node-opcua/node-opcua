import type { Namespace } from "../source/namespace.js";
import type { NodeEntry1, NodeIdManager } from "./nodeid_manager.js";

interface NamespaceWithNodeIdManager extends Namespace {
    _nodeIdManager: NodeIdManager;
    registerSymbolicNames: boolean;
}

export function getNodeIdManager(ns: Namespace): NodeIdManager {
    const nodeIdManager = (ns as NamespaceWithNodeIdManager)._nodeIdManager;
    return nodeIdManager;
}
export function setSymbols(ns: Namespace, symbols: NodeEntry1[]) {
    const nodeIdManager = getNodeIdManager(ns);
    (ns as NamespaceWithNodeIdManager).registerSymbolicNames = true;
    nodeIdManager.setSymbols(symbols);
}
export function getSymbols(ns: Namespace): NodeEntry1[] {
    const nodeIdManager = getNodeIdManager(ns);
    return nodeIdManager?.getSymbols() || [];
}
