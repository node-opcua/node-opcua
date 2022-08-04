import * as util from "util";
import { OPCUAServer } from "./opcua_server";
import { ServerEngine } from "./server_engine";
import { ServerSession } from "./server_session";
import { Subscription, SubscriptionState } from "./server_subscription";

const consolelog = (...args: any) => {
    const d = new Date();
    const t = d.toTimeString().split(" ")[0] + "." + d.getMilliseconds().toString().padStart(3, "0");
    console.log.apply(console, [t, ...args]);
};
const doDebug = false;

/**
 *
 * @private
 */
export function installSessionLogging(server: OPCUAServer) {
    installSessionLoggingOnEngine(server.engine);
}

const info = (subscription: Subscription) => {
    return util.format(
        subscription.subscriptionId,
        SubscriptionState[subscription.state].padEnd(9),
        subscription.state,
        "kac=",
        subscription.currentKeepAliveCount.toString().padStart(3)+
        "/"+
        subscription.maxKeepAliveCount.toString().padStart(3),
        "ltc=",
        subscription.currentLifetimeCount.toString().padStart(3)+
        "/"+
        subscription.lifeTimeCount.toString().padStart(3),
        "prc=",
        subscription.publishEngine?.pendingPublishRequestCount.toString().padStart(3),
        "pi=",
        subscription.publishingInterval
    );
};

export function installSubscriptionMonitoring(subscription: Subscription) {
    consolelog("new_subscription", subscription.subscriptionId, info(subscription));
    subscription.on("lifeTimeExpired", () => {
        consolelog("lifeTimeExpired".padEnd(45), info(subscription));
    });
    if (true || doDebug) {
        subscription.on("lifeTimeCounterChanged", (ltc: number) => {
            consolelog("subscription lifeTimeCounterChanged".padEnd(45), info(subscription));
        });
    }
    subscription.on("expired", () => {
        consolelog("subscription expired".padEnd(45), info(subscription));
    });
    subscription.on("stateChanged", (state: SubscriptionState) => {
        consolelog("subscription stateChanged".padEnd(45), info(subscription));
    });
    subscription.on("terminate", () => {
        consolelog("subscription terminated".padEnd(45), info(subscription));
    });
    subscription.on("keepalive", () => {
        consolelog("subscription keepalive".padEnd(45), info(subscription));
    });
}
export function installSessionLoggingOnEngine(serverEngine: ServerEngine) {
    function on_create_session(session: ServerSession) {
        try {
            session.on("activate_session", function () {
                consolelog("activate_session");
            });

            session.on("statusChanged", (status) => {
                consolelog("session status changed: ", status);
            });
            session.on("new_subscription", function (subscription) {
                installSubscriptionMonitoring(subscription);
            });
        } catch (err) {
            consolelog((err as any).message);
        }
    }
    serverEngine.on("create_session", on_create_session);
    serverEngine.once("session_closed", function (session) {
        consolelog("session is closed");
        serverEngine.removeListener("create_session", on_create_session);
    });
}
