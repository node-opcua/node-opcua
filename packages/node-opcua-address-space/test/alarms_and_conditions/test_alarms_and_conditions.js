"use strict";
/* global describe,it,before*/

var should = require("should");
var _ = require("underscore");
var constructNodesetFilename = require("node-opcua-nodesets").constructNodesetFilename;

var AddressSpace = require("../..").AddressSpace;
var generate_address_space = require("node-opcua-address-space-loader").generate_address_space;

describe("AddressSpace : Conditions ", function () {

    var test = this;

    var addressSpace;

    this.timeout(Math.max(this._timeout, 10000));

    var source;
    require("node-opcua-test-helpers/src/resource_leak_detector").installResourceLeakDetector(true, function () {
        before(function (done) {

            addressSpace = new AddressSpace();

            var xml_file = constructNodesetFilename("Opc.Ua.NodeSet2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace,xml_file,function(err) {

                var FolderTypeId = addressSpace.findNode("FolderType").nodeId;
                var BaseDataVariableTypeId = addressSpace.findNode("BaseDataVariableType").nodeId;

                addressSpace.installAlarmsAndConditionsService();

                var green = addressSpace.addObject({
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

                test.setpointNodeNode= addressSpace.addVariable({
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


});


