import fs from "node:fs";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import "should";

import { AddressSpace, type UAObject, type UAVariable } from "../..";
import { generateAddressSpace } from "../../distNodeJS";

import { utest_acknowledgeable_condition } from "./utest_acknowledgeable_condition";
import { utest_alarm_condition } from "./utest_alarm_condition";
import { utest_condition } from "./utest_condition";
import { utest_exclusive_deviation_alarm } from "./utest_exclusive_deviation_alarm";
import { utest_issue_316 } from "./utest_issue_316";
import { utest_limit_alarm } from "./utest_limit_alarm";
import { utest_non_exclusive_deviation_alarm } from "./utest_non_exclusive_deviation_alarm";
import { utest_off_normal_alarm } from "./utest_off_normal_alarm";


export type MochaSuiteEx = Mocha.Suite & {
    addressSpace: AddressSpace;
    source: UAObject;
    green: UAObject;
    variableWithAlarm: UAVariable;
    setpointNodeNode: UAVariable;
};
describe("AddressSpace : Conditions 1", function (this: Mocha.Suite) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this as MochaSuiteEx;

    let addressSpace: AddressSpace;

    this.timeout(Math.max(this.timeout(), 50000));

    let source: UAObject;
    before(async () => {
        addressSpace = AddressSpace.create();
        const ownNamespace = addressSpace.registerNamespace("PRIVATE_NAMESPACE");
        ownNamespace.index.should.eql(1);
        const xml_file = nodesets.standard;

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);

        const namespace = addressSpace.getOwnNamespace();

        addressSpace.installAlarmsAndConditionsService();

        const green = namespace.addObject({
            browseName: "Green",
            eventNotifier: 0x1,
            notifierOf: addressSpace.rootFolder.objects.server,
            organizedBy: addressSpace.rootFolder.objects
        });

        source = namespace.addObject({
            browseName: "Motor.RPM",
            componentOf: green,
            eventSourceOf: green
        });

        test.variableWithAlarm = namespace.addVariable({
            browseName: "VariableWithLimit",
            dataType: "Double",
            propertyOf: source
        });

        test.setpointNodeNode = namespace.addVariable({
            browseName: "SetPointValue",
            dataType: "Double",
            propertyOf: source
        });

        test.addressSpace = addressSpace;
        test.source = source;
        test.green = green;
    });
    after(() => {
        addressSpace.dispose();
    });

    utest_condition(test);
    utest_acknowledgeable_condition(test);
    utest_alarm_condition(test);
    utest_limit_alarm(test);
    utest_exclusive_deviation_alarm(test);
    utest_non_exclusive_deviation_alarm(test);
    utest_off_normal_alarm(test);
    utest_issue_316(test);
});
