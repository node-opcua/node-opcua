import "should";
import { TimestampsToReturn } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import sinon, { type SinonSandbox } from "sinon";

import { ClientMonitoredItemGroup, ClientSidePublishEngine } from "../dist/index.js";
import { ClientSessionImpl } from "../dist/private/client_session_impl.js";
import { ClientSubscriptionImpl } from "../dist/private/client_subscription_impl.js";

describe("Testing the Monitored Items Group", () => {
    let sandbox: SinonSandbox;
    let monitoredItemGroup: ClientMonitoredItemGroup;
    let fakeSubscription: sinon.SinonStubbedInstance<ClientSubscriptionImpl>;

    before(() => {
        sandbox = sinon.createSandbox();

        fakeSubscription = sandbox.createStubInstance(ClientSubscriptionImpl);
        fakeSubscription._wait_for_subscription_to_be_ready.callsFake((cb: (err?: Error) => void) => setTimeout(() => cb(), 500));

        const fakeEngine = sandbox.createStubInstance(ClientSidePublishEngine);
        fakeSubscription.publishEngine = fakeEngine as unknown as ClientSidePublishEngine;

        const fakeSession = sandbox.createStubInstance(ClientSessionImpl);
        fakeEngine.session = fakeSession as unknown as ClientSessionImpl;

        fakeSession.createMonitoredItems.yields(new Error("something bad happened"));

        monitoredItemGroup = ClientMonitoredItemGroup.create(fakeSubscription, [], {}, TimestampsToReturn.Both);
    });

    it("should transmit an error object if it occurs ", (done) => {
        monitoredItemGroup.on("terminated", (err: Error) => {
            err.message.should.eql("something bad happened");
            done();
        });
    });

    after(() => {
        sandbox.restore();
    });
});
