var should =require("should");
var sinon = require("sinon");

var subscription_service = require("../../lib/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var Subscription = require("../../lib/server/subscription").Subscription;

var TimestampsToReturn = require("../../lib/read_service").TimestampsToReturn;
var MonitoredItem = require("../../lib/server/monitored_item").MonitoredItem;

var MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;

var DataType = require("../../lib/variant").DataType;
var DataValue = require("../../lib/datavalue").DataValue;
var Variant = require("../../lib/variant").Variant;



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


    it("a subscription should collect monitored item notification at publishing interval",function(done){

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20
        });


        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {

            },
            monitoringMode: subscription_service.MonitoringMode.Reporting,

            requestedParameters: {
                samplingInterval: 100
            }
        });
        var monitoredItemCreateResult = subscription.createMonitoredItem(TimestampsToReturn.Both,monitoredItemCreateRequest);

        this.clock.tick(2000);
        subscription.on("notifications",function(notifications){

        });

        subscription.on("terminated",function(){
            done();
        });
        subscription.terminate();

    });
});
