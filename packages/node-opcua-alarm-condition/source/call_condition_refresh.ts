import assert from "node-opcua-assert";
import { DataType, StatusCode, StatusCodes } from "node-opcua-basic-types";
import { resolveNodeId } from "node-opcua-nodeid";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { CallMethodRequest } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { IBasicSessionAsync, CallMethodRequestLike } from "node-opcua-pseudo-session";

const doDebug = false;
const debugLog = make_debugLog("A&E");
const warningLog = make_warningLog("A&E");

export async function callConditionRefresh(session: IBasicSessionAsync, subscriptionId: number): Promise<StatusCode> {
    assert(isFinite(subscriptionId), "May be subscription is not yet initialized");
    const conditionTypeNodeId = resolveNodeId("ConditionType");
    let conditionRefreshId = resolveNodeId("ConditionType_ConditionRefresh");
    // find conditionRefreshId
    const browsePath = makeBrowsePath(conditionTypeNodeId, ".ConditionRefresh");
    const translateResult = await session.translateBrowsePath(browsePath);

    // istanbul ignore next
    if (translateResult.targets && translateResult.targets.length > 0) {
        conditionRefreshId = translateResult.targets[0].targetId;
    } else {
        // cannot find conditionRefreshId
        return StatusCodes.BadInternalError;
    }
    const methodToCall: CallMethodRequestLike = {
        inputArguments: [new Variant({ dataType: DataType.UInt32, value: subscriptionId })],
        methodId: conditionRefreshId,
        objectId: conditionTypeNodeId
    };

    doDebug && debugLog("Calling method ", new CallMethodRequest(methodToCall).toString());
    const callResult = await session.call(methodToCall);
    // istanbul ignore next
    if (callResult.statusCode.isNotGood()) {
        warningLog(new CallMethodRequest(methodToCall).toString());
    }
    return callResult.statusCode;
}
