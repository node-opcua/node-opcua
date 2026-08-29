import assert from "node-opcua-assert";
import { attributeNameById } from "node-opcua-basic-types";
import type { DataValue } from "node-opcua-data-value";
import { type NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { ReadValueIdOptions } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import type { Variant } from "node-opcua-variant";
import type { IBasicSessionAsyncMultiple } from "./basic_session_interface.js";

export interface NodeAttributes {
    nodeId: NodeId;
    statusCode: StatusCode;

    [key: string]: Variant | NodeId | StatusCode;
}

const attributeNames: string[] = ((): string[] => {
    const r: string[] = [];
    for (let i = 1; i <= 22; i++) {
        r.push(attributeNameById[i].toString());
    }
    return r;
})();

function composeResult(nodes: NodeIdLike[], nodesToRead: ReadValueIdOptions[], dataValues: DataValue[]): NodeAttributes[] {
    assert(nodesToRead.length === dataValues.length);
    let c = 0;
    const results = [];

    for (const node of nodes) {
        const data: NodeAttributes = {
            nodeId: resolveNodeId(node),
            statusCode: StatusCodes.BadNodeIdUnknown
        };

        let addedProperty = 0;

        for (const key of attributeNames) {
            const dataValue = dataValues[c];
            const _nodeToRead = nodesToRead[c];
            c++;
            if (dataValue.statusCode.equals(StatusCodes.Good)) {
                const k = lowerFirstLetter(key);
                data[k] = dataValue.value ? dataValue.value.value : null;
                addedProperty += 1;
            }
        }

        /* c8 ignore next */
        if (addedProperty > 0) {
            data.statusCode = StatusCodes.Good;
        } else {
            data.statusCode = StatusCodes.BadNodeIdUnknown;
        }
        results.push(data);
    }

    return results;
}

export async function readAllAttributes(session: IBasicSessionAsyncMultiple, nodeId: NodeIdLike): Promise<NodeAttributes>;
export async function readAllAttributes(session: IBasicSessionAsyncMultiple, nodeId: NodeIdLike[]): Promise<NodeAttributes[]>;
export async function readAllAttributes(
    session: IBasicSessionAsyncMultiple,
    arg1: NodeIdLike[] | NodeIdLike
): Promise<NodeAttributes[] | NodeAttributes> {
    const isArray = Array.isArray(arg1);
    const nodes = isArray ? arg1 : [arg1];
    if (!isArray) {
        return (await readAllAttributes(session, nodes))[0];
    }
    const nodesToRead: ReadValueIdOptions[] = [];

    for (const node of nodes) {
        const nodeId = resolveNodeId(node);

        /* c8 ignore next */
        if (!nodeId) {
            throw new Error(`cannot coerce ${node} to a valid NodeId`);
        }

        for (let attributeId = 1; attributeId <= 22; attributeId++) {
            nodesToRead.push({
                attributeId,
                dataEncoding: undefined,
                indexRange: undefined,
                nodeId
            });
        }
    }
    const dataValues = await session.read(nodesToRead);
    const results = composeResult(nodes, nodesToRead, dataValues);
    return results;
}
