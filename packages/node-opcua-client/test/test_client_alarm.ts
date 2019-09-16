import {should } from "should";
import {
    ClientAlarm,
    ClientAlarmList,
    EventStuff,
    NodeId,
    resolveNodeId,
    Variant
} from "../source/index";

describe("Testing client alarm", () => {

    it("should update a client alarm list #CAL", () => {

        const clientAlarm = new ClientAlarm({
            ackedState: {
                id: new Variant({ value: true })
            },
            conditionId: new Variant({ value: NodeId.nullNodeId }),
            confirmedState: {
                id: new Variant({ value: true })
            },
            eventId: new Variant({ value: Buffer.alloc(10) }),
            eventType: new Variant({ value: NodeId.nullNodeId }),
        });

        const alarmList = new ClientAlarmList();

        let alarmChangedCount = 0;
        let alarmCreatedCount = 0;
        alarmList.on("alarmChanged", (alarm: ClientAlarm) => {
            alarmChangedCount += 1;
        });
        alarmList.on("newAlarm", (alarm: ClientAlarm) => {
            alarmCreatedCount += 1;
        });

        const alarm1_event1: EventStuff = {
             ackedState: { id: new Variant({ dataType: "Boolean" , value: false}) },
             conditionId: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=Condition1")}),
             confirmedState: { id: new Variant({ dataType: "Boolean" , value: false})},
             eventId: new Variant({ dataType: "ByteString", value: Buffer.from("1")}),
             eventType: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=EventType1")}),
        };
        const alarm1_event2: EventStuff = {
            ackedState: { id: new Variant({ dataType: "Boolean" , value: true}) },
            conditionId: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=Condition1")}),
            confirmedState: { id: new Variant({ dataType: "Boolean" , value: false})},
            eventId: new Variant({ dataType: "ByteString", value: Buffer.from("2")}),
            eventType: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=EventType1")}),
        };
        const alarm2_event1: EventStuff = {
            ackedState: { id: new Variant({ dataType: "Boolean" , value: false}) },
            conditionId: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=Condition2")}),
            confirmedState: { id: new Variant({ dataType: "Boolean" , value: false})},
            eventId: new Variant({ dataType: "ByteString", value: Buffer.from("1")}),
            eventType: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=EventType1")}),
        };

        alarmList.length.should.eql(0);

        alarmList.update(alarm1_event1);
        alarmChangedCount.should.eql(1);
        alarmCreatedCount.should.eql(1);
        alarmList.length.should.eql(1);

        alarmList.update(alarm1_event2);
        alarmChangedCount.should.eql(2);
        alarmCreatedCount.should.eql(1);

        alarmList.update(alarm2_event1);
        alarmChangedCount.should.eql(3);
        alarmCreatedCount.should.eql(2);

        alarmList.length.should.eql(2);

     });
});
