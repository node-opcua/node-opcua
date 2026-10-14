import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { DataType } from "node-opcua-variant";
import should from "should";

import { AddressSpace, SessionContext, type UAVariable } from "../dist/api/index.js";
import { create_minimalist_address_space_nodeset } from "../testHelpers.js";

const context = SessionContext.defaultContext;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A refreshFunc that hands back values with a source timestamp only, as most device drivers do (and the o6
// benchmark's counter server): the server timestamp of each refreshed value is the server's to set, at the time
// the server obtained that value (OPC 10000-4 7.11), so it must move on with every refresh.
describe("UAVariable refreshed by a refreshFunc without server timestamps", () => {
    let addressSpace: AddressSpace;
    let variable: UAVariable;
    let counter = 0;
    before(() => {
        addressSpace = AddressSpace.create();
        create_minimalist_address_space_nodeset(addressSpace);
        const namespace = addressSpace.registerNamespace("Private");
        variable = namespace.addVariable({
            browseName: "Counter",
            dataType: "Double",
            minimumSamplingInterval: 1,
            value: {
                refreshFunc(callback) {
                    counter++;
                    callback(
                        null,
                        new DataValue({ sourceTimestamp: new Date(), value: { dataType: DataType.Double, value: counter } })
                    );
                }
            }
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("stamps each refreshed value with the time the server obtained it", async () => {
        const first = await variable.readValueAsync(context);
        await pause(20);
        const second = await variable.readValueAsync(context);

        should(second.value.value).eql(first.value.value + 1);
        should(first.serverTimestamp).be.instanceOf(Date);
        should(second.serverTimestamp).be.instanceOf(Date);
        const firstServerTime = (first.serverTimestamp as Date).getTime();
        const secondServerTime = (second.serverTimestamp as Date).getTime();
        should(secondServerTime - firstServerTime).be.aboveOrEqual(15);
        // the server timestamp of a value obtained now is not older than its source timestamp
        should(secondServerTime).be.aboveOrEqual((second.sourceTimestamp as Date).getTime());
    });

    it("stamps a value that the refreshFunc hands over later with the time it arrived", async () => {
        const namespace = addressSpace.getOwnNamespace();
        let slowCounter = 0;
        const slow = namespace.addVariable({
            browseName: "SlowCounter",
            dataType: "Double",
            minimumSamplingInterval: 1,
            value: {
                refreshFunc(callback) {
                    slowCounter++;
                    const value = slowCounter;
                    setTimeout(
                        () =>
                            callback(
                                null,
                                new DataValue({ sourceTimestamp: new Date(), value: { dataType: DataType.Double, value } })
                            ),
                        30
                    );
                }
            }
        });
        const before = Date.now();
        const first = await slow.readValueAsync(context);
        should(first.serverTimestamp).be.instanceOf(Date);
        // stamped on arrival, about 30 ms after the request, not when it was asked for
        should((first.serverTimestamp as Date).getTime() - before).be.aboveOrEqual(25);
        should((first.serverTimestamp as Date).getTime()).be.aboveOrEqual((first.sourceTimestamp as Date).getTime());
    });
});
