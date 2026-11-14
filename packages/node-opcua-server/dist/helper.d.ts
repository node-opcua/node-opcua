import type { OPCUAServer } from "./opcua_server.js";
import type { ServerEngine } from "./server_engine.js";
import { type Subscription } from "./server_subscription.js";
/**
 *
 * @private
 */
export declare function installSessionLogging(server: OPCUAServer): void;
export declare function installSubscriptionMonitoring(subscription: Subscription): void;
export declare function installSessionLoggingOnEngine(serverEngine: ServerEngine): void;
//# sourceMappingURL=helper.d.ts.map