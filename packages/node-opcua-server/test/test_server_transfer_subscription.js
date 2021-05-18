/* eslint-disable max-statements */
/// reference 
const should = require("should");
const sinon = require("sinon");

const { PublishRequest } = require("node-opcua-service-subscription");
const { StatusCodes } = require("node-opcua-status-code");
const { ServerEngine, ServerSession } = require("..");


const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");
const mini_nodeset_filename = get_mini_nodeset_filename();

const { add_mock_monitored_item } = require("./helper");
const { with_fake_timer } = require("./helper_with_fake_timer");

const doDebug = !!process.env.TESTDEBUG;





const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("ServerEngine Subscriptions Transfer", function () {


    const test = this;
    /**
     * @type {ServerEngine}
     */
    let engine;
    /**
     * @type {ServerSession}
     */
    let session1;
    let session2;
    /**
     *  @type {NodeId}
     */
    let FolderTypeId, BaseDataVariableTypeId;
    beforeEach((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: mini_nodeset_filename }, () => {
            FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });

    afterEach(async () => {
        session1 = null;
        session2 = null;
        if (engine) {
            should.exist(engine);
            await engine.shutdown();
        }
        engine = null;
    });

    let requestHandle = 1;
    function sendPublishRequest(session/* : ServerSession */, publishHandler/* : () => void */) {
        session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 101 } }), publishHandler);
        requestHandle++;
        test.clock.tick(0);
    }


    it("ST01 - should send keep alive when starving and no notification exists", async () => {
        session1 = engine.createSession({ sessionTimeout: 10000 });
        const publishSpy = sinon.spy();

        await with_fake_timer.call(test, async (test) => {

            const subscription = session1.createSubscription({
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });

            // Given there is no Publish Request
            // when wait a very long time , longer than maxKeepAlive ,
            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2);

            sendPublishRequest(session1, publishSpy);
            test.clock.tick(subscription.publishingInterval);

            {
                const publishResponse = publishSpy.getCall(0).args[1];
                publishResponse.subscriptionId.should.eql(subscription.subscriptionId);
                publishResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                publishResponse.notificationMessage.notificationData.length.should.eql(0);
                publishResponse.notificationMessage.sequenceNumber.should.eql(1);
            }

            publishSpy.resetHistory();

            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2);
            sendPublishRequest(session1, publishSpy);
            test.clock.tick(subscription.publishingInterval);
            {
                const publishResponse = publishSpy.getCall(0).args[1];
                publishResponse.subscriptionId.should.eql(subscription.subscriptionId);
                publishResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                publishResponse.notificationMessage.notificationData.length.should.eql(0);
                publishResponse.notificationMessage.sequenceNumber.should.eql(1);
            }

            subscription.terminate();


        });
    });

    it("ST02 - should NOT send keep alive when starving and some notification exists", async () => {
        session1 = engine.createSession({ sessionTimeout: 10000 });
        const publishSpy = sinon.spy();

        await with_fake_timer.call(test, async () => {

            const subscription = session1.createSubscription({
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });

            // ===> some data arrive ( initnal value  )!!!
            const monitoredItem1 = add_mock_monitored_item(subscription);

            // Given there is no Publish Request
            // when wait a very long time , longer than maxKeepAlive ,
            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2);
            sendPublishRequest(session1, publishSpy);
            test.clock.tick(subscription.publishingInterval);

            {
                const publishResponse = publishSpy.getCall(0).args[1];
                publishResponse.subscriptionId.should.eql(subscription.subscriptionId);
                publishResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                publishResponse.notificationMessage.notificationData.length.should.eql(1);
                publishResponse.notificationMessage.sequenceNumber.should.eql(1);
                publishResponse.notificationMessage.notificationData[0].monitoredItems.length.should.eql(1);

            }

            publishSpy.resetHistory();

            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2);
            sendPublishRequest(session1, publishSpy);
            test.clock.tick(subscription.publishingInterval);

            {
                const publishResponse = publishSpy.getCall(0).args[1];
                publishResponse.subscriptionId.should.eql(subscription.subscriptionId);
                publishResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                publishResponse.notificationMessage.notificationData.length.should.eql(0);
                publishResponse.notificationMessage.sequenceNumber.should.eql(2);
            }

            subscription.terminate();

        });
    });

    it("ST03 - should NOT send keep alive when starving and some StatusChangeNotification exists", async () => {
        session1 = engine.createSession({ sessionTimeout: 10000 });
        const publishSpy = sinon.spy();

        await with_fake_timer.call(test, async () => {

            const subscription = session1.createSubscription({
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });


            subscription.maxNotificationsPerPublish.should.eql(10);
            // Given there is no Publish Request
            // when wait a very long time , longer than maxKeepAlive ,
            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2);


            session2 = engine.createSession({ sessionTimeout: 10000 });
            const transferResult = await engine.transferSubscription(session2, subscription.id, true);
            transferResult.statusCode.should.eql(StatusCodes.Good);
            transferResult.availableSequenceNumbers.should.eql([]);


            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2);
            sendPublishRequest(session1, publishSpy);

            {
                const publishResponse = publishSpy.getCall(0).args[1];

                // console.log(publishResponse.toString());

                publishResponse.notificationMessage.notificationData.length.should.eql(1);
                publishResponse.notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");

                publishResponse.subscriptionId.should.eql(subscription.subscriptionId);
                publishResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                publishResponse.notificationMessage.notificationData.length.should.eql(1);
                publishResponse.notificationMessage.sequenceNumber.should.eql(1);

                publishResponse.notificationMessage.notificationData[0].status.should.eql(StatusCodes.GoodSubscriptionTransferred);
            }

            publishSpy.resetHistory();

            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2);
            sendPublishRequest(session1, publishSpy);
            {
                const publishResponse = publishSpy.getCall(0).args[1];
                try {
                    publishResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
                } catch (err) {
                    console.log(publishResponse.toString());
                    throw err;
                }
            }

            subscription.terminate();

        });
    });

    it("ST04 - should transfer a subscription - with no monitored items", async () => {

        session1 = engine.createSession({ sessionTimeout: 10000 });

        await with_fake_timer.call(test, async () => {

   
            const subscription = session1.createSubscription({
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });

            session2 = engine.createSession();

            const transferResult = await engine.transferSubscription(session2, subscription.id, true);
            transferResult.statusCode.should.eql(StatusCodes.Good);
            transferResult.availableSequenceNumbers.length.should.eql(0);

            // xx  console.log(transferResult.toString());

            // ---------------------------------- Session1 should received a StatusChangeNotification event with GoodSubscriptionTransferred...
            const publishSpy = sinon.spy();
            sendPublishRequest(session1, publishSpy);
            sendPublishRequest(session1, publishSpy);
            sendPublishRequest(session1, publishSpy);
            sendPublishRequest(session1, publishSpy);


            publishSpy.callCount.should.eql(4);
            //xx console.log(publishSpy.getCall(0).args[1].toString());

            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription.subscriptionId);
            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(1);
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].status.should.eql(StatusCodes.GoodSubscriptionTransferred);


            subscription.terminate();
        });
    });

    it("ST05 - should transfer a subscription 2: with monitored items", async () => {

        session1 = engine.createSession({ sessionTimeout: 10000 });
        session2 = engine.createSession({ sessionTimeout: 10000 });

        await with_fake_timer.call(test, async () => {


            // A/ Create a subscription
            const subscription = session1.createSubscription({
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });

            const monitoredItem1 = add_mock_monitored_item(subscription);
            const monitoredItem2 = add_mock_monitored_item(subscription);

            // server send a notification to the client
            monitoredItem1.simulateMonitoredItemAddingNotification();
            monitoredItem2.simulateMonitoredItemAddingNotification();

            // wait for initital data to be received
            // server has now some notification ready and send them to the client
            const publishSpy1 = sinon.spy();
            session1.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 100 } }), publishSpy1);

            test.clock.tick(subscription.publishingInterval);

            if (doDebug) {
                console.log("---------------------------------------------------- 1");
                console.log(publishSpy1.getCall(0).args[1].toString());
            }
            const availableSequenceNumbers = publishSpy1.getCall(0).args[1].availableSequenceNumbers;
            availableSequenceNumbers.should.eql([1]);

            // let's assume that some notification have been send but not acknowledged yet
            publishSpy1.callCount.should.eql(1);
            publishSpy1.resetHistory();


            // ------------------------------------------------------------- 
            const transferResult = await engine.transferSubscription(session2, subscription.id, /* sendInitialValue =*/ true);

            if (doDebug) {
                console.log("transferResult", transferResult.toString());
            }

            // the transertResult.availbeSequenceNumber shall be One at this point because 
            // there was an unacknowledge sequence in session1 that can be republished in the context of session2
            transferResult.statusCode.should.eql(StatusCodes.Good);
            transferResult.availableSequenceNumbers.length.should.eql(1);
            transferResult.availableSequenceNumbers.should.eql([1]);

            sendPublishRequest(session1, publishSpy1);
            sendPublishRequest(session1, publishSpy1);
            sendPublishRequest(session1, publishSpy1);
            sendPublishRequest(session1, publishSpy1);
            test.clock.tick(subscription.publishingInterval);
            publishSpy1.callCount.should.eql(4);

            if (doDebug) {
                console.log("---------------------------------------------------- 2");
                console.log(publishSpy1.getCall(0).args[1].toString());
                console.log(publishSpy1.getCall(1).args[1].toString());

            }

            publishSpy1.getCall(0).args[1].subscriptionId.should.eql(subscription.subscriptionId);
            publishSpy1.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy1.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(2);

            // as subscription has been transfered, previously available sequenceNumber shall not be 
            // available anymore
            publishSpy1.getCall(0).args[1].availableSequenceNumbers.length.should.eql(1, "");
            publishSpy1.getCall(0).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy1.getCall(0).args[1].notificationMessage.notificationData[0].status.should.eql(StatusCodes.GoodSubscriptionTransferred);


            // --------------------------------------------
            const publishSpy2 = sinon.spy();
            session2.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 200 } }), publishSpy2);
            session2.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 201 } }), publishSpy2);
            test.clock.tick(subscription.publishingInterval);
            publishSpy2.callCount.should.eql(1);

            if (doDebug) {
                console.log("---------------------------------------------------- 3");
                console.log(publishSpy2.getCall(0).args[1].toString());
            }
            // now calling republish on old session should fail because subscription has been transfered
            const availableSequenceNumbers2 = publishSpy2.getCall(0).args[1].availableSequenceNumbers;
            availableSequenceNumbers2.should.eql([1, 3]);

            const retransmitSequenceNumber = availableSequenceNumbers2[0];
            const msgSequence = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);
            should(msgSequence).not.eql(null);

            subscription.terminate();


        });
    });

    it("ST06 - CTT 007 republish5105002 - republish after the subscriptions had been transferred to a different session", async () => {

        await with_fake_timer.call(test, async () => {
            // create session1
            session1 = engine.createSession({ sessionTimeout: 100000 });
            // xx console.log("Session1 = ", session1.authenticationToken.toString());
            // create session2
            session2 = engine.createSession({ sessionTimeout: 100000 });
            // xx console.log("session2 = ", session2.authenticationToken.toString());
            // create subscription
            const subscription = session1.createSubscription({
                requestedPublishingInterval: 10,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });
            const publishSpy1 = sinon.spy();

            // create monitored item
            const monitoredItem1 = add_mock_monitored_item(subscription);

            //make sure we receive initial  data
            session1.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 100 } }), publishSpy1);
            test.clock.tick(subscription.publishingInterval);

            publishSpy1.callCount.should.eql(1);
            const asn0 = publishSpy1.getCall(0).args[1].availableSequenceNumbers;
            if (doDebug) {
                console.log(publishSpy1.getCall(0).args[1].toString());
            }
            publishSpy1.getCall(0).args[1].notificationMessage.notificationData.length.should.eql(1);
            publishSpy1.resetHistory();

            // transfer subscription
            const transferResult = await engine.transferSubscription(session2, subscription.id, true);
            // the transfer result available SequenceNumber shall be ZERO at this point because 
            // we cannot validate in session2 notification that have been sent to session1
            transferResult.statusCode.should.eql(StatusCodes.Good);
            if (doDebug) {
                console.log(transferResult.toString());
            }
            //   transferResult.availableSequenceNumbers.length.should.eql(4);

            //  make sure the OLD session  a StatusChange notification
            session1.publishEngine._on_PublishRequest(new PublishRequest({
                requestHeader: {
                    requestHandle: 100,
                },
                subscriptionAcknowledgements: [{
                    sequenceNumber: asn0[0],
                    subscriptionId: subscription.id
                }]
            }), publishSpy1);

            test.clock.tick(subscription.publishingInterval);

            publishSpy1.callCount.should.eql(1);
            if (doDebug) {
                console.log(publishSpy1.getCall(0).args[1].toString());
            }
            publishSpy1.getCall(0).args[1].notificationMessage.notificationData.length.should.eql(1);
            publishSpy1.getCall(0).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy1.resetHistory();
            // 

            //  // call republish with the sequence number received above (on the first session)
            const receivedSequenceNumbers = transferResult.availableSequenceNumbers;
            if (doDebug) {
                console.log("receivedSequenceNumbers", receivedSequenceNumbers);
            }
            let retransmitSequenceNumber = receivedSequenceNumbers[0];
            if (doDebug) {
                console.log("asking republish of sequence n° : ", retransmitSequenceNumber)
            }
            let msgSequence = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);
            should(msgSequence).not.eql(null);

            await engine.closeSession(session1.authenticationToken, /*deleteSubscriptions=*/ true, /* reason =*/ "Terminated");
            await engine.closeSession(session2.authenticationToken, /*deleteSubscriptions=*/ true, /* reason =*/ "Terminated");

        });

    })

    it("ST07 - CTT 008 Test for transfer subscription", async () => {
        /* 
            A/ Create a subscription, 
            B/ make some changes,
            C/ do not acknowledge any sequence numbers
            D/ Close the session but do not delete subscription.
            E/ Create a new session, 
            F/ transfer the subscription, 
            G/ call republish(). 
         */

        await with_fake_timer.call(test, async () => {

            session1 = engine.createSession({ sessionTimeout: 100000 });
            // xx console.log("Session1 = ", session1.authenticationToken.toString());

            // A/ Create a subscription, 
            const subscription = session1.createSubscription({
                requestedPublishingInterval: 10,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });
            const publishSpy1 = sinon.spy();

            // B/ make some changes,
            const monitoredItem1 = add_mock_monitored_item(subscription);

            // server send a notification to the client
            monitoredItem1.simulateMonitoredItemAddingNotification();
            sendPublishRequest(session1, publishSpy1);
            test.clock.tick(subscription.publishingInterval);

            monitoredItem1.simulateMonitoredItemAddingNotification();
            sendPublishRequest(session1, publishSpy1);
            test.clock.tick(subscription.publishingInterval);

            monitoredItem1.simulateMonitoredItemAddingNotification();
            sendPublishRequest(session1, publishSpy1);
            test.clock.tick(subscription.publishingInterval);


            // wait for initital data to be received
            // server has now some notification ready and send them to the client
            sendPublishRequest(session1, publishSpy1);

            test.clock.tick(subscription.publishingInterval);
            test.clock.tick(subscription.publishingInterval);

            if (doDebug) {
                console.log("---------------------------------------------------- 1");
                console.log(publishSpy1.getCall(0).args[1].availableSequenceNumbers.toString());
                console.log(publishSpy1.getCall(1).args[1].availableSequenceNumbers.toString());
                console.log(publishSpy1.getCall(2).args[1].availableSequenceNumbers.toString());
            }

            publishSpy1.callCount.should.eql(3);

            const asn0 = publishSpy1.getCall(0).args[1].availableSequenceNumbers;
            asn0.length.should.eql(1);
            asn0[0].should.eql(1);

            const asn1 = publishSpy1.getCall(1).args[1].availableSequenceNumbers;
            asn1.length.should.eql(2);
            asn1.should.eql([1, 2]);

            const asn2 = publishSpy1.getCall(2).args[1].availableSequenceNumbers;
            asn2.length.should.eql(3);
            asn2.should.eql([1, 2, 3]);

            // let's assume that some notification have been send but not acknowledged yet
            publishSpy1.resetHistory();

            // D/ Close the session but do not delete subscription.
            await engine.closeSession(session1.authenticationToken, /*deleteSubscriptions=*/ false, /* reason =*/ "Terminated");

            // ------------------------------------------------------------- 
            // E/ Create a new session, 
            session2 = engine.createSession({ sessionTimeout: 100000 });
            // xx console.log("session2 = ", session2.authenticationToken.toString());

            // F/  transfer the subscription, 
            const transferResult = await engine.transferSubscription(session2, subscription.id, true);

            // the transfer result.available sequence number shall be ZERO at this point because 
            // we cannot validate in session2 notification that have been sent to session1
            transferResult.statusCode.should.eql(StatusCodes.Good);
            transferResult.availableSequenceNumbers.length.should.eql(4);

            const publishSpy2 = sinon.spy();

            sendPublishRequest(session2, publishSpy2);
            sendPublishRequest(session2, publishSpy2);

            test.clock.tick(subscription.publishingInterval);
            test.clock.tick(subscription.publishingInterval);
            publishSpy2.callCount.should.eql(1);

            if (doDebug) {
                console.log("---------------------------------------------------- 3");
                console.log(publishSpy2.getCall(0).args[1].availableSequenceNumbers.toString());
            }
            // now calling republish on old session should fail because subscription has been transfered
            let retransmitSequenceNumber = 1;
            let notificationMessage = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);
            should(notificationMessage).not.eql(null);
            // xx console.log(notificationMessage.toString());
            notificationMessage.sequenceNumber.should.eql(1);

            retransmitSequenceNumber = 2;
            notificationMessage = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);
            should(notificationMessage).not.eql(null);
            notificationMessage.sequenceNumber.should.eql(2);

            retransmitSequenceNumber = 3;
            notificationMessage = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);
            should(notificationMessage).not.eql(null);
            notificationMessage.sequenceNumber.should.eql(3);

            retransmitSequenceNumber = 4
            notificationMessage = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);
            should(notificationMessage).not.eql(null);
            notificationMessage.sequenceNumber.should.eql(4);

            await engine.closeSession(session2.authenticationToken, /*deleteSubscriptions=*/ true, /* reason =*/ "Terminated");


            await engine.shutdown();
            engine = null;
        });
    });

    it("ST08 - Err-004.js (transferSubscription5106Err009)  delete multiple sessions where some have been transferred to other sessions", async () => {

        await with_fake_timer.call(test, async () => {
            // create session1
            session1 = engine.createSession({ sessionTimeout: 100000 });
            // xx console.log("Session1 = ", session1.authenticationToken.toString());
            // create session2
            session2 = engine.createSession({ sessionTimeout: 100000 });
            //  xx console.log("session2 = ", session2.authenticationToken.toString());


            function createSubscription() {
                const subscription = session1.createSubscription({
                    requestedPublishingInterval: 10,  // Duration
                    requestedLifetimeCount: 10,         // Counter
                    requestedMaxKeepAliveCount: 10,     // Counter
                    maxNotificationsPerPublish: 10,     // Counter
                    publishingEnabled: true,            // Boolean
                    priority: 14                        // Byte
                });
                if (doDebug) {
                    console.log("subscriptionId = ", subscription.id)
                }
                return subscription;
            }
            const subscriptions = [];
            subscriptions.push(createSubscription());
            subscriptions.push(createSubscription());
            subscriptions.push(createSubscription());
            subscriptions.push(createSubscription());
            subscriptions.push(createSubscription());

            const transferResult1 = await engine.transferSubscription(session2, subscriptions[0].id, true);
            const transferResult2 = await engine.transferSubscription(session2, subscriptions[2].id, true);
            const transferResult3 = await engine.transferSubscription(session2, subscriptions[4].id, true);



            // we don't care about dataChanges, we just need to make sure a StatusChange was received.
            const publishSpy1 = sinon.spy();
            sendPublishRequest(session1, publishSpy1);
            sendPublishRequest(session1, publishSpy1);
            sendPublishRequest(session1, publishSpy1);
            publishSpy1.callCount.should.eql(3);

            test.clock.tick(subscriptions[0].publishingInterval);

            publishSpy1.getCall(0).args[1].subscriptionId.should.eql(subscriptions[0].id);
            publishSpy1.getCall(0).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy1.getCall(1).args[1].subscriptionId.should.eql(subscriptions[2].id);
            publishSpy1.getCall(1).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy1.getCall(2).args[1].subscriptionId.should.eql(subscriptions[4].id);
            publishSpy1.getCall(2).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");

            if (doDebug) {

                console.log(publishSpy1.getCall(0).args[1].toString());
                console.log(publishSpy1.getCall(1).args[1].toString());
                console.log(publishSpy1.getCall(2).args[1].toString());
            }
            // Now delete all the subscriptions. Some should succeed and some should fail
            (await session1.deleteSubscription(subscriptions[0].id)).should.eql(StatusCodes.BadSubscriptionIdInvalid);
            (await session1.deleteSubscription(subscriptions[1].id)).should.eql(StatusCodes.Good);
            (await session1.deleteSubscription(subscriptions[2].id)).should.eql(StatusCodes.BadSubscriptionIdInvalid);
            (await session1.deleteSubscription(subscriptions[3].id)).should.eql(StatusCodes.Good);
            (await session1.deleteSubscription(subscriptions[4].id)).should.eql(StatusCodes.BadSubscriptionIdInvalid);


            await engine.closeSession(session1.authenticationToken, /*deleteSubscriptions=*/ true, /* reason =*/ "Terminated");
            await engine.closeSession(session2.authenticationToken, /*deleteSubscriptions=*/ true, /* reason =*/ "Terminated");

        });

    });

    it("ST09 - 0115.js (subscriptionTransfer015) Transfer to session 2 then back to session 1", async () => {
        /*
            Description:
                Create 2 sessions.
                Create 1 subscription monitoring 1 or more items.
                Call Publish() (#1) on session #1.
                Transfer the subscription to the other session (SendInitialValues=TRUE).
                Call Publish() (#2) on session #2.
                Transfer the subscription to the other session (SendInitialValues=TRUE).
                Call Publish() (#3) on session #1.
            Expectation:    
               x Session created successfully.
               x Subscription setup without error.
               x Publish #1 receives the initial data change.
                Transfer is successful.
                Publish #2 yields the initial data change.
                Transfer is successful.
                Publish #3 yields the initial data change.
                Note: We assume that the server purges the prior StatusChange notification message that was in the queue.
         */
        await with_fake_timer.call(test, async () => {
            // Create 2 sessions.

            session1 = engine.createSession({ sessionTimeout: 100000 });
            session2 = engine.createSession({ sessionTimeout: 100000 });

            // Create 1 subscription monitoring 1 or more items.
            const subscription = session1.createSubscription({
                requestedPublishingInterval: 10,  // Duration
                requestedLifetimeCount: 10,         // Counter
                requestedMaxKeepAliveCount: 10,     // Counter
                maxNotificationsPerPublish: 10,     // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            });
            const monitoredItem1 = add_mock_monitored_item(subscription);

            // Call Publish()(#1) on session #1.
            const publishSpy1 = sinon.spy();
            sendPublishRequest(session1, publishSpy1);
            test.clock.tick(subscription.publishingInterval);

            publishSpy1.callCount.should.eql(1);
            const publishResponse1 = publishSpy1.getCall(0).args[1];
            publishResponse1.notificationMessage.notificationData.length.should.eql(1);
            publishResponse1.notificationMessage.notificationData[0].constructor.name.should.eql("DataChangeNotification")
            publishSpy1.resetHistory();

            // Transfer the subscription to the other session(SendInitialValues = TRUE).
            // F/  transfer the subscription, 
            const transferResult1 = await engine.transferSubscription(session2, subscription.id, true);
            transferResult1.statusCode.should.eql(StatusCodes.Good);

            // Call Publish()(#2) on session #2.
            const publishSpy2 = sinon.spy();
            sendPublishRequest(session2, publishSpy2);
            test.clock.tick(subscription.publishingInterval);

            publishSpy2.callCount.should.eql(1);
            const publishResponse2 = publishSpy2.getCall(0).args[1];
            publishResponse2.notificationMessage.notificationData.length.should.eql(1);
            publishResponse2.notificationMessage.notificationData[0].constructor.name.should.eql("DataChangeNotification")
            publishSpy2.resetHistory();

            // Transfer the subscription to the other session(SendInitialValues = TRUE).
            const transferResult2 = await engine.transferSubscription(session1, subscription.id, true);
            transferResult2.statusCode.should.eql(StatusCodes.Good);

            // Call Publish()(#3) on session #1.
            sendPublishRequest(session1, publishSpy1);
            test.clock.tick(subscription.publishingInterval);

            publishSpy1.callCount.should.eql(1);
            const publishResponse3 = publishSpy1.getCall(0).args[1];
            publishResponse3.notificationMessage.notificationData.length.should.eql(1);
            if (doDebug) {

                console.log(publishResponse3.toString());
            }
            publishResponse3.notificationMessage.notificationData[0].constructor.name.should.eql("DataChangeNotification")

            await engine.closeSession(session1.authenticationToken, /*deleteSubscriptions=*/ true, /* reason =*/ "Terminated");
            await engine.closeSession(session2.authenticationToken, /*deleteSubscriptions=*/ true, /* reason =*/ "Terminated");

        });

    })

});
