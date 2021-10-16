/* eslint-disable max-statements */
"use strict";

const util = require("util");
const { EventEmitter } = require("events");

const sinon = require("sinon");
const should = require("should");

const { StatusCodes } = require("node-opcua-status-code");
const {
    MonitoringMode,
    MonitoringParameters,
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType
} = require("node-opcua-service-subscription");
const { NodeClass } = require("node-opcua-data-model");
const { makeNodeId } = require("node-opcua-nodeid");
const { TimestampsToReturn } = require("node-opcua-service-read");

const { DataType, Variant } = require("node-opcua-variant");
const { DataValue } = require("node-opcua-data-value");
const { Range } = require("node-opcua-types");

const { MonitoredItem } = require("..");

function q(monitoredItem) {
    return monitoredItem.queue.map(function (a) {
        return a.value.value.value;
    });
}
const o = false;
const X = true;

function f(monitoredItem) {
    return monitoredItem.queue.map(function (a) {
        return !!(a.value.statusCode.value != StatusCodes.Good.value);
    });
}
class FakeNode {
    constructor() {
        this.nodeId = makeNodeId(32);
        this.browseName = { name: "toto" };
        this._euRange = {
            nodeClass: NodeClass.Variable,
            readValue() {
                return new DataValue({
                    statusCode: StatusCodes.Good,
                    value: new Variant({
                        dataType: DataType.ExtensionObject,
                        value: new Range({ low: -100, high: 100 })
                    })
                });
            }
        };
    }
    readAttribute(context, attributeId) {
        return new DataValue({ statusCode: StatusCodes.BadInvalidArgument });
    }
    getChildByName(name) {
        name.should.eql("EURange");
        return this._euRange;
    }
}
util.inherits(FakeNode, EventEmitter);
const fakeNode = new FakeNode();

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Server Side MonitoredItem", () => {
    beforeEach(() => {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        this.clock.restore();
    });

    it("should create a MonitoredItem", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 1000,

            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.setNode(fakeNode);

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

    it("MI1 - a MonitoredItem should trigger a read event according to sampling interval in Reporting mode", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,

            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.setNode(fakeNode);

        monitoredItem.isSampling.should.eql(false);

        // set up a spying samplingFunc
        const spy_samplingEventCall = sinon.spy(function (oldValue, callback) {
            callback(null, new DataValue({ value: {} }));
        });
        monitoredItem.samplingFunc = spy_samplingEventCall;

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        this.clock.tick(10); // monitored mode is set with a slight delay

        monitoredItem.isSampling.should.eql(true);

        this.clock.tick(2000);

        spy_samplingEventCall.callCount.should.be.greaterThan(6, "we should have been sampling");

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MI2 - a MonitoredItem should enqueue a new value and store it in a queue", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,

            // added by the server:
            monitoredItemId: 50
        });

        monitoredItem.setNode(fakeNode);

        monitoredItem.queue.length.should.eql(0);

        const dataValue = new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } });

        monitoredItem._enqueue_value(dataValue);

        monitoredItem.queue.length.should.eql(1);
        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("a MonitoredItem should discard old value from the queue when discardOldest is true", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true, // <= discard oldest !
            queueSize: 2, // <=== only 2 values in queue
            samplingInterval: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.value.should.eql(1000);
        monitoredItem.queue[1].value.value.value.should.eql(1001);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
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

    it("a MonitoredItem should discard last value when queue is full when discardOldest is false , and set the overflow bit", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: false, // <= discard oldest !
            queueSize: 2, // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue[0].value.value.value.should.eql(1000);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.value.value.should.eql(1001);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.overflow.should.eql(false);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
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

    it("should set timestamp to the recorded value without timestamp (variation 1)", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 2, // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50,
            timestampsToReturn: TimestampsToReturn.Both
        });
        monitoredItem.setNode(fakeNode);

        const now = new Date();

        monitoredItem._enqueue_value(
            new DataValue({
                value: { dataType: DataType.UInt32, value: 1000 },
                serverTimestamp: now,
                sourceTimestamp: now
            })
        );

        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.serverTimestamp.should.eql(now);
        monitoredItem.queue[0].value.sourceTimestamp.should.eql(now);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    // #21
    it("should set timestamp to the recorded value with a given sourceTimestamp (variation 2)", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 2, // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50,
            timestampsToReturn: TimestampsToReturn.Both
        });
        monitoredItem.setNode(fakeNode);

        this.clock.tick(100);
        const now = new Date();

        const sourceTimestamp = new Date(Date.UTC(2000, 0, 1));
        sourceTimestamp.setMilliseconds(100);
        const picoseconds = 456;

        monitoredItem._enqueue_value(
            new DataValue({
                value: { dataType: DataType.UInt32, value: 1000 },
                sourceTimestamp: sourceTimestamp,
                sourcePicoseconds: picoseconds,
                serverTimestamp: now
            })
        );

        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue[0].value.serverTimestamp.should.eql(now);

        monitoredItem.queue[0].value.sourceTimestamp.should.eql(sourceTimestamp);
        monitoredItem.queue[0].value.sourcePicoseconds.should.eql(picoseconds);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    function install_spying_samplingFunc() {
        let sample_value = 0;
        const spy_samplingEventCall = sinon.spy(function (oldValue, callback) {
            sample_value++;
            const dataValue = new DataValue({ value: { dataType: DataType.UInt32, value: sample_value } });
            callback(null, dataValue);
        });
        return spy_samplingEventCall;
    }

    it("a MonitoredItem should trigger a read event according to sampling interval", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

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

    it("a MonitoredItem should not trigger any read event after terminate has been called", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

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

    it("MonitoredItem#modify should cap queue size", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(
            null,
            new MonitoringParameters({
                clientHandle: 1,
                samplingInterval: 100,
                discardOldest: true,
                queueSize: 0xfffff
            })
        );

        result.revisedSamplingInterval.should.eql(100);
        result.revisedQueueSize.should.not.eql(0xfffff);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify should cap samplingInterval", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(
            null,
            new MonitoringParameters({
                clientHandle: 1,
                discardOldest: true,
                queueSize: 10,
                samplingInterval: 0
            })
        );

        // setting
        result.revisedSamplingInterval.should.eql(50);

        result = monitoredItem.modify(
            null,
            new MonitoringParameters({
                clientHandle: 1,
                discardOldest: true,
                queueSize: 10,
                samplingInterval: 1
            })
        );

        result.revisedSamplingInterval.should.not.eql(1);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify : changing queue size from 2 to 1 when queue is full, should trim queue (discardOldest=true)", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 2,
            samplingInterval: 10,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000, 1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1001, 1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.GoodWithOverflowBit);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(
            null,
            new MonitoringParameters({
                clientHandle: 1,
                discardOldest: true,
                queueSize: 1,
                samplingInterval: 0
            })
        );
        result.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queueSize.should.eql(1);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify : changing queue size from 2 to 1 when queue is full, should trim queue (discardOldest=false)", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 2,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000, 1001]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000, 1002]);

        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.hasOverflowBit.should.equal(true);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(
            null,
            new MonitoringParameters({
                clientHandle: 1,
                samplingInterval: 0,
                discardOldest: false,
                queueSize: 1
            })
        );
        result.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queueSize.should.eql(1);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.hasOverflowBit.should.equal(false);
        //xx        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify : changing queue size from 4 to 2 when queue is full, should trim queue (discardOldest=false)", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(4);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000, 1001]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(3);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000, 1001, 1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[2].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1003 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(4);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000, 1001, 1002, 1003]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[2].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[3].value.statusCode.should.eql(StatusCodes.Good);

        let result; // MonitoredItemModifyResult
        result = monitoredItem.modify(
            null,
            new MonitoringParameters({
                clientHandle: 1,
                samplingInterval: 0,
                discardOldest: false,
                queueSize: 2
            })
        );
        result.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000, 1003]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoringItem#setMonitoringMode : setting the mode to DISABLED should cause all queued Notifications to be deleted", function () {
        // OPCUA 1.03 part 4 : $5.12.4
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 2,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.samplingFunc = function (oldvalue, callback) {
            /** */
        };

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1001, 1002]);

        monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("should set the OverflowBit as specified in the example in specification - Fig 17 Queue overflow handling    ", function () {
        // OPC Specification 1.03 part 4 page 60 - Figure 17
        const monitoredItemT = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItemT.setNode(fakeNode);

        monitoredItemT._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1 } }));
        q(monitoredItemT).should.eql([1]);
        f(monitoredItemT).should.eql([o]);

        monitoredItemT._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 2 } }));
        q(monitoredItemT).should.eql([1, 2]);
        f(monitoredItemT).should.eql([o, o]);

        monitoredItemT._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 3 } }));
        q(monitoredItemT).should.eql([1, 2, 3]);
        f(monitoredItemT).should.eql([o, o, o]);

        monitoredItemT._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 4 } }));
        q(monitoredItemT).should.eql([1, 2, 3, 4]);
        f(monitoredItemT).should.eql([o, o, o, o]);

        monitoredItemT._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 5 } }));
        q(monitoredItemT).should.eql([2, 3, 4, 5]);
        f(monitoredItemT).should.eql([X, o, o, o]);

        monitoredItemT._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 6 } }));
        q(monitoredItemT).should.eql([3, 4, 5, 6]);
        f(monitoredItemT).should.eql([X, o, o, o]);

        const monitoredItemF = new MonitoredItem({
            clientHandle: 2,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItemF.setNode(fakeNode);

        monitoredItemF._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1 } }));
        q(monitoredItemF).should.eql([1]);
        f(monitoredItemF).should.eql([o]);
        monitoredItemF._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 2 } }));
        q(monitoredItemF).should.eql([1, 2]);
        f(monitoredItemF).should.eql([o, o]);
        monitoredItemF._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 3 } }));
        q(monitoredItemF).should.eql([1, 2, 3]);
        f(monitoredItemF).should.eql([o, o, o]);
        monitoredItemF._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 4 } }));
        q(monitoredItemF).should.eql([1, 2, 3, 4]);
        f(monitoredItemF).should.eql([o, o, o, o]);
        monitoredItemF._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 5 } }));
        q(monitoredItemF).should.eql([1, 2, 3, 5]);
        f(monitoredItemF).should.eql([o, o, o, X]);
        monitoredItemF._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 6 } }));
        q(monitoredItemF).should.eql([1, 2, 3, 6]);
        f(monitoredItemF).should.eql([o, o, o, X]);

        monitoredItemF.terminate();
        monitoredItemF.dispose();

        monitoredItemT.terminate();
        monitoredItemT.dispose();
    });

    it("StatusCode.Overflow bit should not be set when queuesize is 1. (discardOldest === true)", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(1);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("StatusCode.Overflow bit should not be set when queuesize is 1. (discardOldest === false)", (done) => {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            discardOldest: false,
            queueSize: 1,
            samplingInterval: 10,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(1);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue
            .map(function (a) {
                return a.value.value.value;
            })
            .should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });
});
describe("MonitoredItem with DataChangeFilter", function () {
    let monitoredItem;
    afterEach(() => {
        monitoredItem.terminate();
        monitoredItem.dispose();
        monitoredItem = null;
    });
    function writeValue(value /*: number*/, statusCode /*?: StatusCode*/) {
        const dataValue = new DataValue({
            statusCode: statusCode ? statusCode : StatusCodes.Good,
            value: { dataType: "Int16", value }
        });
        fakeNode.dataValue = dataValue;
        monitoredItem.recordValue(fakeNode.dataValue);
    }
    function writeVQT(value, statusCode, date) {
        const dataValue = new DataValue({
            serverTimestamp: date,
            sourceTimestamp: date,
            statusCode: statusCode ? statusCode : StatusCodes.Good,
            value: { dataType: "Int16", value }
        });
        fakeNode.dataValue = dataValue;
        monitoredItem.recordValue(fakeNode.dataValue);
    }

    it("DeadbandType.None - should only detect status change when dataChangeFilter trigger is DataChangeTrigger.Status", () => {
        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.Status,
            deadbandType: DeadbandType.None
        });

        monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queue.length.should.eql(0);

        writeValue(48); // 48
        q(monitoredItem).should.eql([48]);

        writeValue(49); // 49 -> No record status is the same
        q(monitoredItem).should.eql([48]);

        writeValue(49, StatusCodes.GoodCallAgain);
        monitoredItem.queue.length.should.eql(2);
        q(monitoredItem).should.eql([48, 49]); // status has change
        f(monitoredItem).should.eql([o, X]);

        writeValue(49);
        monitoredItem.queue.length.should.eql(3);
        q(monitoredItem).should.eql([48, 49, 49]); // status has changed again
        f(monitoredItem).should.eql([o, X, o]);
    });

    it("DeadbandType.None - should detect status change & value change when dataChangeFilter trigger is DataChangeTrigger.StatusValue", () => {
        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.None
        });

        monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        monitoredItem.queue.length.should.eql(0);

        writeValue(48);
        monitoredItem.queue.length.should.eql(1);
        q(monitoredItem).should.eql([48]);
        f(monitoredItem).should.eql([o]);

        writeValue(49);
        q(monitoredItem).should.eql([48, 49]);
        f(monitoredItem).should.eql([o, o]);

        writeValue(49, StatusCodes.GoodCallAgain);
        q(monitoredItem).should.eql([48, 49, 49]);
        f(monitoredItem).should.eql([o, o, X]);

        writeValue(49);
        monitoredItem.queue.length.should.eql(4);
        q(monitoredItem).should.eql([48, 49, 49, 49]);
        f(monitoredItem).should.eql([o, o, X, o]);

        writeValue(49);
        monitoredItem.queue.length.should.eql(4);
        q(monitoredItem).should.eql([48, 49, 49, 49]);
        f(monitoredItem).should.eql([o, o, X, o]);
    });

    it("DeadbandType.Absolute - should detect status change & value change when dataChangeFilter trigger is DataChangeTrigger.StatusValue and deadband is 8", function () {
        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Absolute,
            deadbandValue: 8
        });

        monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);
        monitoredItem.queue.length.should.eql(0);

        writeValue(48);
        monitoredItem.queue.length.should.eql(1);
        q(monitoredItem).should.eql([48]);

        // 48-> 49 no record
        writeValue(49);
        monitoredItem.queue.length.should.eql(1);
        q(monitoredItem).should.eql([48]);

        // 48-> 49  + statusChange => Record
        writeValue(49, StatusCodes.GoodCallAgain);
        monitoredItem.queue.length.should.eql(2);
        q(monitoredItem).should.eql([48, 49]);
        f(monitoredItem).should.eql([o, X]);

        // 49-> 49  + statusChange => Record
        writeValue(49);
        monitoredItem.queue.length.should.eql(3);
        q(monitoredItem).should.eql([48, 49, 49]);
        f(monitoredItem).should.eql([o, X, o]);

        // 49-> 49  + no statusChange => No Record
        writeValue(49);
        monitoredItem.queue.length.should.eql(3);
        q(monitoredItem).should.eql([48, 49, 49]);
        f(monitoredItem).should.eql([o, X, o]);

        // 49-> 59  + no statusChange => outside DeadBand => Record
        writeValue(59);
        monitoredItem.queue.length.should.eql(4);
        q(monitoredItem).should.eql([48, 49, 49, 59]);
        f(monitoredItem).should.eql([o, X, o, o]);

        writeValue(60);
        monitoredItem.queue.length.should.eql(4);
        q(monitoredItem).should.eql([48, 49, 49, 59]);
        f(monitoredItem).should.eql([o, X, o, o]);

        writeValue(10);
        monitoredItem.queue.length.should.eql(5);
        q(monitoredItem).should.eql([48, 49, 49, 59, 10]);
        f(monitoredItem).should.eql([o, X, o, o, o]);
    });

    it("DeadbandType.Percent - should detect status change & value change when dataChangeFilter trigger is DataChangeTrigger.StatusValue and deadband is 20%", () => {
        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Percent, // percentage of the EURange
            // see part 8
            deadbandValue: 20
        });

        monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        // node must provide a EURange property that expose a Range for DeadbandType.Percent to work
        fakeNode.getChildByName("EURange").readValue().value.value.low.should.eql(-100);
        fakeNode.getChildByName("EURange").readValue().value.value.high.should.eql(100);
        {
            // 20 percent = 40
            monitoredItem.queue.length.should.eql(0);

            writeValue(48);
            monitoredItem.queue.length.should.eql(1);
            q(monitoredItem).should.eql([48]);
            f(monitoredItem).should.eql([o]);

            // 48-> 49 no record
            writeValue(49);
            monitoredItem.queue.length.should.eql(1);
            q(monitoredItem).should.eql([48]);
            f(monitoredItem).should.eql([o]);

            // 48-> 49  + statusChange => Record
            writeValue(49, StatusCodes.GoodCallAgain);
            monitoredItem.queue.length.should.eql(2);
            q(monitoredItem).should.eql([48, 49]);
            f(monitoredItem).should.eql([o, X]);

            // 49-> 49  + statusChange => Record
            writeValue(49);
            monitoredItem.queue.length.should.eql(3);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49-> 49  + no statusChange => No Record
            writeValue(49);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49-> 59  + no statusChange => in Deadband => No Record
            writeValue(59);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49 -> 60 : in deadband => No record
            writeValue(60);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49 -> 60 : node dead band =>  record
            writeValue(0);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);
        }
    });
    it("DeadbandType.Percent - changing filter in the middle", () => {
        const dataChangeFilter1 = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Percent, // percentage of the EURange
            // see part 8
            deadbandValue: 20
        });

        monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        const dataChangeFilter2 = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Percent, // percentage of the EURange
            // see part 8
            deadbandValue: 50
        });

        // node must provide a EURange property that expose a Range for DeadbandType.Percent to work
        const range = fakeNode.getChildByName("EURange").readValue().value.value;
        range.low.should.eql(-100);
        range.high.should.eql(100);
        const band = range.high - range.low;
        const step2 = (band * dataChangeFilter2.deadbandValue) / 100;
        const step1 = (band * dataChangeFilter1.deadbandValue) / 100;
        {
            // 20 percent = 40
            monitoredItem.queue.length.should.eql(0);

            writeValue(48);
            monitoredItem.queue.length.should.eql(1);
            q(monitoredItem).should.eql([48]);
            f(monitoredItem).should.eql([o]);

            // 48-> 49 no record
            writeValue(49);
            monitoredItem.queue.length.should.eql(1);
            q(monitoredItem).should.eql([48]);
            f(monitoredItem).should.eql([o]);

            // 48-> 49  + statusChange => Record
            writeValue(49, StatusCodes.GoodCallAgain);
            monitoredItem.queue.length.should.eql(2);
            q(monitoredItem).should.eql([48, 49]);
            f(monitoredItem).should.eql([o, X]);

            // 49-> 49  + statusChange => Record
            writeValue(49);
            monitoredItem.queue.length.should.eql(3);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49-> 49  + no statusChange => No Record
            writeValue(49);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49-> 59  + no statusChange => in Deadband => No Record
            writeValue(59);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49 -> 60 : in deadband => No record
            writeValue(60);
            q(monitoredItem).should.eql([48, 49, 49]);
            f(monitoredItem).should.eql([o, X, o]);

            // 49 -> 60 : node dead band =>  record
            writeValue(0);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            const monitoringParameters2 = new MonitoringParameters({
                clientHandle: 1,
                samplingInterval: 100,
                discardOldest: true,
                queueSize: 100,
                filter: dataChangeFilter2
            });
            monitoredItem.modify(TimestampsToReturn.Both, monitoringParameters2);
            writeValue(10);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(20);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(30);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(40);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(41);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(49);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(51);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(99);
            q(monitoredItem).should.eql([48, 49, 49, 0]);
            f(monitoredItem).should.eql([o, X, o, o]);

            writeValue(101);
            q(monitoredItem).should.eql([48, 49, 49, 0, 101]);
            f(monitoredItem).should.eql([o, X, o, o, o]);
        }
    });
    it("DeadbandType.Percent - 99 percent", () => {
        // Modifies the first 2 monitoredItems to use a deadband filter of 99 %
        //    where there are 2 monitoredItems in the subscription.
        // Write the EURange.High, EURange.Low and a number in the middle.
        // The filtered items expect to pass the EURange.Low and EURange.High values.

        const dataChangeFilter1 = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Percent, // percentage of the EURange
            // see part 8
            deadbandValue: 99
        });

        monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        // node must provide a EURange property that expose a Range for DeadbandType.Percent to work
        const range = fakeNode.getChildByName("EURange").readValue().value.value;
        range.low.should.eql(-100);
        range.high.should.eql(100);
        const band = range.high - range.low;
        {
            monitoredItem.queue.length.should.eql(0);

            writeValue(-100);
            monitoredItem.queue.length.should.eql(1);
            q(monitoredItem).should.eql([-100]);
            f(monitoredItem).should.eql([o]);

            writeValue(100);
            monitoredItem.queue.length.should.eql(2);
            q(monitoredItem).should.eql([-100, 100]);
            f(monitoredItem).should.eql([o, o]);

            writeValue(57);
            monitoredItem.queue.length.should.eql(2);
            q(monitoredItem).should.eql([-100, 100]);
            f(monitoredItem).should.eql([o, o]);
        }
    });
    it("ctt DataAccess PercentDeadBand 018", () => {
        /*  Test prepared by OPC Foundation: compliance@opcfoundation.org
            Description:  
            Make sure that PercentDeadband filter treats a VQT filter as a VQ filter only.
                a. Write to the Value attribute, a value that will PASS the deadband filter. Call Publish()
                b. Write the same Value as last time, and then call Publish().
                c. Write the same Value as last time, but change the Quality; e.g. from "good" to "bad" etc. Call Publish().
                d. Repeat the previous call, and revert the Quality back to the original value. Call Publish().
                e. Write the exact same values as in the previous step. Call Publish().
                f. Repeat the last step, but also specify a timestamp that is *now*. Call Publish().
            Expected results:
                a. All service/operation results are Good.The Publish() call yields a DataChange where the value(s) match the value(s) previously written.
                b. All service/operation results are Good. The Publish() call yields a KeepAlive.
                c. All service/operation results are Good. The Publish() call yields a DataChange where the value(s) and quality/qualities match the value(s) previously written.
                d. All service/operation results are Good. The Publish() call yields a DataChange where the value(s) and quality/qualities match the value(s) previously written. Manual.
                e. All service/operation results are Good. The Publish() call yields a KeepAlive.
                f. All service/operation results are Good. The Publish() call yields a KeepAlive. 
        */
        const dataChangeFilter1 = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValueTimestamp,
            deadbandType: DeadbandType.Percent, // percentage of the EURange
            // see part 8
            deadbandValue: 10
        });

        monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.setNode(fakeNode);

        // node must provide a EURange property that expose a Range for DeadbandType.Percent to work
        const range = fakeNode.getChildByName("EURange").readValue().value.value;
        range.low.should.eql(-100);
        range.high.should.eql(100);
        {
            monitoredItem.queue.length.should.eql(0);

            // a.Write to the Value attribute, a value that will PASS the deadband filter.Call Publish()
            const date1 = new Date(2019, 10, 11);
            const date2 = new Date(2019, 10, 12);

            writeVQT(-100, StatusCodes.Good, date1);
            // a.All service / operation results are Good.
            // The Publish() call yields a DataChange where the value(s) match the value(s) previously written.
            monitoredItem.queue.length.should.eql(1);
            q(monitoredItem).should.eql([-100]);
            f(monitoredItem).should.eql([o]);

            // b.Write the same Value as last time, and then call Publish().
            writeVQT(-100, StatusCodes.Good, date1);
            // b.All service / operation results are Good.The Publish() call yields a KeepAlive.
            monitoredItem.queue.length.should.eql(1);
            q(monitoredItem).should.eql([-100]);
            f(monitoredItem).should.eql([o]);

            // c.Write the same Value as last time, but change the Quality; e.g.from "good" to "bad" etc.Call Publish().
            writeVQT(-100, StatusCodes.BadAlreadyExists, date1);
            // c.All service / operation results are Good.The Publish() call yields a DataChange where the value(s) and quality / qualities match the value(s) previously written.
            q(monitoredItem).should.eql([-100, -100]);
            f(monitoredItem).should.eql([o, X]);

            // d.Repeat the previous call, and revert the Quality back to the original value.Call Publish().
            // d.All service / operation results are Good.The Publish() call yields a DataChange where the value(s) and quality / qualities match the value(s) previously written.Manual.
            writeVQT(-100, StatusCodes.Good, date1);
            q(monitoredItem).should.eql([-100, -100, -100]);
            f(monitoredItem).should.eql([o, X, o]);

            // e.Write the exact same values as in the previous step.Call Publish().
            // e.All service / operation results are Good.The Publish() call yields a KeepAlive.
            writeVQT(-100, StatusCodes.Good, date1);
            q(monitoredItem).should.eql([-100, -100, -100]);
            f(monitoredItem).should.eql([o, X, o]);

            // f.Repeat the last step, but also specify a timestamp that is * now *.Call Publish().
            // f.All service / operation results are Good.The Publish() call yields a KeepAlive.
            writeVQT(-100, StatusCodes.Good, date2);
            q(monitoredItem).should.eql([-100, -100, -100, -100]);
            f(monitoredItem).should.eql([o, X, o, o]);
        }
    });
});
