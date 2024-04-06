import { warn } from "console";
import { ClientBaseImpl } from "../client_base_impl";

export function waitUntilReconnectionIsCanceled(client: ClientBaseImpl, callback: () => void) {
    const interval = 100;
    const maxIntervalCount = 100;
    let intervalCount = 0;
    const timer = setInterval(() => {
        if (!client.isReconnecting || ++intervalCount > maxIntervalCount) {
            clearInterval(timer);
            if (intervalCount > maxIntervalCount) {
                warn("waitUntilReconnectionIsCanceled: timeout");
            }
            callback();
        }
    }, interval);
}
