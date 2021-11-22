import * as should from "should";
import { ClientAlarm, ClientAlarmList, DataType, EventStuff, NodeId, resolveNodeId, TVariant, Variant } from "../source/index";

class VariantId extends Variant {
    public id: TVariant<boolean>;
    constructor(value: boolean, valueString: string) {
        super({ value: valueString, dataType: DataType.String });
        this.id = new Variant({ dataType: "Boolean", value });
    }
}
describe("Testing client alarm", () => {
    it("should update a client alarm list #CAL", () => {
        const clientAlarm = new ClientAlarm({
            ackedState: new VariantId(true, "Acknowledged"),
            activeState: new VariantId(true, "Active"),
            conditionId: new Variant({ value: new NodeId() }),
            confirmedState: new VariantId(true, "Confirmed"),
            eventId: new Variant({ value: Buffer.alloc(10) }),
            eventType: new Variant({ value: new NodeId() }),
            retain: new Variant({ value: false })
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
            ackedState: new VariantId(false, "Unack"),
            activeState: new VariantId(true, "Active"),
            conditionId: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=Condition1") }),
            confirmedState: new VariantId(false, "Unconfirmed"),
            eventId: new Variant({ dataType: "ByteString", value: Buffer.from("1") }),
            eventType: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=EventType1") }),
            retain: new Variant({ value: false })
        };
        const alarm1_event2: EventStuff = {
            ackedState: new VariantId(true, "Ack"),
            activeState: new VariantId(true, "Active"),
            conditionId: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=Condition1") }),
            confirmedState: new VariantId(false, "Unconfirmed"),
            eventId: new Variant({ dataType: "ByteString", value: Buffer.from("2") }),
            eventType: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=EventType1") }),
            retain: new Variant({ value: false })
        };
        const alarm2_event1: EventStuff = {
            ackedState: new VariantId(false, "Unack"),
            activeState: new VariantId(true, "Active"),
            conditionId: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=Condition2") }),
            confirmedState: new VariantId(false, "Unconfirmed"),
            eventId: new Variant({ dataType: "ByteString", value: Buffer.from("1") }),
            eventType: new Variant({ dataType: "NodeId", value: resolveNodeId("ns=1;s=EventType1") }),
            retain: new Variant({ value: false })
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
