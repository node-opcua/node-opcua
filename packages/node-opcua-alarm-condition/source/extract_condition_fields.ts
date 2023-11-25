import { NodeIdLike } from "node-opcua-nodeid";
import { ISessionForExtractField, extractFields, simpleBrowsePathsToString } from "node-opcua-pseudo-session";

export async function extractConditionFields(session: ISessionForExtractField, conditionNodeId: NodeIdLike): Promise<string[]> {
    // conditionNodeId could be a Object of type ConditionType
    // or it could be directly a ObjectType which is a subType of ConditionType
    const p = await extractFields(session, conditionNodeId);
    const fields1 = simpleBrowsePathsToString(p.map((a) => a.path));
    // add this field which will always be added
    fields1.push("ConditionId");
    return fields1;
}
