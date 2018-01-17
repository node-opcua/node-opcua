"use strict";

var should = require("should");
var fs = require("fs");
var async = require("async");
var _ = require("underscore");


var AddressSpace = require("../..").AddressSpace;
var SessionContext = require("../..").SessionContext;
var context = SessionContext.defaultContext;

var generate_address_space = require("../..").generate_address_space;

var nodesets = require("node-opcua-nodesets");

var historizing_service = require("node-opcua-service-history");
require("date-utils");

// make sure extra error checking is made on object constructions
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node", function () {

    var addressSpace;

    before(function (done) {

        addressSpace = new AddressSpace();
        var xml_files = [
            nodesets.standard_nodeset_file
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, "file " + xml_files[0] + " must exist");
        generate_address_space(addressSpace, xml_files, function (err) {

            // create historical data nodes ...

            var node1 = addressSpace.addVariable({
                browseName: "MyVar1",
                dataType: "Double",
                componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
            });
            addressSpace.installHistoricalDataNode(node1);

            var node2 = addressSpace.addVariable({
                browseName: "MyVar2",
                dataType: "Double",
                componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
            });
            addressSpace.installHistoricalDataNode(node2);


            var node3 = addressSpace.addVariable({
                browseName: "MyVar3",
                dataType: "Double",
                componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
            });
            addressSpace.installHistoricalDataNode(node3);
            done(err);
        });

    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
    });


    it("should be easy to enumerate  UAVariable with History from a addressSpace",function() {


        Object.keys(addressSpace.historizingNodes).length.should.eql(3);

        var historizingNode = _.map(addressSpace.historizingNodes);
        historizingNode.map(x=>x.browseName.toString()).should.eql(["MyVar1","MyVar2","MyVar3"]);

    });

});
