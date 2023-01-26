/**
 * @module node-opcua-pseudo-session
 */
import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-basic-types";
import { VariableIds } from "node-opcua-constants";
import { make_warningLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import { BrowseDescriptionOptions, BrowseResult, ReferenceDescription } from "node-opcua-service-browse";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { IBasicSession, BrowseDescriptionLike } from "./basic_session_interface";

const warningLog = make_warningLog(__filename);

async function readLimits(session: IBasicSession) {
    const dataValues = await session.read([
        { nodeId: VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints, attributeId: AttributeIds.Value },
        { nodeId: VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse, attributeId: AttributeIds.Value }
    ]);
    const maxBrowseContinuationPoints = (dataValues[0].value.value as number) || 10;
    const maxNodesPerBrowse = (dataValues[1].value.value as number) || 10;
    return { maxBrowseContinuationPoints, maxNodesPerBrowse };
}

function coerceToBrowseDescription(nodeToBrowse: BrowseDescriptionLike): BrowseDescriptionOptions {
    if (typeof nodeToBrowse === "string") {
        return <BrowseDescriptionOptions>{
            nodeId: resolveNodeId(nodeToBrowse)
        };
    } else {
        return nodeToBrowse as BrowseDescriptionOptions;
    }
}
export async function browseAll(session: IBasicSession, nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;
export async function browseAll(session: IBasicSession, nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
export async function browseAll(
    session: IBasicSession,
    nodesToBrowse: BrowseDescriptionLike[] | BrowseDescriptionLike
): Promise<BrowseResult | BrowseResult[]> {
    if (!(nodesToBrowse instanceof Array)) {
        return (await browseAll(session, [nodesToBrowse]))[0];
    }
    const { maxBrowseContinuationPoints, maxNodesPerBrowse } = await readLimits(session);
    const maxNodesToBrowse = Math.min(maxNodesPerBrowse, maxBrowseContinuationPoints);
    const tmp = nodesToBrowse.map(coerceToBrowseDescription);
    let nodesToBrowse1 = tmp.splice(0, maxNodesToBrowse);
    let browseResults: BrowseResult[] = [];
    while (nodesToBrowse1.length) {
        const partialBrowseResult = await browseAll2(session, nodesToBrowse1);
        browseResults = [...browseResults, ...partialBrowseResult];
        nodesToBrowse1 = tmp.splice(0, maxNodesToBrowse);
    }
    assert(browseResults.length === nodesToBrowse.length, "browseResults must have same length as nodesToBrowse");
    return browseResults;
}

export async function browseAll2(session: IBasicSession, nodesToBrowse: BrowseDescriptionOptions[]): Promise<BrowseResult[]> {
    if (nodesToBrowse.length === 0) {
        return [];
    }
    const browseResults = await session.browse(nodesToBrowse);

    const browseToRedo = [];
    const browseToContinue: { references: ReferenceDescription[]; continuationPoint: Buffer }[] = [];
    for (let i = 0; i < browseResults.length; i++) {
        const result = browseResults[i];
        if (
            result.statusCode.equals(StatusCodes.BadNoContinuationPoints) ||
            result.statusCode.equals(StatusCodes.BadContinuationPointInvalid)
        ) {
            // there was not enough continuation points
            warningLog("There is not enough browse continuation points");
            // we will have to reinject this browse to a new browse commande
            browseToRedo.push({ index: i, nodeToBrowse: nodesToBrowse[i] });
            continue;
        }
        const continuationPoint = result.continuationPoint;
        (result as any).continuationPoint = undefined;
        if (continuationPoint && continuationPoint.length > 0) {
            browseToContinue.push({ references: result.references || [], continuationPoint });
        }
    }
    // resolve continuationPoints
    while (browseToContinue.length) {
        const tmp = [...browseToContinue];
        const continuationPoints = tmp.map((e) => e.continuationPoint);
        browseToContinue.splice(0);
        const browseNextResults = await session.browseNext(continuationPoints, false);
        assert(
            continuationPoints.length === browseNextResults.length,
            "browseNextResults length should eql continuationPoints.length"
        );
        for (let i = 0; i < browseNextResults.length; i++) {
            const browseResult = browseNextResults[i];
            const references = tmp[i].references || [];
            if (browseResult.references && browseResult.references.length) {
                references.push(...browseResult.references);
            }
            const continuationPoint = browseResult.continuationPoint;
            if (continuationPoint) {
                browseToContinue.push({ references, continuationPoint });
            }
        }
    }

    // resolve to redo
    if (browseToRedo.length && nodesToBrowse.length !== browseToRedo.length) {
        const nodesToBrowse2 = browseToRedo.map((e) => e.nodeToBrowse);
        const results2 = await browseAll2(session, nodesToBrowse2);
        for (let i = 0; i < browseResults.length; i++) {
            browseResults[browseToRedo[i].index] = results2[i];
        }
        browseToRedo.splice(0);
    }
    browseResults.forEach((b) => ((b as any).continuationPoint = undefined));
    return browseResults;
}
