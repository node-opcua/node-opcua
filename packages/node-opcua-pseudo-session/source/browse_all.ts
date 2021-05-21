/**
 * @module node-opcua-pseudo-session
 */
import { BrowseResult } from "node-opcua-service-browse";
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
        let continuationPoint = result.continuationPoint;
        while (continuationPoint) {
            const result2 = await session.browseNext(result.continuationPoint, false);
            result.references!.push.apply(result.references, result2.references || []);
            continuationPoint = result2.continuationPoint;
        }
    }
    return results;
}
