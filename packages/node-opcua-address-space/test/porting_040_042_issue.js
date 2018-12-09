"use strict";

const should = require("should");

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const NodeId = require("node-opcua-nodeid").NodeId;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("#513 Testing issue porting from 0.4.0 0.4.2",function() {


    let addressSpace = null, rootFolder;

    let namespace;
    before(function (done) {
        get_mini_address_space(function (err, data) {

            addressSpace = data;

            addressSpace.getNamespaceArray().length.should.eql(2);

            namespace = addressSpace.getOwnNamespace();
            namespace.index.should.eql(1);

            rootFolder = addressSpace.findNode("RootFolder");
            done(err);
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        rootFolder = null;
    });


    it("should not raise a error when browseName is used un-consistently but a warning",function() {

        const o = addressSpace.addObject({
            browseName: "1:MyObject",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects
        });

        const node = addressSpace.addVariable({
            browseName: "2:MyVariable",
            dataType: "Double",
            componentOf: o
        });
        node.browseName.namespaceIndex.should.eql(1);
    });

    it("should not raise a error nor a warning when browseName contains a comma in the middle",function() {

        const o = addressSpace.addObject({
            browseName: "MyObject:With:3:Columns",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects
        });
        o.browseName.namespaceIndex.should.eql(1);
        o.browseName.toString().should.eql("1:MyObject:With:3:Columns");
        o.browseName.name.should.eql("MyObject:With:3:Columns");
    });

});