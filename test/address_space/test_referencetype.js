/* global describe,it,require*/
require("requirish")._(module);

var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var should = require("should");
var nodeid = require("lib/datamodel/nodeid");
var AttributeIds =  require("lib/datamodel/attributeIds").AttributeIds;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var _ = require("underscore");
var assert = require("better-assert");
var redirectToFile = require("lib/misc/utils").redirectToFile;
var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

var browse_service = require("lib/services/browse_service");


describe("testing ReferenceType", function () {

    var util = require("util");
    var address_space;
    var rootFolder;

    before(function (done) {
        get_mini_address_space(function (err, data) {
            address_space = data;
            address_space.should.be.instanceOf(AddressSpace);

            rootFolder = address_space.findObjectByBrowseName("Root");
            rootFolder.browseName.should.equal("Root");

            done();
        });
    });

    it("should find 'HierarchicalReferences'", function () {

        var hr = address_space.findReferenceType("HierarchicalReferences");
        hr.browseName.should.equal("HierarchicalReferences");
        hr.nodeId.should.eql(nodeid.makeNodeId(33));

    });
    it("HierarchicalReferences should have an Abstract attribute set to true ",function() {

        var hr = address_space.findReferenceType("HierarchicalReferences");
        var v = hr.readAttribute(AttributeIds.IsAbstract);
        v.statusCode.should.eql(StatusCodes.Good);
        v.value.dataType.should.eql(DataType.Boolean);
        v.value.value.should.eql(true);

    });
    it("Organizes should have an Abstract attribute set to true ",function() {

        var hr = address_space.findReferenceType("Organizes");
        var v = hr.readAttribute(AttributeIds.IsAbstract);
        v.statusCode.should.eql(StatusCodes.Good);
        v.value.dataType.should.eql(DataType.Boolean);
        v.value.value.should.eql(false);
    });

    it("should find 'Organizes'", function () {
        var organizes_refId = address_space.findReferenceType("Organizes");
        organizes_refId.browseName.should.equal("Organizes");
        organizes_refId.nodeId.should.eql(nodeid.makeNodeId(35));
    });

    it("'Organizes' should be a super type of 'HierarchicalReferences'", function () {

        var hr = address_space.findReferenceType("HierarchicalReferences");
        var organizes_refId = address_space.findReferenceType("Organizes");

        organizes_refId.isSupertypeOf(hr).should.eql(true);
        hr.isSupertypeOf(organizes_refId).should.eql(false);

    });

    it("'HasTypeDefinition' should *not* be a super-type of 'HierarchicalReferences'", function () {

        var hr = address_space.findReferenceType("HierarchicalReferences");
        var hasTypeDefinition_refId = address_space.findReferenceType("HasTypeDefinition");

        hasTypeDefinition_refId.isSupertypeOf(hr).should.eql(false);
        hr.isSupertypeOf(hasTypeDefinition_refId).should.eql(false);

    });

    it("'HasTypeDefinition' should  be a super-type of 'NonHierarchicalReferences'", function () {

        var nhr = address_space.findReferenceType("NonHierarchicalReferences");
        var hasTypeDefinition_refId = address_space.findReferenceType("HasTypeDefinition");

        hasTypeDefinition_refId.isSupertypeOf(nhr).should.eql(true);
        nhr.isSupertypeOf(hasTypeDefinition_refId).should.eql(false);

    });


    it("should return 4 refs for browseNode on RootFolder ,  referenceTypeId=null,!includeSubtypes  ", function () {


        var references = rootFolder.browseNode({
            browseDirection: browse_service.BrowseDirection.Forward,
            referenceTypeId: null,
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(4);
    });

    it("should return 1 refs for browseNode on RootFolder ,  NonHierarchicalReferences, includeSubtypes  ", function () {

        var references = rootFolder.browseNode({
            browseDirection: browse_service.BrowseDirection.Forward,
            referenceTypeId: "NonHierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(1);
    });

    it("should return 3 refs for browseNode on RootFolder , Organizes ,!includeSubtypes  ", function () {

        var references = rootFolder.browseNode({
            browseDirection: browse_service.BrowseDirection.Forward,
            referenceTypeId: "Organizes",
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(3);
    });

    it("should return 0 refs for browseNode on RootFolder , HierarchicalReferences ,!includeSubtypes  ", function () {

        var references = rootFolder.browseNode({
            browseDirection: browse_service.BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        browseNames.length.should.be.equal(0);

        references.length.should.equal(0);
    });


    it("should return 3 refs for browseNode on RootFolder , HierarchicalReferences , includeSubtypes  ", function () {

        var serverStatus = rootFolder.objects.server.serverStatus;
        serverStatus.browseName.should.equal("ServerStatus");

        var references = rootFolder.browseNode({
            browseDirection: browse_service.BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(3);
    });

    it("should return 6 refs for browseNode on ServerStatus (BrowseDirection.Forward)", function () {

        var serverStatus = rootFolder.objects.server.serverStatus;
        serverStatus.browseName.should.equal("ServerStatus");

        var references = serverStatus.browseNode({
            browseDirection: browse_service.BrowseDirection.Forward,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        console.log("              " + browseNames.join(" , "));

        references.length.should.equal(6);

        var expectedBrowseNames = ['StartTime', 'CurrentTime', 'State', 'BuildInfo', 'SecondsTillShutdown', 'ShutdownReason'];

        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

    });

    it("ServerStatus parent shall be Server", function (done) {

        var server = rootFolder.objects.server;
        server.browseName.should.equal("Server");
        server.nodeId.toString().should.equal("ns=0;i=2253");

        var serverStatus = server.serverStatus;
        serverStatus.browseName.should.equal("ServerStatus");
        serverStatus.nodeId.toString().should.equal("ns=0;i=2256");

        serverStatus.parent.should.equal(server.nodeId);
        done();
    });

    it("T1 ServerType shall have a child named ServerStatus", function (done) {


        done();
    });


    it("should return 1 refs for browseNode on ServerStatus (BrowseDirection.Reverse)", function (done) {

        var serverStatus = rootFolder.objects.server.serverStatus;

        var references = serverStatus.browseNode({
            browseDirection: browse_service.BrowseDirection.Inverse,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });

        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        console.log("             browseNames :  " + browseNames.join(" , "));

        //xx references.length.should.equal(7);
        var expectedBrowseNames = [ 'Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

        redirectToFile("ReferenceDescription1.log", function () {
            assert(_.isArray(references));
            var dump = require("lib/address_space/basenode").dumpReferenceDescriptions;
            dump(address_space, references);
        }, done)
    });



    it("should return 7 refs for browseNode on ServerStatus (BrowseDirection.Both)", function (done) {

        var serverStatus = rootFolder.objects.server.serverStatus;

        var references = serverStatus.browseNode({
            browseDirection: browse_service.BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });

        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        console.log("              " + browseNames.join(" , "));

        var expectedBrowseNames = ['StartTime', 'CurrentTime', 'State', 'BuildInfo', 'SecondsTillShutdown', 'ShutdownReason', 'Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

        redirectToFile("ReferenceDescription2.log", function () {
            assert(_.isArray(references));
            var dump = require("lib/address_space/basenode").dumpReferenceDescriptions;
            dump(address_space, references);
        }, done)

    });

    it("should return 1 refs for browseNode on ServerStatus (BrowseDirection.Reverse)", function () {

        var serverStatus = rootFolder.objects.server.serverStatus;

        var references = serverStatus.browseNode({
            browseDirection: browse_service.BrowseDirection.Inverse,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });

        references.length.should.equal(1);
        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        var expectedBrowseNames = ['Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);
    });

    it("should return 1 refs for browseNode on Server (BrowseDirection.Forward) and NodeClass set to Method", function () {

        var browse_service = require("lib/services/browse_service");
        var mask = browse_service.makeNodeClassMask("Method");

        var server = rootFolder.objects.server;
        server.browseName.should.equal("Server");

        var references = server.browseNode({
            browseDirection: browse_service.BrowseDirection.Forward,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: mask, // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            resultMask: 0x3F
        });

        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });

        references.length.should.equal(1);

        var expectedBrowseNames = ['GetMonitoredItems'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

    });

    it("ReferenceType should have a toString (HierarchicalReferences)", function () {
        var hr = address_space.findReferenceType("HierarchicalReferences");

        hr.toString().should.eql("A  HierarchicalReferences/HierarchicalReferences ns=0;i=33");
    });

    it("ReferenceType should have a toString (Organizes)", function () {
        var hr = address_space.findReferenceType("Organizes");

        hr.toString().should.eql("   Organizes/OrganizedBy ns=0;i=35");
    });

});


describe(" improving performance of isSupertypeOf", function () {


    var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
    //  References i=31
    //  +->(hasSubtype) NoHierarchicalReferences
    //                  +->(hasSubtype) HasTypeDefinition
    //  +->(hasSubtype) HierarchicalReferences
    //                  +->(hasSubtype) HasChild/ChildOf
    //                                  +->(hasSubtype) Aggregates/AggregatedBy
    //                                                  +-> HasProperty/PropertyOf
    //                                                  +-> HasComponent/ComponentOf
    //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
    //                                 +->(hasSubtype) HasSubtype/HasSupertype
    //                  +->(hasSubtype) Organizes/OrganizedBy
    //                  +->(hasSubtype) HasEventSource/EventSourceOf
    var Benchmarker = require("test/helpers/benchmarker").Benchmarker;
    var bench = new Benchmarker();

    var referenceTypeNames = Object.keys(require("lib/opcua_node_ids").ReferenceTypeIds);

    var referenceTypes = [];
    var address_space;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            address_space = data;

            referenceTypes = referenceTypeNames.map(function (referenceTypeName) {
                return address_space.findReferenceType(referenceTypeName);
            });
            referenceTypes = referenceTypes.filter(function (e) {
                return e != undefined;
            });

            assert(referenceTypes[0].nodeClass === NodeClass.ReferenceType);
            done();
        });
    });


    it("should ensure that optimized version of isSupertypeOf produce same result as brute force version", function (done) {

        referenceTypes.forEach(function (referenceType) {
            var flags1 = referenceTypes.map(function (refType) {
                return referenceType.isSupertypeOf(refType);
            });
            var flags2 = referenceTypes.map(function (refType) {
                return referenceType._slow_isSupertypeOf(refType);
            });

            //xx console.log( referenceType.browseName,flags1.map(function(f){return f ? 1 :0;}).join(" - "));
            //xx console.log( referenceType.browseName,flags2.map(function(f){return f ? 1 :0;}).join(" - "));
            flags1.should.eql(flags2);

        });
        done();
    });

    it("should ensure that optimized version of isSupertypeOf is really faster that brute force version", function (done) {

        //xx console.log("referenceTypes",referenceTypes.map(function(e){return e.browseName;}));
        bench.add('isSupertypeOf slow', function () {

            referenceTypes.forEach(function (referenceType) {
                referenceTypes.map(function (refType) {
                    return referenceType._slow_isSupertypeOf(refType);
                });
            });

        })
        .add('isSupertypeOf fast', function () {

            referenceTypes.forEach(function (referenceType) {
                referenceTypes.map(function (refType) {
                    return referenceType.isSupertypeOf(refType);
                });

            });
        })
        .on('cycle', function (message) {
            console.log(message);
        })
        .on('complete', function () {

            console.log(' Fastest is ' + this.fastest.name);
            console.log(' Speed Up : x', this.speedUp);
            this.fastest.name.should.eql("isSupertypeOf fast");

            this.speedUp.should.be.greaterThan(10);

            done();
        })
        .run();
    });
});