import { AttributeIds, BrowseDirection, NodeClassMask, QualifiedName, stringToQualifiedName } from "node-opcua-data-model";
import { NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { BrowseDescriptionOptions } from "node-opcua-service-browse";
import { NodeClass } from "node-opcua-types";
import { make_debugLog } from "node-opcua-debug";
import { IBasicSessionBrowseAsyncMultiple, IBasicSessionBrowseAsyncSimple, IBasicSessionReadAsyncSimple } from "./basic_session_interface";

const doDebug = false;
const debugLog = make_debugLog(__filename);

export type ISessionForExtractField = IBasicSessionBrowseAsyncSimple & IBasicSessionBrowseAsyncMultiple & IBasicSessionReadAsyncSimple;

/**
 * 
 * recursively work down an node definition and find 
 * the components and property ...
 * also navigate the sub
 * @param session the session
 * @param nodeId the object to investigate , could be the nodeId of a Object/Variable/ObjectType or VariableType.
 * @returns a array of {path: QualifiedName[], nodeId: NodeId}}
 * 
 * @private
 */
export async function extractFields(
    session: ISessionForExtractField,
    nodeId: NodeIdLike
): Promise<{ path: QualifiedName[]; nodeId: NodeId }[]> {
    const _duplicateMap: any = {};

    const fields1: { path: QualifiedName[]; nodeId: NodeId }[] = [];

    function addField(parent: QualifiedName[], browseName: QualifiedName, nodeId: NodeId) {
        const e = [...parent, browseName];
        const key = simpleBrowsePathToString(e);

        // istanbul ignore next
        doDebug && debugLog("adding field ", key);

        if (!_duplicateMap[key]) {
            fields1.push({ path: e, nodeId });
            _duplicateMap[key] = e;
        }
    }

    interface IStackElement {
        parent: QualifiedName[];
        nodeId: NodeId;
    }
    const stack: IStackElement[] = [];
    function _pushInvestigation(parent: QualifiedName[], objectId: NodeId) {
        stack.push({
            parent,
            nodeId: objectId
        });
    }
    async function _flushPendingInvestigations() {
        if (stack.length === 0) {
            return;
        }
        const extracted = stack.splice(0);
        const nodesToBrowse = extracted.map((e: IStackElement) => {
            const { parent, nodeId } = e;
            const b: BrowseDescriptionOptions = {
                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
                nodeId,
                referenceTypeId: "HasChild",
                resultMask: 63
            };
            return b;
        });
        const results = await session.browse(nodesToBrowse);

        for (let index = 0; index < results.length; index++) {
            const result = results[index];
            const parent = extracted[index].parent;
            if (!result.references || result.references.length === 0) continue;

            // istanbul ignore next
            doDebug &&
                debugLog(
                    "exploring",
                    simpleBrowsePathToString(parent),
                    result.references.map((a) => a.browseName.toString())
                );

            for (const ref of result.references) {
                if (ref.nodeClass === NodeClass.Variable) {
                    addField(parent, ref.browseName, ref.nodeId);
                }
                _pushInvestigation([...parent, ref.browseName], ref.nodeId);
            }
        }
        await _flushPendingInvestigations();
    }

    async function _investigateTopLevel(parent: QualifiedName[], eventNodeId: NodeIdLike) {
        const browseDescriptionForInverseSubType: BrowseDescriptionOptions = {
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.ObjectType,
            nodeId: eventNodeId,
            referenceTypeId: resolveNodeId("HasSubtype"),
            resultMask: 63
        };
        const nodeToBrowse2: BrowseDescriptionOptions = {
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
            nodeId: eventNodeId,
            referenceTypeId: resolveNodeId("HasChild"),
            resultMask: 63
        };
        const nodesToBrowse = [browseDescriptionForInverseSubType, nodeToBrowse2];
        const browseResults = await session.browse(nodesToBrowse);
        const [browseResultForInverseSubType, browseResultForChildren] = browseResults;

        if (browseResultForChildren && browseResultForChildren.references) {
            for (const ref of browseResultForChildren.references) {
                if (ref.nodeClass === NodeClass.Variable) {
                    addField(parent, ref.browseName, ref.nodeId);
                }
                _pushInvestigation([...parent, ref.browseName], ref.nodeId);
            }
        }
        await _flushPendingInvestigations();

        if (browseResultForInverseSubType && browseResultForInverseSubType.references) {
            const promises = [];
            for (const reference of browseResultForInverseSubType.references) {
                // istanbul ignore next
                doDebug && debugLog(" investigating super-type", reference.browseName.toString());
                promises.push(_investigateTopLevel([], reference.nodeId));
            }
            await Promise.all(promises);
        }
    }

    // istanbul ignore next
    doDebug &&
        debugLog(
            "investigating ",
            nodeId.toString(),
            (await session.read({ nodeId, attributeId: AttributeIds.BrowseName })).value.value.toString()
        );
    await _investigateTopLevel([], nodeId);
    return fields1;
}


export function simpleBrowsePathToString(bp: QualifiedName[]): string {
    return bp.map((qn) => qn.toString()).join(".");
}
export function simpleBrowsePathsToString(simpleBrowsePathArray: QualifiedName[][]): string[] {
    return simpleBrowsePathArray.map(simpleBrowsePathToString);
}
export function stringPathToSimpleBrowsePath(bp: string): QualifiedName[] {
    return bp.split(".").map((s) => stringToQualifiedName(s));
}
