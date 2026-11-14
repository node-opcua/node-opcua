import util from "node:util";
import { SubscriptionState } from "./server_subscription.js";
const consolelog = (...args) => {
    const d = new Date();
    const t = `${d.toTimeString().split(" ")[0]}.${d.getMilliseconds().toString().padStart(3, "0")}`;
    console.log.apply(console, [t, ...args]);
};
const doDebug = false;
/**
 *
 * @private
 */
export function installSessionLogging(server) {
    installSessionLoggingOnEngine(server.engine);
}
const info = (subscription) => {
    return util.format(subscription.subscriptionId, SubscriptionState[subscription.state].padEnd(9), subscription.state, "kac=", `${subscription.currentKeepAliveCount.toString().padStart(3)}/${subscription.maxKeepAliveCount.toString().padStart(3)}`, "ltc=", `${subscription.currentLifetimeCount.toString().padStart(3)}/${subscription.lifeTimeCount.toString().padStart(3)}`, "prc=", subscription.publishEngine?.pendingPublishRequestCount.toString().padStart(3), "pi=", subscription.publishingInterval);
};
export function installSubscriptionMonitoring(subscription) {
    consolelog("new_subscription", subscription.subscriptionId, info(subscription));
    subscription.on("lifeTimeExpired", () => {
        consolelog("lifeTimeExpired".padEnd(45), info(subscription));
    });
    // biome-ignore lint/correctness/noConstantCondition: deliberate debug on/off toggle, not dead code
    if (true || doDebug) {
        subscription.on("lifeTimeCounterChanged", (_ltc) => {
            consolelog("subscription lifeTimeCounterChanged".padEnd(45), info(subscription));
        });
    }
    subscription.on("expired", () => {
        consolelog("subscription expired".padEnd(45), info(subscription));
    });
    subscription.on("stateChanged", (_state) => {
        consolelog("subscription stateChanged".padEnd(45), info(subscription));
    });
    subscription.on("terminate", () => {
        consolelog("subscription terminated".padEnd(45), info(subscription));
    });
    subscription.on("keepalive", () => {
        consolelog("subscription keepalive".padEnd(45), info(subscription));
    });
}
export function installSessionLoggingOnEngine(serverEngine) {
    function on_create_session(session) {
        try {
            session.on("activate_session", () => {
                consolelog("activate_session");
            });
            session.on("statusChanged", (status) => {
                consolelog("session status changed: ", status);
            });
            session.on("new_subscription", (subscription) => {
                installSubscriptionMonitoring(subscription);
            });
        }
        catch (err) {
            consolelog(err instanceof Error ? err.message : err);
        }
    }
    serverEngine.on("create_session", on_create_session);
    serverEngine.once("session_closed", (_session) => {
        consolelog("session is closed");
        serverEngine.removeListener("create_session", on_create_session);
    });
}
//# sourceMappingURL=helper.js.map