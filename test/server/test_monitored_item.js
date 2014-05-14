
var MonitoredItem = require("../../lib/server/monitored_item").MonitoredItem;
var DataType = require("../../lib/datamodel/variant").DataType;
var DataValue = require("../../lib/datamodel/datavalue").DataValue;
var Variant = require("../../lib/datamodel/variant").Variant;

var sinon = require("sinon");
var should = require("should");

describe("Server Side MonitoredItem",function(){

    beforeEach(function(){
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function(){
        this.clock.restore();
    });

    it("should create a MonitoredItem",function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 1000,
            discardOldest: true,
            queueSize: 100
        });

        monitoredItem.clientHandle.should.eql(1);
        monitoredItem.samplingInterval.should.eql(1000);
        monitoredItem.discardOldest.should.eql(true);
        monitoredItem.queueSize.should.eql(100);
        monitoredItem.queue.should.eql([]);

        done();
    });

    it("a MonitoredItem should trigger a read event according to sampling interval",function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        });

        monitoredItem.oldValue = new Variant({dataType: DataType.UInt32, value: 42});
        var spy_samplingEventCall = new sinon.spy();
        monitoredItem.on("samplingEvent",spy_samplingEventCall);

        this.clock.tick(2000);
        spy_samplingEventCall.callCount.should.be.greaterThan(6);

        done();
    });

    it("a MonitoredItem should record a new value and store it in a queue",function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        });

        monitoredItem.queue.length.should.eql(0);
        this.clock.tick(2000);
        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1000 });
        monitoredItem.queue.length.should.eql(1);

        done();
    });

    it("a MonitoredItem should discard old value from the queue when discardOldest is true",function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true, // <= discard oldest !
            queueSize: 2         // <=== only 2 values in queue
        });

        monitoredItem.queue.length.should.eql(0);
        this.clock.tick(100);
        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1000 });
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.overflow.should.eql(false);

        this.clock.tick(100);
        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1001 });
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.should.eql(1000);
        monitoredItem.queue[1].value.value.should.eql(1001);
        monitoredItem.overflow.should.eql(false);

        this.clock.tick(100);
        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1002 });
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.should.eql(1001);
        monitoredItem.queue[1].value.value.should.eql(1002);
        monitoredItem.overflow.should.eql(true);

        done();
    });

    it("a MonitoredItem should not accept new value when queue is full when discardOldest is false",function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: false, // <= discard oldest !
            queueSize: 2         // <=== only 2 values in queue
        });

        monitoredItem.queue.length.should.eql(0);
        this.clock.tick(100);
        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1000 });
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.overflow.should.eql(false);

        this.clock.tick(100);
        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1001 });
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.should.eql(1000);
        monitoredItem.queue[1].value.value.should.eql(1001);
        monitoredItem.overflow.should.eql(false);

        this.clock.tick(100);
        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1002 });
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.should.eql(1000);
        monitoredItem.queue[1].value.value.should.eql(1001);
        monitoredItem.overflow.should.eql(true);

        done();
    });


    it("should set timestamp to the recorded value", function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 2  // <=== only 2 values in queue
        });

        this.clock.tick(100);
        var now = new Date();

        monitoredItem.recordValue({dataType: DataType.UInt32, value: 1000 });

        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].serverTimestamp.should.eql(now);
        monitoredItem.queue[0].sourceTimestamp.should.eql(now);

        done();
    });


    it("a MonitoredItem should trigger a read event according to sampling interval",function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        });

        var sample_value = 1;
        monitoredItem.on("samplingEvent",function(oldValue){
            sample_value ++;
            // read new value
            // check if different enough from old Value
            // if different enough : call recordValue
            this.recordValue({ dataType: DataType.UInt32,value: sample_value });
        });

        this.clock.tick(200);

        done();
    });

    it("a MonitoredItem should not trigger any read event after terminate has been called",function(done){

        var monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        });

        var spy_samplingEventCall = new sinon.spy();
        monitoredItem.on("samplingEvent",spy_samplingEventCall);

        this.clock.tick(2000);
        spy_samplingEventCall.callCount.should.be.greaterThan(6);
        var nbCalls = spy_samplingEventCall.callCount;

        monitoredItem.terminate();
        this.clock.tick(2000);
        spy_samplingEventCall.callCount.should.eql(nbCalls);

        done();
    });


});
