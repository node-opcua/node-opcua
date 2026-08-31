import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eModifyMonitoredItemOnEvent } from "./u_test_e2e_modifyMonitoredItem_onEvent.js";
import { t as tE2eMonitoredItemCtt018 } from "./u_test_e2e_monitored_item_ctt018.js";
import { t as tE2eSubscriptionUseCaseMonitoringEvents } from "./u_test_e2e_SubscriptionUseCase_monitoring_events.js";
import { t as tE2eServerWith500Clients } from "./u_test_e2e_server_with_500_clients.js";

const port = 1994;

describe("testing Client - Umbrella-H", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 30_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    tE2eSubscriptionUseCaseMonitoringEvents(test);
    tE2eMonitoredItemCtt018(test);
    tE2eServerWith500Clients(test);
    tE2eModifyMonitoredItemOnEvent(test);
});
