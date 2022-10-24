import { assert } from "node-opcua-assert";
import { QualifiedName, ReferenceDescription, BrowseResult, NodeId } from "node-opcua-client";
import { make_warningLog } from "node-opcua-debug";
import { CacheNode } from "./cache_node";
import { Pojo, UserData } from "./node_crawler_base";

const warningLog = make_warningLog("CRAWLER");

export type EmptyCallback = () => void;

export const pendingBrowseName = new QualifiedName({ name: "pending" });

export function dedup_reference(parentNode: CacheNode, references: ReferenceDescription[]): ReferenceDescription[] {
    const results: ReferenceDescription[] = [];
    const dedup: any = {};
    const duplicatedReferences: ReferenceDescription[] =[];

    for (const reference of references) {
        const key = reference.referenceTypeId.toString() + reference.nodeId.toString();

        /* istanbul ignore next */
        if (dedup[key]) {
            duplicatedReferences.push(reference);
            continue;
        }
        dedup[key] = reference;
        results.push(reference);
    }
    if (duplicatedReferences.length > 0) {
        warningLog(`Warning => Duplicated references found while browsing ${parentNode.browseName.toString()}  nodeId= ${parentNode.nodeId.toString()}`);
        for (const reference of duplicatedReferences) {
            warningLog("   " ,reference.toString());
        }
    }
    return results;
}

export interface TaskBase {
    name?: string;
    func: (task: any, callback: EmptyCallback) => void;
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
        childCacheNode?: any;
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
        reference: any;
        userData: UserData;
    };
    func: (task: TaskExtraReference, callback: EmptyCallback) => void;
}

export interface TaskReconstruction extends TaskBase {
    data: CacheNode;
    func: (task: TaskReconstruction, callback: EmptyCallback) => void;
}

export type Task = TaskCrawl | Task2 | TaskProcessBrowseResponse | TaskExtraReference;

export function removeCycle(object: Pojo, innerCallback: (err: Error | null, object?: any) => void): void {
    const visitedNodeIds: any = {};

    function hasBeenVisited(e: any) {
        const key1 = e.nodeId.toString();
        return visitedNodeIds[key1];
    }

    function setVisited(e: any) {
        const key1 = e.nodeId.toString();
        return (visitedNodeIds[key1] = e);
    }

    function mark_array(arr: any[]) {
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

    function explorerObject(obj: any) {
        mark_array(obj.organizes);
        mark_array(obj.hasComponent);
        mark_array(obj.hasNotifier);
        mark_array(obj.hasProperty);
    }

    explorerObject(object);
    innerCallback(null, object);
}
