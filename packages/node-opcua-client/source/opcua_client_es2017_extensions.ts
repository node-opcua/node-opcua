/**
 * @module bode-opcua-client
 */
// tslint:disable:only-arrow-functions
// tslint:disable:no-empty

import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { ClientSession, ClientSessionImpl } from "./client_session";
import { ClientSubscription } from "./client_subscription";
import { OPCUAClient, WithSessionFunc, WithSubscriptionFunc } from "./opcua_client";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const errorLog = debugLog;

/**
 * @param endpointUrl
 * @param func
 * Note: only present on node >= 8
 */
OPCUAClient.prototype.withSessionAsync = async function(endpointUrl: string, func: WithSessionFunc): Promise<any> {

    assert(_.isFunction(func));
    assert(func.length === 1, "expecting a single argument in func");

    try {
        await this.connect(endpointUrl);
        const session = await this.createSession({});

        let result;
        try {
            result = await func(session);
        } catch (err) {
            errorLog(err);
        }
        await session.close();
        await this.disconnect();
        return result;
    } catch (err) {
        throw err;
    } finally {
    }
};

OPCUAClient.prototype.withSubscriptionAsync = async function(
    endpointUrl: string,
    parameters: any, func: WithSubscriptionFunc
) {
    await this.withSessionAsync(endpointUrl, async (session: ClientSession) => {
        assert(session, " session must exist");
        const subscription = new ClientSubscription(session as ClientSessionImpl, parameters);

        subscription.on("started", () => {
            // console.log("started subscription :", subscription.subscriptionId);
            // console.log(" revised parameters ");
            // console.log("  revised maxKeepAliveCount  ", subscription.maxKeepAliveCount,"
            // ( requested ", parameters.requestedMaxKeepAliveCount + ")");
            // console.log("  revised lifetimeCount      ", subscription.lifetimeCount, " (
            // requested ", parametersequestedLifetimeCount + ")");
            // console.log("  revised publishingInterval ", subscription.publishingInterval, "
            // ( requested ", arameters.requestedPublishingInterval + ")");
            // console.log("  suggested timeout hint     ", subscription.publish_engine.timeoutHint);
        }).on("internal_error", (err: Error) => {
            debugLog(" received internal error", err.message);
        }).on("keepalive", () => {

        }).on("terminated", (err?: Error) => {
            // console.log(" terminated");
        });

        await func(session, subscription);

        await subscription.terminate();
    });
};
