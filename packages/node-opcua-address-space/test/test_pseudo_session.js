"use strict";
const should = require("should");
const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;
const AddressSpace = require("../src/address_space").AddressSpace;
const PseudoSession = require("../src/pseudo_session").PseudoSession;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;
const makeNodeClassMask = require("node-opcua-data-model").makeNodeClassMask;
const makeResultMask = require("node-opcua-data-model").makeResultMask;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("PseudoSession", function() {
    let addressSpace;

    let session;
    before(function(done) {
        get_mini_address_space(function(err, __addressSpace__) {
            addressSpace = __addressSpace__;
            session = new PseudoSession(addressSpace);
            done(err);
        });
    });
    after(function(done) {

        addressSpace.dispose();
        done();
    });

    it("should browse a single node ", function(done) {
        const nodeToBrowse = /*BrowseDescription*/ {
            referenceTypeId: null,
            nodeClassMask: makeNodeClassMask("Object"),
            includeSubtypes: false,
            browseDirection: BrowseDirection.Forward,
            nodeId: "i=84",
            resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
        };
        session.browse(nodeToBrowse, function(err, browseResult) {
            should.not.exist(err);
            should.exist(browseResult);
            browseResult.constructor.name.should.eql("BrowseResult");
            browseResult.references.length.should.eql(3);
            browseResult.references[0].browseName.toString().should.eql("Objects");
            browseResult.references[1].browseName.toString().should.eql("Types");
            browseResult.references[2].browseName.toString().should.eql("Views");
            //xx console.log(browseResult.toString());
            done();
        });
    });

    it("should browse multiple nodes ", function(done) {
        const nodeToBrowse = /*BrowseDescription*/ {
            referenceTypeId: null,
            nodeClassMask: makeNodeClassMask("Object"),
            includeSubtypes: false,
            browseDirection: BrowseDirection.Forward,
            nodeId: "i=84",
            resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
        };
        session.browse([nodeToBrowse, nodeToBrowse], function(err, browseResults) {
            should.not.exist(err);
            should.exist(browseResults);
            browseResults.should.be.instanceOf(Array);
            browseResults[0].constructor.name.should.eql("BrowseResult");
            browseResults[0].references.length.should.eql(3);
            browseResults[0].references[0].browseName.toString().should.eql("Objects");
            browseResults[0].references[1].browseName.toString().should.eql("Types");
            browseResults[0].references[2].browseName.toString().should.eql("Views");
            //xx console.log(browseResult.toString());
            browseResults[1].constructor.name.should.eql("BrowseResult");
            browseResults[1].references.length.should.eql(3);
            browseResults[1].references[0].browseName.toString().should.eql("Objects");
            browseResults[1].references[1].browseName.toString().should.eql("Types");
            browseResults[1].references[2].browseName.toString().should.eql("Views");
            done();
        });
    });

    it("should read a single node", function(done) {
        const nodeToRead = /*ReadValue*/ {
            nodeId: "i=84",
            attributeId: AttributeIds.BrowseName
        };
        session.read(nodeToRead, function(err, dataValue) {
            should.not.exist(err);
            should.exist(dataValue);
            dataValue.statusCode.should.eql(StatusCodes.Good);
            dataValue.value.value.toString().should.eql("Root");
            done();
        });
    });

    it("should read mutiple nodes", function(done) {
        const nodesToRead = [
            /*ReadValue*/ {
                nodeId: "i=84",
                attributeId: AttributeIds.BrowseName
            },
            /*ReadValue*/ {
                nodeId: "i=85",
                attributeId: AttributeIds.BrowseName
            }
        ];
        session.read(nodesToRead, function(err, dataValues) {
            should.not.exist(err);
            should.exist(dataValues);
            dataValues[0].statusCode.should.eql(StatusCodes.Good);
            dataValues[0].value.value.toString().should.eql("Root");

            dataValues[1].statusCode.should.eql(StatusCodes.Good);
            dataValues[1].value.value.toString().should.eql("Objects");
            done();
        });
    });
});
