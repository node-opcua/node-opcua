/**
 * @module node-opcua-pseudo-session
 */
import { CreateMonitoredItemsRequest, CreateMonitoredItemsResponse } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { IBasicSessionWithSubscription } from "./basic_session_with_subscription";

export async function createMonitoredItemsLimit(
    maxMonitoredItemsPerCall: number,
    session: IBasicSessionWithSubscription,
    createMonitoredItemsRequest: CreateMonitoredItemsRequest
): Promise<CreateMonitoredItemsResponse>;

export async function createMonitoredItemsLimit(
    maxMonitoredItemsPerCall: number,
    session: IBasicSessionWithSubscription,
    createMonitoredItemsRequest: CreateMonitoredItemsRequest
): Promise<CreateMonitoredItemsResponse> {
    const _session2 = session as IBasicSessionWithSubscription;

    if (!createMonitoredItemsRequest.itemsToCreate || createMonitoredItemsRequest.itemsToCreate.length === 0) {
        return new CreateMonitoredItemsResponse({
            responseHeader: {
                serviceResult: StatusCodes.Good
            },
            results: []
        });
    }
    if (
        maxMonitoredItemsPerCall <= 0 ||
        !createMonitoredItemsRequest.itemsToCreate ||
        createMonitoredItemsRequest.itemsToCreate.length <= maxMonitoredItemsPerCall
    ) {
        return _session2.createMonitoredItems(createMonitoredItemsRequest);
    }
    const n = [...(createMonitoredItemsRequest.itemsToCreate || [])];
    const response = new CreateMonitoredItemsResponse({
        diagnosticInfos: null,
        results: []
    });
    do {
        const c = n.splice(0, maxMonitoredItemsPerCall);
        const cmi = new CreateMonitoredItemsRequest({
            subscriptionId: createMonitoredItemsRequest.subscriptionId,
            timestampsToReturn: createMonitoredItemsRequest.timestampsToReturn,
            itemsToCreate: c
        });
        const r = await _session2.createMonitoredItems(cmi);
        for (const i of r.results!) {
            response.results!.push(i);
        }
    } while (n.length);
    return response;
}
