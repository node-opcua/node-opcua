import assert from "node-opcua-assert";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { NodeId, NodeIdLike, coerceNodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { CallMethodRequest } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { IBasicSessionAsync, findMethodId } from "node-opcua-pseudo-session";
import { MethodIds } from "node-opcua-constants";




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

    let methodId = r.methodId;
    if (!methodId) {
        // https://reference.opcfoundation.org/Core/Part9/v104/docs/5.7.3#_Ref224987672
        //  The Acknowledge Method is used to acknowledge an Event Notification for a Condition instance
        //  state where AckedState is False. Normally, the NodeId of the object instance is passed as the
        //  ObjectId to the Call Service. However, some Servers do not expose Condition instances in the AddressSpace.
        //  Therefore, Servers shall allow Clients to call the Acknowledge Method by specifying ConditionId as the ObjectId.
        //  The Method cannot be called with an ObjectId of the AcknowledgeableConditionType Node.
        //
        // The Confirm Method is used to confirm an Event Notifications for a Condition instance state where ConfirmedState is False.

        switch (methodName) {
            case "Acknowledge":
                methodId = resolveNodeId(MethodIds.AcknowledgeableConditionType_Acknowledge);
                break;
            case "Confirm":
                methodId = resolveNodeId(MethodIds.AcknowledgeableConditionType_Confirm);
                break;
            default:
                return StatusCodes.BadNodeIdUnknown;
        }
    }
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
