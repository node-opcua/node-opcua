var should =require("should");
var sinon = require("sinon");

var subscription_service = require("../../lib/services/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var StatusCodes = require("../../lib/datamodel/opcua_status_code").StatusCodes;
var Subscription = require("../../lib/server/subscription").Subscription;

var TimestampsToReturn = require("../../lib/services/read_service").TimestampsToReturn;
var MonitoredItem = require("../../lib/server/monitored_item").MonitoredItem;

var MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;

var DataType = require("../../lib/datamodel/variant").DataType;
var DataValue = require("../../lib/datamodel/datavalue").DataValue;
var Variant = require("../../lib/datamodel/variant").Variant;
var dump = require("../../lib/utils").dump;



describe("Subscriptions and MonitoredItems", function () {

    beforeEach(function () {
       this.clock = sinon.useFakeTimers();
    });
    afterEach(function () {
       this.clock.restore();
    });

    it("a subscription should accept monitored item",function(done){

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20
        });


        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {

            },
            monitoringMode: subscription_service.MonitoringMode.Reporting,

            requestedParameters: {
                queueSize: 10,
                samplingInterval: 10
            }
        });

        subscription.monitoredItemCount.should.eql(0);

        var monitoredItemCreateResult = subscription.createMonitoredItem(TimestampsToReturn.Both,monitoredItemCreateRequest);

        //xx require("../../lib/utils").dump(monitoredItemCreateResult);
        subscription.monitoredItemCount.should.eql(1);

        monitoredItemCreateResult.should.be.instanceOf(subscription_service.MonitoredItemCreateResult);

        monitoredItemCreateResult.monitoredItemId.should.eql(1);
        monitoredItemCreateResult.revisedSamplingInterval.should.eql(10);


        subscription.on("terminated",function(){
            done();
            // monitored Item shall be deleted at this stage
            subscription.monitoredItemCount.should.eql(0);
        });
        subscription.terminate();

    });


    it("a subscription should collect monitored item notification with collectDataChangeNotification",function(done){

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20
        });


        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {
            },
            monitoringMode: subscription_service.MonitoringMode.Reporting,
            requestedParameters: {
                queueSize: 10,
                samplingInterval: 100
            }
        });

        var monitoredItemCreateResult = subscription.createMonitoredItem(TimestampsToReturn.Both,monitoredItemCreateRequest);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

        // at first, collectDataChangeNotification  should collect nothing
        var notification = subscription.collectDataChangeNotification();
        should(notification).equal(null);

        // now simulate some data change
        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 1000});

        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 1001});
        monitoredItem.queue.length.should.eql(2);

        // then, collectDataChangeNotification  should collect at least 2 values
        notification = subscription.collectDataChangeNotification();
        notification.monitoredItems.length.should.eql(2);
        notification.monitoredItems[0].clientHandle.should.eql(monitoredItem.clientHandle);

        subscription.on("terminated",function(){
            done();
        });
        subscription.terminate();

    });

    it("a subscription should collect monitored item notification at publishing interval",function(done){

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20
        });

        // let spy the notifications event handler
        var spy_notification_event = new sinon.spy();
        subscription.on("notification",spy_notification_event);

        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {
            },
            monitoringMode: subscription_service.MonitoringMode.Reporting,
            requestedParameters: {
                clientHandle: 123,
                queueSize: 10,
                samplingInterval: 100
            }
        });

        var monitoredItemCreateResult = subscription.createMonitoredItem(TimestampsToReturn.Both,monitoredItemCreateRequest);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

        // now simulate some data change
        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 1000});
        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 1001});
        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 1002});
        monitoredItem.queue.length.should.eql(3);

        this.clock.tick(800);
        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem.queue.length.should.eql(0);

        //xx dump(subscription._pending_notifications);

        // now let the subscription send a PublishResponse to the client
        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 2000});
        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 2001});
        this.clock.tick(100);
        monitoredItem.recordValue({ dataType: DataType.UInt32 , value: 2002});
        monitoredItem.queue.length.should.eql(3);
        this.clock.tick(800);

        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem.queue.length.should.eql(0);

        spy_notification_event.callCount.should.be.greaterThan(3);


        subscription.on("terminated",function(){
            done();
        });
        subscription.terminate();

    });
});
