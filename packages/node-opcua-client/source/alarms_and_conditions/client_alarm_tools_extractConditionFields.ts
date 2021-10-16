import { BrowseDirection, NodeClassMask, QualifiedName } from "node-opcua-data-model";
import { NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { BrowseDescriptionOptions } from "node-opcua-service-browse";

/**
 *
 * @param session
 * @param conditionNodeId
 */
export async function extractConditionFields(session: IBasicSession, conditionNodeId: NodeIdLike): Promise<string[]> {
    // conditionNodeId could be a Object of type ConditionType
    // or it could be directly a ObhectType which is a  subType of ConditionType

    const _duplicateMap: any = {};
    const fields1: string[] = [];

    function addField(name: string) {
        if (!_duplicateMap[name]) {
            fields1.push(name);
            _duplicateMap[name] = name;
        }
    }
    interface S {
        browseName: QualifiedName;
        nodeToBrowse: BrowseDescriptionOptions;
    }
    const stack: any[] = [];
    function deferObjectOrVariableInvestigation(objectId: NodeId, browseName: string) {
        stack.push({
            browseName,
            nodeId: objectId
        });
    }
    async function _investigateObjectOrVariable() {
        if (stack.length === 0) {
            return;
        }

        const extracted = stack.splice(0);
        const nodesToBrowse = extracted.map((e: any) => {
            const b: BrowseDescriptionOptions = {
                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                // tslint:disable-next-line: no-bitwise
                nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
                nodeId: e.nodeId,
                referenceTypeId: "HasChild",
                resultMask: 63
            };
            return b;
        });
        const results = await session.browse(nodesToBrowse);

        let i = 0;
        for (const result of results) {
            const name = extracted[i].browseName.toString();
            i++;

            if (!result.references) {
                continue;
            }

            for (const ref of result.references) {
                const n = name + "." + ref.browseName.toString();
                addField(n);
                deferObjectOrVariableInvestigation(ref.nodeId, n);
            }
        }
        await _investigateObjectOrVariable();
    }

    // tslint:disable-next-line: no-shadowed-variable
    async function _investigateLevel(conditionNodeId: NodeIdLike) {
        const nodeToBrowse1: BrowseDescriptionOptions = {
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.ObjectType,
            nodeId: conditionNodeId,
            referenceTypeId: resolveNodeId("HasSubtype"),
            resultMask: 63
        };
        const nodeToBrowse2: BrowseDescriptionOptions = {
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            // tslint:disable-next-line: no-bitwise
            nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
            nodeId: conditionNodeId,
            referenceTypeId: resolveNodeId("HasChild"),
            resultMask: 63
        };
        const nodesToBrowse = [nodeToBrowse1, nodeToBrowse2];
        const browseResults = await session.browse(nodesToBrowse);

        // console.log(browseResults[0].toString());
        // console.log(browseResults[1].toString());

        if (browseResults[1] && browseResults[1].references) {
            for (const ref of browseResults[1].references) {
                addField(ref.browseName.toString());
                deferObjectOrVariableInvestigation(ref.nodeId, ref.browseName.toString());
            }
        }
        if (browseResults[0] && browseResults[0].references) {
            const promises = [];
            for (const reference of browseResults[0].references) {
                promises.push(_investigateLevel(reference.nodeId));
            }
            await Promise.all(promises);
        }

        await _investigateObjectOrVariable();
    }
    await _investigateLevel(conditionNodeId);

    // add this field which will always be added
    addField("ConditionId");
    return fields1;
}
