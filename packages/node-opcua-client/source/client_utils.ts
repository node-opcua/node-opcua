/**
 * @module node-opcua-client
 */

import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { BrowsePath, BrowsePathResult } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { ClientSession, ResponseCallback } from "./client_session";
import { ClientSessionImpl } from "./private/client_session_impl";

const hasPropertyRefId = resolveNodeId("HasProperty");

/* NodeId  ns=0;i=46*/

function browsePathPropertyRequest(nodeId: NodeIdLike, propertyName: string): BrowsePath {
    return new BrowsePath({
        relativePath: /* RelativePath   */ {
            elements: /* RelativePathElement */ [
                {
                    includeSubtypes: false,
                    isInverse: false,
                    referenceTypeId: hasPropertyRefId,
                    targetName: { namespaceIndex: 0, name: propertyName }
                }
            ]
        },
        startingNode: /* NodeId  */ nodeId
    });
}

interface AnalogDataItemSnapshot {
    engineeringUnits: Variant | null;
    engineeringUnitsRange: Variant | null;
    instrumentRange: Variant | null;
    valuePrecision: Variant | null;
    definition: Variant | null;
}

/**
 * @method readUAAnalogItem
 * @param session
 * @param nodeId
 * @param callback
 */
export function readUAAnalogItem(session: ClientSession, nodeId: NodeIdLike): Promise<AnalogDataItemSnapshot>;
export function readUAAnalogItem(
    session: ClientSession,
    nodeId: NodeIdLike,
    callback: ResponseCallback<AnalogDataItemSnapshot>
): void;
export function readUAAnalogItem(session: ClientSession, nodeId: NodeIdLike, ...args: [any?, ...any[]]): any {
    const callback = args[0] as ResponseCallback<AnalogDataItemSnapshot>;
    assert(typeof callback === "function");

    const browsePath = [
        browsePathPropertyRequest(nodeId, "EngineeringUnits"),
        browsePathPropertyRequest(nodeId, "EURange"),
        browsePathPropertyRequest(nodeId, "InstrumentRange"),
        browsePathPropertyRequest(nodeId, "ValuePrecision"),
        browsePathPropertyRequest(nodeId, "Definition")
    ];

    const analogItemData: AnalogDataItemSnapshot = {
        definition: null,
        engineeringUnits: null,
        engineeringUnitsRange: null,
        instrumentRange: null,
        valuePrecision: null
    };

    session.translateBrowsePath(browsePath, (err: Error | null, browsePathResults?: BrowsePathResult[]) => {
        if (err) {
            return callback(err);
        }
        browsePathResults = browsePathResults || [];

        const actions: any[] = [];
        const nodesToRead: ReadValueIdOptions[] = [];

        function processProperty(browsePathResult: BrowsePathResult, propertyName: string) {
            if (browsePathResult.statusCode === StatusCodes.Good) {
                browsePathResult.targets = browsePathResult.targets || [];
                nodesToRead.push({
                    attributeId: AttributeIds.Value,
                    nodeId: browsePathResult.targets[0].targetId
                });
                actions.push((readResult: DataValue) => ((analogItemData as any)[propertyName] = readResult.value.value));
            }
        }

        processProperty(browsePathResults[0], "engineeringUnits");
        processProperty(browsePathResults[1], "engineeringUnitsRange");
        processProperty(browsePathResults[2], "instrumentRange");
        processProperty(browsePathResults[3], "valuePrecision");
        processProperty(browsePathResults[4], "definition");

        session.read(nodesToRead, (err1: Error | null, dataValues?: DataValue[]) => {
            if (err1) {
                return callback(err1);
            }
            /* istanbul ignore next */
            if (!dataValues) {
                return callback(new Error("Internal Error"));
            }

            dataValues.forEach((result: DataValue, index: number) => {
                actions[index].call(null, result);
            });

            callback(err1, analogItemData);
        });
    });
}
// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };
(module as any).exports.readUAAnalogItem = thenify.withCallback((module as any).exports.readUAAnalogItem, opts);
