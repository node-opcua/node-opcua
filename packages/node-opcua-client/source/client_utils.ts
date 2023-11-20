/**
 * @module node-opcua-client
 */

import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { BrowsePath, BrowsePathResult } from "node-opcua-service-translate-browse-path";
import { Variant } from "node-opcua-variant";
import { IBasicSessionReadAsyncMultiple, IBasicSessionTranslateBrowsePathAsyncMultiple } from "node-opcua-pseudo-session";

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
export async function readUAAnalogItem(
    session: IBasicSessionTranslateBrowsePathAsyncMultiple & IBasicSessionReadAsyncMultiple,
    nodeId: NodeIdLike
): Promise<AnalogDataItemSnapshot> {
    const browsePaths = [
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

    const browsePathResults = await session.translateBrowsePath(browsePaths);

    const actions: ((readResult: DataValue) => void)[] = [];
    const nodesToRead: ReadValueIdOptions[] = [];

    function processProperty(browsePathResult: BrowsePathResult, propertyName: string) {
        if (browsePathResult.statusCode.isGood()) {
            browsePathResult.targets = browsePathResult.targets || [];
            nodesToRead.push({
                attributeId: AttributeIds.Value,
                nodeId: browsePathResult.targets[0].targetId
            });
            actions.push(
                (readResult: DataValue) =>
                    ((analogItemData as unknown as Record<string, unknown>)[propertyName] = readResult.value.value)
            );
        }
    }

    processProperty(browsePathResults[0], "engineeringUnits");
    processProperty(browsePathResults[1], "engineeringUnitsRange");
    processProperty(browsePathResults[2], "instrumentRange");
    processProperty(browsePathResults[3], "valuePrecision");
    processProperty(browsePathResults[4], "definition");

    const dataValues = await session.read(nodesToRead);

    dataValues.forEach((result: DataValue, index: number) => {
        actions[index].call(null, result);
    });
    return analogItemData;
}
