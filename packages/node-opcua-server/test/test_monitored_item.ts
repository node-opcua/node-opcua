import { EventEmitter } from "node:events";
import { type IAddressSpace, type ISessionContext, SessionContext } from "node-opcua-address-space";
import { AttributeIds, NodeClass, type QualifiedNameOptions } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { coerceNodeId, makeNodeId, type NodeId } from "node-opcua-nodeid";
import { TimestampsToReturn } from "node-opcua-service-read";
import {
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType,
    type MonitoredItemModifyResult,
    MonitoringMode,
    MonitoringParameters
} from "node-opcua-service-subscription";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { type MonitoredItemNotification, Range } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import sinon from "sinon";

import { MonitoredItem, type MonitoredItemOptions } from "../source/index.js";

function q(monitoredItem: IMonitoredItem) {
    return monitoredItem.queue.map((a) => a.value.value.value);
}
const o = false;
const X = true;

function f(monitoredItem: IMonitoredItem) {
    return monitoredItem.queue.map((a) => {
        return !!(a.value.statusCode.value !== StatusCodes.Good.value);
    });
}
class FakeNode extends EventEmitter {
    addressSpace: IAddressSpace | undefined;
    nodeId: NodeId = makeNodeId(32);
    browseName: QualifiedNameOptions = { name: "toto" };
    nodeClass: NodeClass = NodeClass.Variable;
    dataType: NodeId = coerceNodeId(DataType.Double);
    _euRange: { nodeClass: NodeClass; readValue(): DataValue };

    public dataValue?: DataValue;

    constructor(addressSpace?: IAddressSpace) {
        super();
        this.addressSpace = addressSpace;
        this.nodeId = makeNodeId(32);
        this.browseName = { name: "toto" };
        this.nodeClass = NodeClass.Variable;
        this.dataType = coerceNodeId(DataType.Double);
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
    readValueAsync(sessionContext: ISessionContext | null, callback: (error: Error | null, result?: DataValue) => void) {
        setImmediate(() => {
            callback(null, this.readAttribute(sessionContext, AttributeIds.Value));
        });
    }

    readAttribute(_context: ISessionContext | null, _attributeId: AttributeIds) {
        return new DataValue({ statusCode: StatusCodes.BadInvalidArgument });
    }
    getChildByName(name: string) {
        name.should.eql("EURange");
        return this._euRange;
    }
}
// util.inherits(FakeNode, EventEmitter);
const fakeNode = new FakeNode();

const fakeSubscription = {
    $session: {
        sessionContext: SessionContext.defaultContext
    }
};

const createMonitoredItem = (options: {
    clientHandle: number;
    queueSize: number;
    samplingInterval: number;
    // added by the server:
    monitoredItemId: number;
    timestampsToReturn?: TimestampsToReturn;
    discardOldest?: boolean;
    filter?: DataChangeFilter;
    minSupportedSampleRate?: number;
    itemToMonitor?: { attributeId: AttributeIds };
}) => {
    const monitoredItem = new MonitoredItem(options as unknown as MonitoredItemOptions);
    return monitoredItem as unknown as Omit<MonitoredItem, "queue" | "$subscription"> & {
        $subscription: typeof fakeSubscription;
        setNode: (a: FakeNode) => void;
        _enqueue_value: (a: DataValue) => void;
        queue: MonitoredItemNotification[];
    };
};
type IMonitoredItem = ReturnType<typeof createMonitoredItem>;

describe("Server Side MonitoredItem", () => {
    beforeEach(function (this: Mocha.Context) {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function (this: Mocha.Context) {
        this.clock.restore();
    });

    it("should create a MonitoredItem", (done) => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 1000,

            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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

    it("MI1 - a MonitoredItem should trigger a read event according to sampling interval in Reporting mode", function (this: Mocha.Context, done) {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        monitoredItem.isSampling.should.eql(false);

        // set up a spying samplingFunc
        const spy_samplingEventCall = sinon.spy((_sessionContext, _oldValue, callback) => {
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
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,

            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true, // <= discard oldest !
            queueSize: 2, // <=== only 2 values in queue
            samplingInterval: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: false, // <= discard oldest !
            queueSize: 2, // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 2, // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50,
            timestampsToReturn: TimestampsToReturn.Both
        });
        monitoredItem.$subscription = fakeSubscription;

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
        should(monitoredItem.queue[0].value.serverTimestamp).eql(now);
        should(monitoredItem.queue[0].value.sourceTimestamp).eql(now);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    // #21
    it("should set timestamp to the recorded value with a given sourceTimestamp (variation 2)", function (this: Mocha.Context) {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 2, // <=== only 2 values in queue
            // added by the server:
            monitoredItemId: 50,
            timestampsToReturn: TimestampsToReturn.Both
        });
        monitoredItem.$subscription = fakeSubscription;

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
        should(monitoredItem.queue[0].value.serverTimestamp).eql(now);

        should(monitoredItem.queue[0].value.sourceTimestamp).eql(sourceTimestamp);
        monitoredItem.queue[0].value.sourcePicoseconds.should.eql(picoseconds);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    function install_spying_samplingFunc() {
        let sample_value = 0;
        const spy_samplingEventCall = sinon.spy((_sessionContext, _oldValue, callback) => {
            sample_value++;
            const dataValue = new DataValue({ value: { dataType: DataType.UInt32, value: sample_value } });
            callback(null, dataValue);
        });
        return spy_samplingEventCall;
    }

    it("a MonitoredItem should trigger a read event according to sampling interval", function (this: Mocha.Context) {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        // set up spying samplingFunc
        const samplingFunc = install_spying_samplingFunc();
        monitoredItem.samplingFunc = samplingFunc;

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        // wait 2 x samplingInterval

        this.clock.tick(monitoredItem.samplingInterval * 2 + 10);
        samplingFunc.callCount.should.eql(2);

        this.clock.tick(monitoredItem.samplingInterval * 2);
        samplingFunc.callCount.should.eql(4);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("a MonitoredItem should not trigger any read event after terminate has been called", function (this: Mocha.Context) {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        const samplingFunc = install_spying_samplingFunc();
        monitoredItem.samplingFunc = samplingFunc;

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        this.clock.tick(2000);
        samplingFunc.callCount.should.be.greaterThan(6);

        const nbCalls = samplingFunc.callCount;

        monitoredItem.terminate();

        this.clock.tick(2000);
        samplingFunc.callCount.should.eql(nbCalls);

        monitoredItem.dispose();
    });

    it("MonitoredItem#modify should cap queue size", () => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        const result = monitoredItem.modify(
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
    });

    it("MonitoredItem#modify should cap samplingInterval", () => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        let result: MonitoredItemModifyResult;
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
    });

    it("MonitoredItem#modify : changing queue size from 2 to 1 when queue is full, should trim queue (discardOldest=true)", (done) => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 2,
            samplingInterval: 10,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000, 1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1001, 1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.GoodWithOverflowBit);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);

        const result = monitoredItem.modify(
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
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify : changing queue size from 2 to 1 when queue is full, should trim queue (discardOldest=false)", (done) => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 2,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(2);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000, 1001]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000, 1002]);

        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.hasOverflowBit.should.equal(true);

        const result = monitoredItem.modify(
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
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.hasOverflowBit.should.equal(false);
        //xx        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoredItem#modify : changing queue size from 4 to 2 when queue is full, should trim queue (discardOldest=false)", (done) => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(4);

        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000, 1001]);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(3);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000, 1001, 1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[2].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1003 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(4);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000, 1001, 1002, 1003]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[1].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[2].value.statusCode.should.eql(StatusCodes.Good);
        monitoredItem.queue[3].value.statusCode.should.eql(StatusCodes.Good);

        const result = monitoredItem.modify(
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
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000, 1003]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("MonitoringItem#setMonitoringMode : setting the mode to DISABLED should cause all queued Notifications to be deleted", () => {
        // OPCUA 1.03 part 4 : $5.12.4
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 2,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        monitoredItem.samplingFunc = (_sessionContext, _oldvalue, _callback) => {
            /** */
            //callback();
        };

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(true);
        monitoredItem.queue.length.should.eql(2);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1001, 1002]);

        monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("should set the OverflowBit as specified in the example in specification - Fig 17 Queue overflow handling    ", () => {
        // OPC Specification 1.03 part 4 page 60 - Figure 17
        const monitoredItemT = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItemT.$subscription = fakeSubscription;

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

        const monitoredItemF = createMonitoredItem({
            clientHandle: 2,
            samplingInterval: 10,
            discardOldest: false,
            queueSize: 4,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItemF.$subscription = fakeSubscription;

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
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(1);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("StatusCode.Overflow bit should not be set when queuesize is 1. (discardOldest === false)", (done) => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: false,
            queueSize: 1,
            samplingInterval: 10,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        monitoredItem.queueSize.should.eql(1);
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(0);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1000]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1001]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem._enqueue_value(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));
        monitoredItem.overflow.should.eql(false);
        monitoredItem.queue.length.should.eql(1);
        monitoredItem.queue.map((a) => a.value.value.value).should.eql([1002]);
        monitoredItem.queue[0].value.statusCode.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
        done();
    });

    it("setMonitoredItem should not asserts if MonitoringMode is Invalid", () => {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        // set up spying samplingFunc
        const samplingFunc = install_spying_samplingFunc();
        monitoredItem.samplingFunc = samplingFunc;

        // set mode to disabled
        const statusCode1 = monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
        statusCode1.should.eql(StatusCodes.Good);
        monitoredItem.monitoringMode.should.eql(MonitoringMode.Disabled);

        // set mode to disabled again: idempotent, and Good. Bad_NothingToDo is a
        // service result for a request carrying no monitoredItemIds, not an
        // operation result of SetMonitoringMode (OPC 10000-4 5.12.4), and CTT
        // Monitor Basic 020 sets an already disabled item to Disabled and
        // requires Good.
        const statusCode1b = monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
        statusCode1b.should.eql(StatusCodes.Good);
        monitoredItem.monitoringMode.should.eql(MonitoringMode.Disabled);

        // set mode to reporting
        const statusCode2 = monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        statusCode2.should.eql(StatusCodes.Good);
        monitoredItem.monitoringMode.should.eql(MonitoringMode.Reporting);

        // set mode to sampling
        const statusCode3 = monitoredItem.setMonitoringMode(MonitoringMode.Sampling);
        statusCode3.should.eql(StatusCodes.Good);

        // set mode to sampling again: still Good, and still Sampling
        const statusCode4 = monitoredItem.setMonitoringMode(MonitoringMode.Sampling);
        statusCode4.should.eql(StatusCodes.Good);
        monitoredItem.monitoringMode.should.eql(MonitoringMode.Sampling);

        // and again, to show it stays idempotent rather than degrading
        const statusCode5 = monitoredItem.setMonitoringMode(MonitoringMode.Sampling);
        statusCode5.should.eql(StatusCodes.Good);
        monitoredItem.monitoringMode.should.eql(MonitoringMode.Sampling);

        const statusCode6 = monitoredItem.setMonitoringMode(MonitoringMode.Invalid);
        statusCode6.should.eql(StatusCodes.BadInvalidArgument);

        const statusCode8 = monitoredItem.setMonitoringMode(-2323 as MonitoringMode);
        monitoredItem.monitoringMode.should.eql(MonitoringMode.Sampling);
        statusCode8.should.eql(StatusCodes.BadInternalError);
        monitoredItem.monitoringMode.should.not.eql(MonitoringMode.Invalid);

        // and after a rejected mode, setting the current one is still Good
        const statusCode9 = monitoredItem.setMonitoringMode(MonitoringMode.Sampling);
        monitoredItem.monitoringMode.should.eql(MonitoringMode.Sampling);
        statusCode9.should.eql(StatusCodes.Good);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });
});

// OPC 10000-4 5.12.1.2: a requested samplingInterval of 0 asks for the fastest practical rate and
// the revised value is never below the MinSupportedSampleRate the server advertises (50 ms by
// default). CTT Monitor Basic 038 warns on a revised 0. The fake node has no MinimumSamplingInterval,
// so it counts as exception-based (0): the item is still delivered on change, without a timer,
// the revised interval being the window over which changes are coalesced.
describe("MonitoredItem requested with samplingInterval 0 (CTT Monitor Basic 038)", () => {
    beforeEach(function (this: Mocha.Context) {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function (this: Mocha.Context) {
        this.clock.restore();
    });

    function makeExceptionBasedItem(extra: { minSupportedSampleRate?: number; filter?: DataChangeFilter } = {}) {
        const monitoredItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 0,
            // added by the server:
            monitoredItemId: 50,
            ...extra
        });
        monitoredItem.$subscription = fakeSubscription;
        monitoredItem.setNode(fakeNode);
        return monitoredItem;
    }

    // the recorded values, without the initial one (BadInvalidArgument from the fake node)
    const values = (monitoredItem: IMonitoredItem) => monitoredItem.queue.slice(1).map((a) => a.value.value.value);

    const change = (value: number) => {
        fakeNode.emit("value_changed", new DataValue({ value: { dataType: DataType.UInt32, value } }));
    };

    it("answers the advertised MinSupportedSampleRate, not 0, and still delivers on change without a timer", function (this: Mocha.Context) {
        const monitoredItem = makeExceptionBasedItem();
        monitoredItem.samplingInterval.should.eql(MonitoredItem.minimumSamplingInterval);
        monitoredItem.isExceptionBased.should.eql(true);

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        this.clock.tick(1);
        monitoredItem.isSampling.should.eql(true);
        should.not.exist(monitoredItem._samplingId);
        fakeNode.listenerCount("value_changed").should.eql(1);

        monitoredItem.terminate();
        monitoredItem.isSampling.should.eql(false);
        fakeNode.listenerCount("value_changed").should.eql(0);
        monitoredItem.dispose();
    });

    it("answers 0 when the server advertises MinSupportedSampleRate 0, and then reports every change", function (this: Mocha.Context) {
        const monitoredItem = makeExceptionBasedItem({ minSupportedSampleRate: 0 });
        monitoredItem.samplingInterval.should.eql(0);
        monitoredItem.isExceptionBased.should.eql(true);

        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        this.clock.tick(1);
        change(1);
        change(2);
        change(3);
        values(monitoredItem).should.eql([1, 2, 3]);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("coalesces the changes of one interval: the first at once, then the latest when the window ends", function (this: Mocha.Context) {
        const monitoredItem = makeExceptionBasedItem();
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        this.clock.tick(1);
        monitoredItem.queue.length.should.eql(1, "the initial value");

        // a burst inside one interval
        for (const v of [1, 2, 3, 4, 5]) {
            change(v);
        }
        values(monitoredItem).should.eql([1], "the first change goes out at once, the others are folded");
        this.clock.tick(MonitoredItem.minimumSamplingInterval);
        values(monitoredItem).should.eql([1, 5], "the latest value of the window, not the three in between");

        // the flush opened the next window: a steady writer gets one notification per interval
        change(6);
        change(7);
        values(monitoredItem).should.eql([1, 5]);
        this.clock.tick(MonitoredItem.minimumSamplingInterval);
        values(monitoredItem).should.eql([1, 5, 7]);

        // a quiet window closes: the next change is again recorded at once
        this.clock.tick(MonitoredItem.minimumSamplingInterval);
        change(8);
        values(monitoredItem).should.eql([1, 5, 7, 8]);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("applies the DataChangeFilter to the coalesced value, as to a sampled one", function (this: Mocha.Context) {
        const monitoredItem = makeExceptionBasedItem({
            filter: new DataChangeFilter({
                trigger: DataChangeTrigger.StatusValue,
                deadbandType: DeadbandType.Absolute,
                deadbandValue: 8
            })
        });
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        this.clock.tick(1);

        change(1);
        change(5); // folded, and 5 - 1 is inside the deadband
        this.clock.tick(MonitoredItem.minimumSamplingInterval);
        values(monitoredItem).should.eql([1]);

        change(20); // folded, and 20 - 1 is outside
        this.clock.tick(MonitoredItem.minimumSamplingInterval);
        values(monitoredItem).should.eql([1, 20]);

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("terminate() inside a window clears the deferred timer and the listener, and keeps the folded value", function (this: Mocha.Context) {
        const monitoredItem = makeExceptionBasedItem();
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        this.clock.tick(1);

        change(1);
        change(2);
        values(monitoredItem).should.eql([1]);

        monitoredItem.terminate();
        should.not.exist((monitoredItem as unknown as { _coalesceTimer: unknown })._coalesceTimer);
        monitoredItem.isSampling.should.eql(false);
        fakeNode.listenerCount("value_changed").should.eql(0);
        values(monitoredItem).should.eql([1, 2], "the folded value is recorded rather than lost");

        change(3);
        this.clock.tick(10 * MonitoredItem.minimumSamplingInterval);
        values(monitoredItem).should.eql([1, 2], "nothing is recorded after terminate");

        monitoredItem.dispose();
    });

    it("modify: 0 keeps an exception-based item on change at the advertised interval, and a sampled item on the fastest timer", () => {
        const monitoredItem = makeExceptionBasedItem();
        const params = (samplingInterval: number) =>
            new MonitoringParameters({ clientHandle: 1, discardOldest: true, queueSize: 10, samplingInterval });

        let result = monitoredItem.modify(null, params(0));
        result.revisedSamplingInterval.should.eql(MonitoredItem.minimumSamplingInterval);
        monitoredItem.isExceptionBased.should.eql(true);

        result = monitoredItem.modify(null, params(200));
        result.revisedSamplingInterval.should.eql(200);
        monitoredItem.isExceptionBased.should.eql(false);

        result = monitoredItem.modify(null, params(0));
        result.revisedSamplingInterval.should.eql(MonitoredItem.minimumSamplingInterval);
        monitoredItem.isExceptionBased.should.eql(false, "a sampled item stays sampled");

        monitoredItem.terminate();
        monitoredItem.dispose();
    });

    it("an EventNotifier item requested with 0 answers 0 (create and modify): the floor only applies to a Value", () => {
        // OPC 10000-4 5.12.1.2: a Client shall define a sampling interval of 0 when it subscribes for Events
        const eventNode = new FakeNode();
        eventNode.nodeClass = NodeClass.Object;
        const eventItem = createMonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 0,
            monitoredItemId: 51,
            itemToMonitor: { attributeId: AttributeIds.EventNotifier }
        });
        eventItem.$subscription = fakeSubscription;
        eventItem.setNode(eventNode);
        eventItem.samplingInterval.should.eql(0);
        eventItem.isExceptionBased.should.eql(false, "on-change delivery of a Value only");

        const params = (samplingInterval: number) =>
            new MonitoringParameters({ clientHandle: 1, discardOldest: true, queueSize: 10, samplingInterval });
        let result = eventItem.modify(null, params(0));
        result.revisedSamplingInterval.should.eql(0);
        result = eventItem.modify(null, params(200));
        result.revisedSamplingInterval.should.eql(200);
        result = eventItem.modify(null, params(0));
        result.revisedSamplingInterval.should.eql(0, "an event item is never sampled: it keeps the 0 it asked for");
        eventItem.terminate();
        eventItem.dispose();

        // the same request on a Value whose MinimumSamplingInterval is 0 is floored to the advertised rate
        const valueItem = makeExceptionBasedItem();
        valueItem.samplingInterval.should.eql(MonitoredItem.minimumSamplingInterval);
        valueItem.modify(null, params(0)).revisedSamplingInterval.should.eql(MonitoredItem.minimumSamplingInterval);
        valueItem.terminate();
        valueItem.dispose();
    });
});
describe("MonitoredItem with DataChangeFilter", () => {
    let monitoredItem: IMonitoredItem | undefined;
    afterEach(() => {
        if (monitoredItem) {
            monitoredItem.terminate();
            monitoredItem.dispose();
            monitoredItem = undefined;
        }
    });
    function writeValue(value: number, statusCode?: StatusCode) {
        if (!monitoredItem) throw new Error("Internal error");
        const dataValue = new DataValue({
            statusCode: statusCode ? statusCode : StatusCodes.Good,
            value: { dataType: "Int16", value }
        });
        fakeNode.dataValue = dataValue;
        monitoredItem.recordValue(fakeNode.dataValue);
    }
    function writeVQT(value: number, statusCode: StatusCode, date: Date) {
        if (!monitoredItem) throw new Error("Internal error");

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

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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

    it("DeadbandType.Absolute - should detect status change & value change when dataChangeFilter trigger is DataChangeTrigger.StatusValue and deadband is 8", () => {
        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Absolute,
            deadbandValue: 8
        });

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

        monitoredItem.setNode(fakeNode);

        // node must provide a EURange property that expose a Range for DeadbandType.Percent to work
        fakeNode.getChildByName("EURange").readValue().value.value.low.should.eql(-100);
        fakeNode.getChildByName("EURange").readValue().value.value.high.should.eql(100);
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
    });
    it("DeadbandType.Percent - changing filter in the middle", () => {
        const dataChangeFilter1 = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Percent, // percentage of the EURange
            // see part 8
            deadbandValue: 20
        });

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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
        const _step2 = (band * dataChangeFilter2.deadbandValue) / 100;
        const _step1 = (band * dataChangeFilter1.deadbandValue) / 100;
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

        monitoredItem = createMonitoredItem({
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
        const _band = range.high - range.low;
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

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter1,
            // added by the server:
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;

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
            // OPC 10000-4 (1.05) 7.22.2: with a Deadband, STATUS_VALUE_TIMESTAMP_2 behaves like
            // STATUS_VALUE_1, so a new SourceTimestamp alone is not a data change.
            writeVQT(-100, StatusCodes.Good, date2);
            q(monitoredItem).should.eql([-100, -100, -100]);
            f(monitoredItem).should.eql([o, X, o]);
        }
    });

    it("ctt DataAccess PercentDeadBand 017 - STATUS_VALUE_TIMESTAMP with a PercentDeadband behaves as STATUS_VALUE", () => {
        /*  CreateMonitoredItems for all available numeric Analog types specifying a DeadbandPercent of 10,
            and a filter of STATUS_VALUE_TIMESTAMP_2.
                Write a value that is +20% than the value received. Call Publish() #2 -> DataChange
                Write a value that is -11% than the value received. Call Publish() #3 -> DataChange
                Write a value that is +10% than the value received. Call Publish() #4 -> KeepAlive
                Write a value that is -1%  than the value received. Call Publish() #5 -> KeepAlive
                Write a new SourceTimestamp, same value and status.  Call Publish() #6 -> KeepAlive
                Write a new StatusCode, same value and timestamp.    Call Publish() #7 -> DataChange
        */
        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValueTimestamp,
            deadbandType: DeadbandType.Percent,
            deadbandValue: 10
        });

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;
        monitoredItem.setNode(fakeNode);

        // EURange is -100 .. 100 => a 10 percent deadband is 20 engineering units
        const range = fakeNode.getChildByName("EURange").readValue().value.value;
        range.low.should.eql(-100);
        range.high.should.eql(100);

        const t1 = new Date(2019, 10, 11, 10, 0, 0);
        const t2 = new Date(2019, 10, 11, 10, 0, 1);
        const t3 = new Date(2019, 10, 11, 10, 0, 2);
        const t4 = new Date(2019, 10, 11, 10, 0, 3);
        const t5 = new Date(2019, 10, 11, 10, 0, 4);
        const t6 = new Date(2019, 10, 11, 10, 0, 5);
        const t7 = new Date(2019, 10, 11, 10, 0, 6);

        // Publish #1: the initial value is always reported
        writeVQT(0, StatusCodes.Good, t1);
        q(monitoredItem).should.eql([0]);

        // Publish #2: +20% of EURange = +40 => 40, |40 - 0| = 40 > 20 => DataChange
        writeVQT(40, StatusCodes.Good, t2);
        q(monitoredItem).should.eql([0, 40]);

        // Publish #3: -11% of EURange = -22 => 18, |18 - 40| = 22 > 20 => DataChange
        writeVQT(18, StatusCodes.Good, t3);
        q(monitoredItem).should.eql([0, 40, 18]);

        // Publish #4: +10% of EURange = +20 => 38, |38 - 18| = 20, not > 20 => KeepAlive
        writeVQT(38, StatusCodes.Good, t4);
        q(monitoredItem).should.eql([0, 40, 18]);

        // Publish #5: -1% of EURange = -2 => 36, |36 - 18| = 18 < 20 => KeepAlive
        writeVQT(36, StatusCodes.Good, t5);
        q(monitoredItem).should.eql([0, 40, 18]);

        // Publish #6: a new SourceTimestamp only, same value and status => KeepAlive
        writeVQT(36, StatusCodes.Good, t6);
        q(monitoredItem).should.eql([0, 40, 18]);
        f(monitoredItem).should.eql([o, o, o]);

        // Publish #7: a new StatusCode, same value and timestamp => DataChange
        writeVQT(36, StatusCodes.Bad, t6);
        q(monitoredItem).should.eql([0, 40, 18, 36]);
        f(monitoredItem).should.eql([o, o, o, X]);

        // and a SourceTimestamp change on its own is still not a data change
        writeVQT(36, StatusCodes.Bad, t7);
        q(monitoredItem).should.eql([0, 40, 18, 36]);
    });

    it("DeadbandType.None - StatusValueTimestamp still reports a SourceTimestamp only change", () => {
        // no Deadband is specified: the SourceTimestamp remains a trigger of its own
        const dataChangeFilter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValueTimestamp,
            deadbandType: DeadbandType.None,
            deadbandValue: 0
        });

        monitoredItem = createMonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            filter: dataChangeFilter,
            monitoredItemId: 50
        });
        monitoredItem.$subscription = fakeSubscription;
        monitoredItem.setNode(fakeNode);

        const date1 = new Date(2019, 10, 11);
        const date2 = new Date(2019, 10, 12);

        writeVQT(10, StatusCodes.Good, date1);
        q(monitoredItem).should.eql([10]);

        // same value, same status, same timestamp => no data change
        writeVQT(10, StatusCodes.Good, date1);
        q(monitoredItem).should.eql([10]);

        // same value, same status, a new SourceTimestamp => data change
        writeVQT(10, StatusCodes.Good, date2);
        q(monitoredItem).should.eql([10, 10]);
    });
});
