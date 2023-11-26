import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { BrowseDirection, QualifiedNameLike, coerceQualifiedName } from "node-opcua-data-model";
import { IBasicSessionAsync } from "./basic_session_interface";

export async function findInTypeOrSuperType(
    session: IBasicSessionAsync,
    browsePath: BrowsePath
): Promise<{ nodeId: NodeId } | { nodeId: null; err: Error }> {
    const nodeId = browsePath.startingNode;
    const result = await session.translateBrowsePath(browsePath);
    if (result.statusCode.isGood()) {
        return { nodeId: result.targets![0].targetId as NodeId };
    }
    // cannot be found here, go one step up
    const br = await session.browse({
        nodeId,
        referenceTypeId: "HasSubtype",
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: true,
        nodeClassMask: 0,
        resultMask: 0
    });
    if (br.statusCode.isNotGood()) {
        // cannot find typeDefinition
        return { nodeId: null, err: new Error("cannot find typeDefinition") };
    }
    const typeDefinition = br.references![0].nodeId;
    browsePath = new BrowsePath({
        startingNode: typeDefinition,
        relativePath: browsePath.relativePath
    });
    return await findInTypeOrSuperType(session, browsePath);
}

/**
 *
 * find a MethodId in a object or in its super type
 *
 * note:
 *   - methodName is a browse name and may therefore be prefixed with a namespace index.
 *   - if method is not found on the object specified by nodeId, then the findMethodId will
 *     recursively browse up the hierarchy of object typeDefinition Node
 *     until it reaches the root type. and try to find the first method that matches the
 *     provided name.
 * 
 * @param session
 * @param nodeId     the nodeId of the object to find
 * @param methodName the method name to find prefixed with a namespace index (unless ns=0)
 *                   ( e.g "Add" or "Add" or "1:BumpCounter" )
 */
export async function findMethodId(
    session: IBasicSessionAsync,
    nodeId: NodeIdLike,
    methodName: QualifiedNameLike
): Promise<{ methodId: NodeId } | { methodId: null; err: Error }> {
    const browsePath = makeBrowsePath(nodeId, "/" + coerceQualifiedName(methodName).toString());
    const result = await session.translateBrowsePath(browsePath);
    if (result.statusCode.isNotGood()) {
        const br = await session.browse({
            nodeId,
            referenceTypeId: "HasTypeDefinition",
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: 0,
            resultMask: 0
        });
        if (br.statusCode.isNotGood()) {
            // cannot find typeDefinition
            return { methodId: null, err: new Error("cannot find typeDefinition") };
        }
        const typeDefinition = br.references![0].nodeId;
        // need to find method on objectType
        const browsePath = makeBrowsePath(typeDefinition, "/" + methodName);
        const result = await findInTypeOrSuperType(session, browsePath);
        if (!result.nodeId) {
            return { err: result.err, methodId: null };
        }
        return { methodId: result.nodeId };
    }
    result.targets = result.targets || [];

    // istanbul ignore else
    if (result.targets.length > 0) {
        const methodId = result.targets[0].targetId as NodeId;
        return { methodId };
    } else {
        // cannot find objectWithMethodNodeId
        const err = new Error(" cannot find " + methodName + " Method");
        return { methodId: null, err };
    }
}
