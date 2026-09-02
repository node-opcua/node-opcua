/**
 * What does raising an event cost?
 *
 * Run from packages/node-opcua-address-space after `pnpm run build`:
 *
 *     node --expose-gc --import tsx benchmark/bench_raise_event.ts            # 10000 events, 20 fields, 5 runs
 *     node --expose-gc --import tsx benchmark/bench_raise_event.ts 20000 3
 *
 * An event type with 20 mandatory fields (a mix of scalar properties and a component with its own
 * properties) is raised N times on an object that notifies the Server. The time is split between
 * `AddressSpace.constructEventData` (event layout and field values) and `_bubble_up_event`
 * (delivery to the notifier chain); the best of the runs is reported, and the per-event cost.
 */
import { performance } from "node:perf_hooks";
import { DataType } from "node-opcua-basic-types";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, type UAEventType, type UAObject } from "../dist/api/index.js";
import { AddressSpaceImpl } from "../dist/impl/address_space.js";
import { UAObjectImpl } from "../dist/impl/ua_object_impl.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

const counters = { construct: 0, bubble: 0 };
type AnyMethod = (this: unknown, ...args: unknown[]) => unknown;
type Patchable = Record<string, AnyMethod>;

function timeSync(proto: object, name: string, bucket: keyof typeof counters) {
    const target = proto as Patchable;
    const original = target[name];
    target[name] = function (this: unknown, ...args: unknown[]) {
        const t0 = performance.now();
        try {
            return original.apply(this, args);
        } finally {
            counters[bucket] += performance.now() - t0;
        }
    };
}
timeSync(AddressSpaceImpl.prototype, "constructEventData", "construct");
timeSync(UAObjectImpl.prototype, "_bubble_up_event", "bubble");

const ms = (x: number) => `${x.toFixed(0)}ms`;
const us = (x: number, n: number) => `${((x * 1000) / n).toFixed(1)}us`;

async function main() {
    const events = Number.parseInt(process.argv[2] || "10000", 10);
    const runs = Number.parseInt(process.argv[3] || "5", 10);

    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, [nodesets.standard]);
    const namespace = addressSpace.registerNamespace("urn:bench-raise-event");

    const eventType = namespace.addEventType({ browseName: "BenchEventType", subtypeOf: "BaseEventType" }) as UAEventType;
    const fields: Record<string, unknown> = {};
    for (let i = 0; i < 15; i++) {
        namespace.addVariable({ browseName: `Field${i}`, propertyOf: eventType, dataType: "Double", modellingRule: "Mandatory" });
        fields[`field${i}`] = { dataType: DataType.Double, value: i };
    }
    const block = namespace.addObject({ browseName: "Block", componentOf: eventType, modellingRule: "Mandatory" });
    for (let i = 0; i < 5; i++) {
        namespace.addVariable({ browseName: `Sub${i}`, propertyOf: block, dataType: "String", modellingRule: "Mandatory" });
        fields[`block.sub${i}`] = { dataType: DataType.String, value: `sub${i}` };
    }

    const source = namespace.addObject({
        browseName: "Source",
        organizedBy: addressSpace.rootFolder.objects,
        eventNotifier: 1,
        notifierOf: addressSpace.rootFolder.objects.server
    }) as UAObject;
    let received = 0;
    addressSpace.rootFolder.objects.server.on("event", () => received++);

    let best = Number.POSITIVE_INFINITY;
    let bestSplit = { construct: 0, bubble: 0 };
    for (let run = 0; run < runs; run++) {
        counters.construct = 0;
        counters.bubble = 0;
        const t0 = performance.now();
        for (let i = 0; i < events; i++) {
            source.raiseEvent(eventType, {
                message: { dataType: DataType.LocalizedText, value: { text: `event ${i}` } },
                severity: { dataType: DataType.UInt16, value: 100 },
                ...fields
            });
        }
        const total = performance.now() - t0;
        if (total < best) {
            best = total;
            bestSplit = { ...counters };
        }
    }
    console.log(`raiseEvent x${events} (20 fields), best of ${runs}: ${ms(best)} (${us(best, events)} per event)`);
    console.log(`  constructEventData ${ms(bestSplit.construct)} (${us(bestSplit.construct, events)})`);
    console.log(`  _bubble_up_event   ${ms(bestSplit.bubble)} (${us(bestSplit.bubble, events)})`);
    console.log(`  received by Server: ${received}`);
    addressSpace.dispose();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
