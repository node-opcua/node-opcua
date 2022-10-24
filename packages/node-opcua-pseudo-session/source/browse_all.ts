/**
 * @module node-opcua-pseudo-session
 */
import { BrowseResult } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { IBasicSession, BrowseDescriptionLike } from "./basic_session_interface";

export async function browseAll(session: IBasicSession, nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;
export async function browseAll(session: IBasicSession, nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
export async function browseAll(
    session: IBasicSession,
    nodesToBrowse: BrowseDescriptionLike[] | BrowseDescriptionLike
): Promise<any> {
    if (!(nodesToBrowse instanceof Array)) {
        return (await browseAll(session, [nodesToBrowse]))[0];
    }
    if (nodesToBrowse.length === 0) {
        return [];
    }
    const results = await session.browse(nodesToBrowse);

    for (const result of results) {
        if(result.statusCode === StatusCodes.BadNoContinuationPoints) {
            // there was not enough continuation points
        }

        let continuationPoint = result.continuationPoint;
        while (continuationPoint) {
            const broweResults = await session.browseNext([result.continuationPoint], false);
            const broweResult = broweResults[0];
            result.references!.push.apply(result.references, broweResult.references || []);
            continuationPoint = broweResult.continuationPoint;
        }
    }
    return results;
}
