"use strict";

const should = require("should");
const fs = require("fs");
const async = require("async");
const _ = require("underscore");


const AddressSpace = require("../..").AddressSpace;
const SessionContext = require("../..").SessionContext;
const context = SessionContext.defaultContext;

const generate_address_space = require("../..").generate_address_space;

const nodesets = require("node-opcua-nodesets");

const historizing_service = require("node-opcua-service-history");
require("date-utils");

// make sure extra error checking is made on object constructions
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node Enumeration", function () {

    let addressSpace;

    before(function (done) {

        addressSpace = new AddressSpace();
        const xml_files = [
            nodesets.standard_nodeset_file
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, "file " + xml_files[0] + " must exist");
        generate_address_space(addressSpace, xml_files, function (err) {

            // create historical data nodes ...

            const node1 = addressSpace.addVariable({
                browseName: "MyVar1",
                dataType: "Double",
                componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
            });
            addressSpace.installHistoricalDataNode(node1);

            const node2 = addressSpace.addVariable({
                browseName: "MyVar2",
                dataType: "Double",
                componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
            });
            addressSpace.installHistoricalDataNode(node2);


            const node3 = addressSpace.addVariable({
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

        const historizingNode = _.map(addressSpace.historizingNodes);
        historizingNode.map(x=>x.browseName.toString()).should.eql(["MyVar1","MyVar2","MyVar3"]);

    });

});
