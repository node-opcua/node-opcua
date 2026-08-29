import {
    assert,
    type BrowseResult,
    make_warningLog,
    type NodeId,
    QualifiedName,
    type ReferenceDescription
} from "node-opcua-client";
import type { CacheNode } from "./cache_node.js";
import type { Pojo, UserData } from "./node_crawler_base.js";

const warningLog = make_warningLog("CRAWLER");

export type EmptyCallback = () => void;

export const pendingBrowseName = new QualifiedName({ name: "pending" });

export function dedup_reference(parentNode: CacheNode, references: ReferenceDescription[]): ReferenceDescription[] {
    const results: ReferenceDescription[] = [];
    const dedup: Record<string, ReferenceDescription> = {};
    const duplicatedReferences: ReferenceDescription[] = [];

    for (const reference of references) {
        const key = reference.referenceTypeId.toString() + reference.nodeId.toString();

        /* c8 ignore next */
        if (dedup[key]) {
            duplicatedReferences.push(reference);
            continue;
        }
        dedup[key] = reference;
        results.push(reference);
    }
    if (duplicatedReferences.length > 0) {
        warningLog(
            `Warning => Duplicated references found while browsing ${parentNode.browseName.toString()}  nodeId= ${parentNode.nodeId.toString()}`
        );
        for (const reference of duplicatedReferences) {
            warningLog("   ", reference.toString());
        }
    }
    return results;
}

export interface TaskBase {
    name?: string;
    func(task: unknown, callback: EmptyCallback): void;
}

export interface TaskBrowseNode {
    action: (object: CacheNode) => void;
    cacheNode: CacheNode;
    nodeId: NodeId;
    referenceTypeId: NodeId;
}

export interface TaskBrowseNext extends TaskBrowseNode {
    continuationPoint: Buffer;
}

export interface TaskCrawl extends TaskBase {
    param: {
        cacheNode: CacheNode;
        userData: UserData;
    };
    func: (task: TaskCrawl, callback: EmptyCallback) => void;
}

export interface Task2 extends TaskBase {
    param: {
        childCacheNode?: CacheNode;
        parentNode?: CacheNode;
        reference?: ReferenceDescription;
    };
    func: (task: Task2, callback: EmptyCallback) => void;
}

export interface TaskProcessBrowseResponse extends TaskBase {
    param: {
        objectsToBrowse: TaskBrowseNode[];
        browseResults: BrowseResult[];
    };
    func: (task: TaskProcessBrowseResponse, callback: EmptyCallback) => void;
}

export interface TaskExtraReference extends TaskBase {
    param: {
        childCacheNode: CacheNode;
        parentNode: CacheNode;
        reference: ReferenceDescription;
        userData: UserData;
    };
    func: (task: TaskExtraReference, callback: EmptyCallback) => void;
}

export interface TaskReconstruction extends TaskBase {
    data: CacheNode;
    func: (task: TaskReconstruction, callback: EmptyCallback) => void;
}

export type Task = TaskCrawl | Task2 | TaskProcessBrowseResponse | TaskExtraReference;

export function removeCycle(object: Pojo, innerCallback: (err: Error | null, object?: Pojo) => void): void {
    const visitedNodeIds: Record<string, Pojo> = {};

    function hasBeenVisited(e: Pojo) {
        const key1 = (e.nodeId as { toString(): string }).toString();
        return visitedNodeIds[key1];
    }

    function setVisited(e: Pojo) {
        const key1 = (e.nodeId as { toString(): string }).toString();
        visitedNodeIds[key1] = e;
        return e;
    }

    function mark_array(arr: Pojo[] | undefined) {
        if (!arr) {
            return;
        }
        assert(Array.isArray(arr));

        for (const e of arr) {
            if (hasBeenVisited(e)) {
                return;
            } else {
                setVisited(e);
                explorerObject(e);
            }
        }
    }

    function explorerObject(obj: Pojo) {
        mark_array(obj.organizes as Pojo[] | undefined);
        mark_array(obj.hasComponent as Pojo[] | undefined);
        mark_array(obj.hasNotifier as Pojo[] | undefined);
        mark_array(obj.hasProperty as Pojo[] | undefined);
    }

    explorerObject(object);
    innerCallback(null, object);
}
