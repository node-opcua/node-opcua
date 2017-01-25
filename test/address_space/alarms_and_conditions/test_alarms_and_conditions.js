"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var assert = require("assert");
var path = require("path");

var async = require("async");

import ServerEngine from "lib/server/ServerEngine";
import AddressSpace from "lib/address_space/AddressSpace";

require("lib/address_space/add-enumeration-type/install");

describe("AddressSpace : Conditions ", function () {

    var test = this;

    var addressSpace;
    var engine;

    this.timeout(Math.max(this._timeout, 10000));

    var source;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true, function () {
        before(function (done) {

            engine = new ServerEngine();

            var xml_file = path.join(__dirname, "../../../nodesets/Opc.Ua.NodeSet2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            engine.initialize({nodeset_filename: xml_file}, function () {
                var FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
                var BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;

                addressSpace = engine.addressSpace;
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
                test.engine = engine;
                test.source = source;
                test.green = green;

                done();
            });

        });
        after(function () {
            engine.shutdown();
            // addressSpace.dispose();
            addressSpace = null;
        });

        require("./utest_condition")(test);
        require("./utest_acknowledgeable_condition")(test);
        require("./utest_alarm_condition")(test);
        require("./utest_limit_alarm")(test);
        require("./utest_exclusive_deviation_alarm")(test);
        require("./utest_non_exclusive_deviation_alarm")(test);
        require("./utest_off_normal_alarm")(test);
    });


});


