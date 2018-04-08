"use strict";


const MonitoredItem = require("../src/monitored_item").MonitoredItem;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const subscription_service = require("node-opcua-service-subscription");
const MonitoringMode = subscription_service.MonitoringMode;
const MonitoringParameters = subscription_service.MonitoringParameters;

const read_service = require("node-opcua-service-read");
const TimestampsToReturn = read_service.TimestampsToReturn;

const DataType = require("node-opcua-variant").DataType;
const DataValue =  require("node-opcua-data-value").DataValue;
const Variant = require("node-opcua-variant").Variant;

const sinon = require("sinon");
const should = require("should");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Server Side MonitoredItem", function () {


    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("should create a MonitoredItem", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 1000,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50

        });

        monitoredItem.clientHandle.should.eql(1);
        monitoredItem.samplingInterval.should.eql(1000);
        monitoredItem.discardOldest.should.eql(true);
        monitoredItem.queueSize.should.eql(100);
        monitoredItem.queue.should.eql([]);
        monitoredItem.monitoredItemId.should.eql(50);

        monitoredItem.isSampling.should.eql(false);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("a MonitoredItem should trigger a read event according to sampling interval in Reporting mode", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle:       1,
            samplingInterval: 100,
            discardOldest:    true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.isSampling.should.eql(false);

        // set up a spying samplingFunc
        const spy_samplingEventCall = sinon.spy(function(oldValue,callback){
            callback(null, new DataValue({value: {}}));
        });
        monitoredItem.samplingFunc = spy_samplingEventCall;

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        monitoredItem.isSampling.should.eql(true);

        this.clock.tick(2000);

        spy_samplingEventCall.callCount.should.be.greaterThan(6,"we should have been sampling");

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("a MonitoredItem should enqueue a new value and store it in a queue", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.queue.length.should.eql(0);

        const dataValue = new DataValue({value: {dataType: DataType.UInt32, value: 1000}});

        monitoredItem._enqueue_value(dataValue);

        monitoredItem.queue.length.should.eql(1);
        monitoredItem.terminate();
        monitoredItem.dispose();
        done();

    });

    it("a MonitoredItem should discard old value from the queue when discardOldest is true", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true, // <= discard oldest !
            queueSize: 2,         // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.queue.length.should.eql(0);


        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.value.should.eql(1000);
        monitoredItem.queue[1].value.value.value.should.eql(1001);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.value.should.eql(1001);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.GoodWithOverflowBit);
        monitoredItem.queue[1].value.value.value.should.eql(1002);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.overflow.should.eql(true);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("a MonitoredItem should discard last value when queue is full when discardOldest is false , and set the overflow bit", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: false, // <= discard oldest !
            queueSize: 2,         // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.value.should.eql(1000);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.value.value.should.eql(1001);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.value.should.eql(1000);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.value.value.should.eql(1002);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.GoodWithOverflowBit);
        monitoredItem.overflow.should.eql(true);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("should set timestamp to the recorded value without timestamp (variation 1)", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 2,  // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50,
            timestampsToReturn: TimestampsToReturn.Both
        });

        const now = new Date();

        monitoredItem._enqueue_value(new DataValue({
            value: {dataType: DataType.UInt32, value: 1000},
            serverTimestamp: now,
            sourceTimestamp: now
        }));

        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.serverTimestamp.should.eql(now);
        monitoredItem.queue[0].value.sourceTimestamp.should.eql(now);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    // #21
    it("should set timestamp to the recorded value with a given sourceTimestamp (variation 2)", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 2,  // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50,
            timestampsToReturn: TimestampsToReturn.Both
        });

        this.clock.tick(100);
        const now = new Date();

        const sourceTimestamp = new Date(Date.UTC(2000, 0, 1));
        sourceTimestamp.setMilliseconds(100);
        const picoseconds = 456;

        monitoredItem._enqueue_value(new DataValue({
            value: {dataType: DataType.UInt32, value: 1000},
            sourceTimestamp: sourceTimestamp,
            sourcePicoseconds: picoseconds,
            serverTimestamp: now
        }));

        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.serverTimestamp.should.eql(now);

        monitoredItem.queue[0].value.sourceTimestamp.should.eql(sourceTimestamp);
        monitoredItem.queue[0].value.sourcePicoseconds.should.eql(picoseconds);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();

    });

    function install_spying_samplingFunc() {
        let sample_value=0;
        const spy_samplingEventCall = sinon.spy(function(oldValue,callback){
            sample_value++;
            const dataValue = new DataValue({value: {dataType: DataType.UInt32, value: sample_value}});
            callback(null,dataValue);
        });
        return spy_samplingEventCall;
    }

    it("a MonitoredItem should trigger a read event according to sampling interval", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });

        // set up spying samplingFunc
        monitoredItem.samplingFunc = install_spying_samplingFunc();

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        // wait 2 x samplingInterval

        this.clock.tick(180);
        monitoredItem.samplingFunc.callCount.should.eql(2);

        this.clock.tick(200);
        monitoredItem.samplingFunc.callCount.should.eql(4);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();

    });

    it("a MonitoredItem should not trigger any read event after terminate has been called", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.samplingFunc = install_spying_samplingFunc();

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        this.clock.tick(2000);
        monitoredItem.samplingFunc.callCount.should.be.greaterThan(6);

        const nbCalls = monitoredItem.samplingFunc.callCount;

        monitoredItem.terminate();

        this.clock.tick(2000);
        monitoredItem.samplingFunc.callCount.should.eql(nbCalls);


        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify should cap queue size", function (done) {


        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(null, new MonitoringParameters({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 0xFFFFF
        }));

        result.revisedSamplingInterval.should.eql(100);
        result.revisedQueueSize.should.not.eql(0xFFFFF);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify should cap samplingInterval", function (done) {

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });


        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(null, new MonitoringParameters({
            clientHandle: 1,
            samplingInterval: 0,
            discardOldest: true,
            queueSize: 10
        }));


        // setting
        result.revisedSamplingInterval.should.eql(50);

        result = monitoredItem.modify(null, new MonitoringParameters({
            clientHandle: 1,
            samplingInterval: 1,
            discardOldest: true,
            queueSize: 10
        }));

        result.revisedSamplingInterval.should.not.eql(1);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });


    it("MonitoredItem#modify : changing queue size from 2 to 1 when queue is full, should trim queue (discardOldest=true)",function(done){

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 2,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);


        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000,1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1001,1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.GoodWithOverflowBit);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(null, new MonitoringParameters({
            clientHandle: 1,
            samplingInterval: 0,
            discardOldest: true,
            queueSize: 1
        }));
        result.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queueSize.should.eql(1);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify : changing queue size from 2 to 1 when queue is full, should trim queue (discardOldest=false)",function(done){

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 2,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000]);


        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000,1001]);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000,1002]);

        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.hasOverflowBit.should.equal(true);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(null, new MonitoringParameters({
            clientHandle: 1,
            samplingInterval: 0,
            discardOldest: false,
            queueSize: 1
        }));
        result.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queueSize.should.eql(1);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.hasOverflowBit.should.equal(false);
//xx        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });


    it("MonitoredItem#modify : changing queue size from 4 to 2 when queue is full, should trim queue (discardOldest=false)",function(done){

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.queueSize.should.eql(4);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000]);


        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000,1001]);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(3);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000,1001,1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[2].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1003}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(4);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000,1001,1002,1003]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[2].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[3].value.statusCode.should.eql(StatusCodes.Good);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(null, new MonitoringParameters({
            clientHandle: 1,
            samplingInterval: 0,
            discardOldest: false,
            queueSize: 2
        }));
        result.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000,1003]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoringItem#setMonitoringMode : setting the mode to DISABLED should cause all queued Notifications to be deleted",function() {

        // OPCUA 1.03 part 4 : $5.12.4
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 2,
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.samplingFunc =function(oldvalue,callback) {};

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1001,1002]);

        monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("should set the OverflowBit as specified in the example in specification - Fig 17 Queue overflow handling    ",function() {
        // OPC Specification 1.03 part 4 page 60 - Figure 17
        const monitoredItemT = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        function q(monitoredItem) {
            return monitoredItem.queue.map(function(a) { return a.value.value.value;});
        }
        function f(monitoredItem) {
            return monitoredItem.queue.map(function(a) { return !!(a.value.statusCode.value === StatusCodes.GoodWithOverflowBit.value);});
        }
        const o = false; const X = true;

        monitoredItemT._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1}}));
        q(monitoredItemT).should.eql([1]);
        f(monitoredItemT).should.eql([o]);

        monitoredItemT._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 2}}));
        q(monitoredItemT).should.eql([1,2]);
        f(monitoredItemT).should.eql([o,o]);

        monitoredItemT._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 3}}));
        q(monitoredItemT).should.eql([1,2,3]);
        f(monitoredItemT).should.eql([o,o,o]);

        monitoredItemT._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 4}}));
        q(monitoredItemT).should.eql([1,2,3,4]);
        f(monitoredItemT).should.eql([o,o,o,o]);

        monitoredItemT._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 5}}));
        q(monitoredItemT).should.eql([2,3,4,5]);
        f(monitoredItemT).should.eql([X,o,o,o]);

        monitoredItemT._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 6}}));
        q(monitoredItemT).should.eql([3,4,5,6]);
        f(monitoredItemT).should.eql([X,o,o,o]);

        const monitoredItemF = new MonitoredItem({
            clientHandle: 2,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItemF._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1}}));
        q(monitoredItemF).should.eql([1]);
        f(monitoredItemF).should.eql([o]);
        monitoredItemF._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 2}}));
        q(monitoredItemF).should.eql([1,2]);
        f(monitoredItemF).should.eql([o,o]);
        monitoredItemF._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 3}}));
        q(monitoredItemF).should.eql([1,2,3]);
        f(monitoredItemF).should.eql([o,o,o]);
        monitoredItemF._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 4}}));
        q(monitoredItemF).should.eql([1,2,3,4]);
        f(monitoredItemF).should.eql([o,o,o,o]);
        monitoredItemF._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 5}}));
        q(monitoredItemF).should.eql([1,2,3,5]);
        f(monitoredItemF).should.eql([o,o,o,X]);
        monitoredItemF._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 6}}));
        q(monitoredItemF).should.eql([1,2,3,6]);
        f(monitoredItemF).should.eql([o,o,o,X]);

        monitoredItemF.terminate();
        monitoredItemF.dispose();

        monitoredItemT.terminate();
        monitoredItemT.dispose();

    });

    it("StatusCode.Overflow bit should not be set when queuesize is 1. (discardOldest === true)",function(done){

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.queueSize.should.eql(1);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);


        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("StatusCode.Overflow bit should not be set when queuesize is 1. (discardOldest === false)",function(done){

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.queueSize.should.eql(1);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);


        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map(function(a) { return a.value.value.value;}).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });


});

const DataChangeFilter = subscription_service.DataChangeFilter;
const DataChangeTrigger = subscription_service.DataChangeTrigger;
const DeadbandType = subscription_service.DeadbandType;

describe("MonitoredItem with DataChangeFilter", function () {


    const dataValue1 = new DataValue({statusCode: StatusCodes.Good, value: {dataType:"UInt16", value: 48}});
    const dataValue2 = new DataValue({statusCode: StatusCodes.Good, value: {dataType:"UInt16", value: 49}}); // +1 =>
    const dataValue3 = new DataValue({statusCode: StatusCodes.GoodWithOverflowBit, value: {dataType:"UInt16", value: 49}});
    const dataValue4 = new DataValue({statusCode: StatusCodes.Good, value: {dataType:"UInt16", value: 49}});
    const dataValue5 = new DataValue({statusCode: StatusCodes.Good, value: {dataType:"UInt16", value: 49}});
    //
    const dataValue6 = new DataValue({statusCode: StatusCodes.Good, value: {dataType:"UInt16", value: 59}}); // +10
    const dataValue7 = new DataValue({statusCode: StatusCodes.Good, value: {dataType:"UInt16", value: 60}}); // +1
    const dataValue8 = new DataValue({statusCode: StatusCodes.Good, value: {dataType:"UInt16", value: 10}}); // -50

    it("should only detect status change when dataChangeFilter trigger is DataChangeTrigger.Status ", function () {


        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.Status,
            deadbandType: DeadbandType.None
        });

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.queue.length.should.eql(0);

        monitoredItem.recordValue(dataValue1);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.should.eql(dataValue1);

        monitoredItem.recordValue(dataValue2);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.should.eql(dataValue1);

        monitoredItem.recordValue(dataValue3);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[1].value.should.eql(dataValue3);

        monitoredItem.recordValue(dataValue4);
        monitoredItem.queue.length.should.eql(3);
        monitoredItem.queue[2].value.should.eql(dataValue4);
        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("XXX should detect status change & value change when dataChangeFilter trigger is DataChangeTrigger.StatusValue ", function () {

        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.None
        });

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.queue.length.should.eql(0);

        monitoredItem.recordValue(dataValue1);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.should.eql(dataValue1);

        monitoredItem.recordValue(dataValue2);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[1].value.should.eql(dataValue2);

        monitoredItem.recordValue(dataValue3);
        monitoredItem.queue.length.should.eql(3);
        monitoredItem.queue[2].value.should.eql(dataValue3);

        monitoredItem.recordValue(dataValue4);
        monitoredItem.queue.length.should.eql(4);
        monitoredItem.queue[3].value.should.eql(dataValue4);

        monitoredItem.recordValue(dataValue5);
        monitoredItem.queue.length.should.eql(4);
        monitoredItem.queue[3].value.should.eql(dataValue4);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("should detect status change & value change when dataChangeFilter trigger is DataChangeTrigger.StatusValue and deadband is 8", function () {

        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Absolute,
            deadbandValue: 8
        });

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.queue.length.should.eql(0);

        monitoredItem.recordValue(dataValue1);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.should.eql(dataValue1);

        // 48-> 49 no record
        monitoredItem.recordValue(dataValue2);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.should.eql(dataValue1);

        // 48-> 49  + statusChange => Record
        monitoredItem.recordValue(dataValue3);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[1].value.should.eql(dataValue3);

        // 49-> 49  + statusChange => Record
        monitoredItem.recordValue(dataValue4);
        monitoredItem.queue.length.should.eql(3);
        monitoredItem.queue[2].value.should.eql(dataValue4);

        // 49-> 49  + no statusChange => No Record
        monitoredItem.recordValue(dataValue5);
        monitoredItem.queue.length.should.eql(3);
        monitoredItem.queue[2].value.should.eql(dataValue4);

        // 49-> 59  + no statusChange => No Record
        dataValue6.value.value.should.eql(59);
        monitoredItem.recordValue(dataValue6);
        monitoredItem.queue.length.should.eql(4);
        monitoredItem.queue[3].value.should.eql(dataValue6);

        monitoredItem.recordValue(dataValue7);
        monitoredItem.queue.length.should.eql(4);
        monitoredItem.queue[3].value.should.eql(dataValue6);

        monitoredItem.recordValue(dataValue8);
        monitoredItem.queue.length.should.eql(5);
        monitoredItem.queue[4].value.should.eql(dataValue8);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("should detect status change & value change when dataChangeFilter trigger is DataChangeTrigger.StatusValue and deadband is 20%", function () {

        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Percent, // percentage of the EURange
            // see part 8
            deadbandValue: 10
        });

        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.terminate();
        monitoredItem.dispose();
    });
});
