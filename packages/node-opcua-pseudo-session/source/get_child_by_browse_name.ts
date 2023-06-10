import { BrowseDirection } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { ReferenceDescription } from "node-opcua-types";
import { IBasicSession } from "./basic_session_interface";

const warningLog = make_warningLog(__dirname);

export async function getChildByBrowseName(session: IBasicSession, nodeId: NodeId, name: string): Promise<ReferenceDescription> {
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeId,
        referenceTypeId: resolveNodeId("HierarchicalReferences"),
        nodeClassMask: 0,
        resultMask: 0x3f
    });
    if (!browseResult.references || browseResult.statusCode.isNotGood()) {
        throw new Error("Cannot browse node " + name + " " + browseResult.statusCode.toString() + " nodeId = " + nodeId.toString());
    }
    const selectedReference = browseResult.references.find(
        (r) => r.browseName.name?.match(name) || r.displayName.text!.match(name)
    );
    if (!selectedReference) {
        warningLog("getChildByBrowseName error", browseResult.toString());
        throw new Error("Cannot find node " + name + " from " + nodeId.toString());
    }
    return selectedReference;
}
