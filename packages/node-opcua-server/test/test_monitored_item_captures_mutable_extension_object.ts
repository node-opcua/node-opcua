import type { IAddressSpace, UAVariable, UAVariableType } from "node-opcua-address-space";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import type { ServiceCounterDataType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { MonitoredItem, type MonitoredItemOptions, ServerEngine } from "../source";

//
// The end-to-end version of the clone contract.
//
// bindExtensionObject() hands back a *live* ExtensionObject: the address space keeps that
// instance and a server mutates its fields in place, which is immediately visible through
// readValue(). When a MonitoredItem samples such a variable it must capture a deep copy -
// otherwise the value sitting in the notification queue keeps tracking the live object,
// and by the time it is published it reports the current state rather than the state at
// the moment it was sampled. The timestamp would say one thing and the payload another.
//
// This drives a real UAVariable, a real bound ExtensionObject and a real MonitoredItem,
// rather than asserting on DataValue.clone() in isolation.
//

describe("MonitoredItem capturing a mutable ExtensionObject", function (this: Mocha.Suite) {
    this.timeout(Math.max(60000, this.timeout()));

    let engine: ServerEngine;
    let addressSpace: IAddressSpace;
    let extensionObjectVar: UAVariable;
    let liveExtensionObject: ServiceCounterDataType;

    before((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: nodesets.standard }, () => {
            addressSpace = engine.addressSpace as IAddressSpace;

            const baseVariableType = addressSpace.findVariableType("BaseDataVariableType") as UAVariableType;
            const serviceCounterDataType = addressSpace.findDataType("ServiceCounterDataType");
            should.exist(baseVariableType);
            should.exist(serviceCounterDataType);

            extensionObjectVar = baseVariableType.instantiate({
                browseName: "SomeServiceCounter",
                dataType: serviceCounterDataType?.nodeId,
                valueRank: -1,
                minimumSamplingInterval: 0,
                organizedBy: addressSpace.rootFolder.objects
            }) as UAVariable;

            // the live instance the address space will keep handing out
            liveExtensionObject = extensionObjectVar.bindExtensionObject() as ServiceCounterDataType;
            done();
        });
    });

    after(async () => {
        await engine.shutdown();
        engine.dispose();
    });

    function createMonitoredItem() {
        const monitoredItem = new MonitoredItem({
            clientHandle: 1,
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100,
            monitoredItemId: 100,
            timestampsToReturn: TimestampsToReturn.Both,
            itemToMonitor: { nodeId: extensionObjectVar.nodeId, attributeId: 13 }
        } as unknown as MonitoredItemOptions);
        return monitoredItem as MonitoredItem & { queue: { value: { value: { value: ServiceCounterDataType } } }[] };
    }

    it("should record the value as it was at sampling time, not as it becomes later", () => {
        liveExtensionObject.totalCount = 1;
        const monitoredItem = createMonitoredItem();
        try {
            monitoredItem.setNode(extensionObjectVar);

            // sample: this is what the sampler feeds to the monitored item
            const sampled = extensionObjectVar.readValue();
            monitoredItem.recordValue(sampled, true);
            monitoredItem.queue.length.should.eql(1, "the sample should have been queued");

            // now the server mutates the *live* extension object, as it is entitled to
            liveExtensionObject.totalCount = 42;

            // the queued notification must still report what was sampled
            monitoredItem.queue[0].value.value.value.totalCount.should.eql(
                1,
                "the queued notification followed the live object instead of keeping its own copy"
            );
        } finally {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
    });

    it("should keep successive samples independent of one another", () => {
        liveExtensionObject.totalCount = 10;
        const monitoredItem = createMonitoredItem();
        try {
            monitoredItem.setNode(extensionObjectVar);

            monitoredItem.recordValue(extensionObjectVar.readValue(), true);
            liveExtensionObject.totalCount = 20;
            monitoredItem.recordValue(extensionObjectVar.readValue(), true);
            liveExtensionObject.totalCount = 30;

            monitoredItem.queue.length.should.eql(2);
            monitoredItem.queue[0].value.value.value.totalCount.should.eql(10, "first sample was overwritten");
            monitoredItem.queue[1].value.value.value.totalCount.should.eql(20, "second sample was overwritten");
        } finally {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
    });

    it("should not let the recorded value alias the live extension object", () => {
        liveExtensionObject.totalCount = 7;
        const monitoredItem = createMonitoredItem();
        try {
            monitoredItem.setNode(extensionObjectVar);
            monitoredItem.recordValue(extensionObjectVar.readValue(), true);

            const queued = monitoredItem.queue[0].value.value.value;

            queued.should.not.equal(liveExtensionObject, "the queued value must not be the live instance");
        } finally {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
    });

    it("should report the sampled value even after the variable's timestamp is touched", () => {
        // a fresh sourceTimestamp on the variable must not drag the already-queued payload
        // forward with it
        liveExtensionObject.totalCount = 3;
        const monitoredItem = createMonitoredItem();
        try {
            monitoredItem.setNode(extensionObjectVar);
            monitoredItem.recordValue(extensionObjectVar.readValue(), true);

            liveExtensionObject.totalCount = 99;
            extensionObjectVar.setValueFromSource(
                { dataType: DataType.ExtensionObject, value: liveExtensionObject },
                undefined,
                new Date()
            );

            monitoredItem.queue[0].value.value.value.totalCount.should.eql(3);
        } finally {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
    });
});
