/**
 * @module node-opcua-server
 *
 * TransferSubscriptions between front threads: a front asked for a subscription it does not hold
 * asks the engine, which asks the other fronts; the one holding it gives it up
 * (ServerEngine.exportSubscription) and its state crosses back here, where the engine of this
 * front rebuilds it (ServerEngine.adoptSubscription). The OPC UA structures of the state cross as
 * their binary encoding.
 */
import { coerceStatusCode, type StatusCode } from "node-opcua-status-code";
import { MonitoredItemCreateRequest, NotificationMessage } from "node-opcua-types";
import type { IRemoteSubscriptions } from "../server_engine.js";
import type { SubscriptionTransferState } from "../server_subscription.js";
import type { ITransferSessionIdentity } from "../sessions_compatible_for_transfer.js";
import { decodeStructure, type EncodedTransferState, encodeStructure } from "./protocol.js";
import type { EngineChannel } from "./remote_backend.js";

export function encodeTransferState(state: SubscriptionTransferState): EncodedTransferState {
    return {
        ...state,
        sentNotificationMessages: state.sentNotificationMessages.map((message) => encodeStructure(message)),
        monitoredItems: state.monitoredItems.map((item) => ({ ...item, request: encodeStructure(item.request) }))
    };
}

export function decodeTransferState(encoded: EncodedTransferState): SubscriptionTransferState {
    return {
        ...encoded,
        sentNotificationMessages: encoded.sentNotificationMessages.map((bytes) =>
            decodeStructure(bytes, new NotificationMessage())
        ),
        monitoredItems: encoded.monitoredItems.map((item) => ({
            ...item,
            request: decodeStructure(item.request, new MonitoredItemCreateRequest())
        }))
    };
}

/** the answer of a front asked to give up a subscription: its state, a refusal, or null when it does not hold it */
export type ExportResult = EncodedTransferState | number | null;

export function encodeExportResult(result: SubscriptionTransferState | StatusCode | null): ExportResult {
    if (result === null) return null;
    return "monitoredItems" in result ? encodeTransferState(result) : result.value;
}

/** the subscriptions of the other fronts, through the engine */
export class RemoteSubscriptions implements IRemoteSubscriptions {
    readonly #channel: EngineChannel;

    constructor(channel: EngineChannel) {
        this.#channel = channel;
    }

    public async take(
        subscriptionId: number,
        dest: ITransferSessionIdentity
    ): Promise<SubscriptionTransferState | StatusCode | null> {
        const result = await this.#channel.call<ExportResult>({ kind: "takeSubscription", subscriptionId, identity: dest });
        if (result === null) return null;
        return typeof result === "number" ? coerceStatusCode(result) : decodeTransferState(result);
    }
}
