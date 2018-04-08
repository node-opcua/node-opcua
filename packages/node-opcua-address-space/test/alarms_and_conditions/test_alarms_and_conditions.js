"use strict";
/* global describe,it,before*/

const should = require("should");
const fs = require("fs");
const nodesets = require("node-opcua-nodesets");

const AddressSpace = require("../..").AddressSpace;
const generate_address_space = require("../..").generate_address_space;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddressSpace : Conditions ", function () {

    const test = this;

    let addressSpace;

    this.timeout(Math.max(this._timeout, 10000));

    let source;
    before(function (done) {

        addressSpace = new AddressSpace();

        const xml_file = nodesets.standard_nodeset_file;

        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            const FolderTypeId = addressSpace.findNode("FolderType").nodeId;
            const BaseDataVariableTypeId = addressSpace.findNode("BaseDataVariableType").nodeId;

            addressSpace.installAlarmsAndConditionsService();

            const green = addressSpace.addObject({
                browseName: "Green",
                organizedBy: addressSpace.rootFolder.objects,
                notifierOf: addressSpace.rootFolder.objects.server
            });

            source = addressSpace.addObject({
                browseName: "Motor.RPM",
                componentOf: green,
                eventSourceOf: green
            });

            test.variableWithAlarm = addressSpace.addVariable({
                browseName: "VariableWithLimit",
                dataType: "Double",
                propertyOf: source
            });

            test.setpointNodeNode = addressSpace.addVariable({
                browseName: "SetPointValue",
                dataType: "Double",
                propertyOf: source
            });


            test.addressSpace = addressSpace;
            test.source = source;
            test.green = green;

            done();
        });

    });
    after(function () {
        addressSpace.dispose();
        addressSpace = null;
    });

    require("./utest_condition")(test);
    require("./utest_acknowledgeable_condition")(test);
    require("./utest_alarm_condition")(test);
    require("./utest_limit_alarm")(test);
    require("./utest_exclusive_deviation_alarm")(test);
    require("./utest_non_exclusive_deviation_alarm")(test);
    require("./utest_off_normal_alarm")(test);
    require("./utest_issue_316")(test);


});


