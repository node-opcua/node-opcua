"use strict";
require("requirish")._(module);

var opcua = require("../..");
var path = require("path");
var should = require("should");
var assert = require("better-assert");
var _ = require("underscore");
var fs = require("fs");

var NodeId              = opcua.NodeId;
var DataType            = opcua.DataType;
var coerceLocalizedText = opcua.coerceLocalizedText;
var StatusCodes         = opcua.StatusCodes;
var UAStateMachine = require("lib/address_space/statemachine_wrapper").UAStateMachine;

// make sure extra error checking is made on object constructions
describe("Testing Historical Data Node", function () {

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true, function () {

        before(function (done) {

            addressSpace = new opcua.AddressSpace();
            var xml_files = [
                path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml"),
            ];
            fs.existsSync(xml_files[0]).should.be.eql(true);
            opcua.generate_address_space(addressSpace, xml_files, function (err) {
                done(err);
            });

        });
        after(function () {
            if (addressSpace) {
                addressSpace.dispose();
                addressSpace = null;
            }
        });
    });

    it("should create a 'HA Configuration' node",function(){

            var node = addressSpace.addVariable({
                browseName: "MyVar",
                dataType: "Double",
                componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
            });

        addressSpace.installHistoricalDataNode(node);

        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");


    });
});
