
"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UADataType = require("lib/address_space/data_type").UADataType;
var ObjectType = require("lib/address_space/objectType").ObjectType;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var assert = require("better-assert");

var dumpXml = require("lib/address_space/nodeset_to_xml").dumpXml;


describe("testing nodeset to xml", function () {
    var address_space;

    before(function (done) {
        address_space = new AddressSpace();
        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {
            if (err) {
                return done(err);
            }
            done();
        });

    });

    it("should output a nodeset node to xml",function() {
        // TemperatureSensorType
        var temperatureSensorTypeNode = address_space.addObjectType({ browseName: "TemperatureSensorType" });
        address_space.addVariable(temperatureSensorTypeNode,{
            browseName:     "Temperature",
            dataType:       "Double",
            modellingRule:  "Mandatory",
            value: { dataType: DataType.Double, value: 19.5}
        });

        var str = dumpXml(temperatureSensorTypeNode,{});
        console.log(str);
    });
});


