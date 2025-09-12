import should from "should";
import sinon from "sinon";
import { TimestampsToReturn } from "node-opcua-data-value";
import { SinonSandbox } from "sinon";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { ClientMonitoredItemGroup, ClientSubscription } from "..";
import { ClientSubscriptionImpl } from "../dist/private/client_subscription_impl";
import { ClientSessionImpl } from "../dist/private/client_session_impl";

describe("Testing the Monitored Items Group", () => {
    let sandbox: SinonSandbox;
    let monitoredItemGroup: any;
    let fakeSubscription: any;

    before(() => {
        sandbox = sinon.createSandbox();

        fakeSubscription = sandbox.createStubInstance(ClientSubscriptionImpl);
        fakeSubscription._wait_for_subscription_to_be_ready.callsFake((cb: any) => setTimeout(() => cb(null), 500));
        const fakeSession = sandbox.createStubInstance(ClientSessionImpl);
        fakeSession.createMonitoredItems.yields(new Error("something bad happened"));
        sandbox.stub(fakeSubscription, "session").value(fakeSession);

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
