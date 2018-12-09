const OPCUAClient = require("./opcua_client").OPCUAClient;
const ClientSubscription = require("./client_subscription").ClientSubscription;
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

/**
 * @method withSessionAsync
 * @param endpointUrl
 * @param func {Function}   Async function
 * @param func.session {ClientSession}
 *
 * @return {Promise<*>}
 *
 *
 * Note: only present on node >= 8
 */
OPCUAClient.prototype.withSessionAsync = async function (endpointUrl, func) {

    assert(_.isFunction(func));
    assert(func.length === 1, "expecting a single argument in func");

    try {
        await this.connect(endpointUrl);
        const session = await this.createSession({});

        let result;
        try {
            result = await func(session);
        }
        catch (err) {
            console.log(err);
        }
        await session.close();
        await this.disconnect();
        return result;
    }
    catch (err) {
        throw err;
    }
    finally {
    }
};

OPCUAClient.prototype.withSubscriptionAsync = async function (endpointUrl, parameters, func) {
    await this.withSessionAsync(endpointUrl, async function (session) {
        assert(session, " session must exist");
        const subscription = new ClientSubscription(session, parameters);

        subscription.on("started", function () {
            //xx console.log("started subscription :", subscription.subscriptionId);
            //xx console.log(" revised parameters ");
            //xx console.log("  revised maxKeepAliveCount  ", subscription.maxKeepAliveCount," ( requested ", parameters.requestedMaxKeepAliveCount + ")");
            //xx console.log("  revised lifetimeCount      ", subscription.lifetimeCount, " ( requested ", parameters.requestedLifetimeCount + ")");
            //xx console.log("  revised publishingInterval ", subscription.publishingInterval, " ( requested ", parameters.requestedPublishingInterval + ")");
            //xx console.log("  suggested timeout hint     ", subscription.publish_engine.timeoutHint);
        }).on("internal_error", function (err) {
            console.log(" received internal error", err.message);
        }).on("keepalive", function () {


        }).on("terminated", function (err) {
            //xx console.log(" terminated");
        });

        await func(session, subscription);

        await subscription.terminate();
    });
};
