import assert from "node-opcua-assert";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { NodeId, NodeIdLike, coerceNodeId } from "node-opcua-nodeid";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { CallMethodRequest } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { IBasicSessionAsync, findMethodId } from "node-opcua-pseudo-session";


export async function callMethodCondition(
    session: IBasicSessionAsync,
    methodName: string,
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike,
   
): Promise<StatusCode>
{
    conditionId = coerceNodeId(conditionId);
    assert(conditionId instanceof NodeId);
    assert(eventId instanceof Buffer);
    assert(typeof comment === "string" || comment instanceof LocalizedText);

    comment = LocalizedText.coerce(comment) || new LocalizedText();    
    const r = await findMethodId(session, conditionId, methodName);
    if (!r.methodId) {
        return StatusCodes.BadNodeIdUnknown;
    }
    const methodId = r.methodId;
    const methodToCalls = [];

    methodToCalls.push(
        new CallMethodRequest({
            inputArguments: [
                /* eventId */ new Variant({ dataType: "ByteString", value: eventId }),
                /* comment */ new Variant({ dataType: "LocalizedText", value: comment })
            ],
            methodId,
            objectId: conditionId
        })
    );

   const results =  await session.call(methodToCalls);
   const statusCode = results![0].statusCode;
   return statusCode;
 }


 export async function acknowledgeCondition(
    session: IBasicSessionAsync,
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike
): Promise<StatusCode> {
    return await callMethodCondition(session, "Acknowledge", conditionId, eventId, comment);
}
export async function confirmCondition(
    session: IBasicSessionAsync,
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike
): Promise<StatusCode> {
    return await callMethodCondition(session, "Confirm", conditionId, eventId, comment);
}
