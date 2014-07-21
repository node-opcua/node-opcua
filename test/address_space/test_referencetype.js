
var address_space = require("../../lib/address_space/address_space");
var generate_address_space = require("../../lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = address_space.AddressSpace;
var should  = require("should");
var nodeid = require("../../lib/datamodel/nodeid");
var ReferenceType = address_space.ReferenceType;

var _ = require("underscore");
var assert = require("better-assert");
var redirectToFile = require("../../lib/misc/utils").redirectToFile;



describe("testing ReferenceType",function(){

    var util = require("util");
    var nodeset_filename = __dirname+ "/../../lib/server/mini.Node.Set2.xml";
    var address_space = new AddressSpace();
    before(function(done){
        generate_address_space(address_space, nodeset_filename,function(){
            done();
        });
    });
    it("should find 'HierarchicalReferences'",function(){

       var hr =  address_space.findReferenceType("HierarchicalReferences");
       hr.browseName.should.equal("HierarchicalReferences");
       hr.nodeId.should.eql(nodeid.makeNodeId(33));

    });
    it("should find 'Organizes'",function(){
        var organizes_refId =  address_space.findReferenceType("Organizes");
        organizes_refId.browseName.should.equal("Organizes");
        organizes_refId.nodeId.should.eql(nodeid.makeNodeId(35));
    });
    it("'Organizes' should be a sub-type of 'HierarchicalReferences'",function(){

        var hr =  address_space.findReferenceType("HierarchicalReferences");
        var organizes_refId =  address_space.findReferenceType("Organizes");

        organizes_refId.isSubtypeOf(hr).should.eql(true);
        hr.isSubtypeOf(organizes_refId).should.eql(false);

    });

    it("'HasTypeDefinition' should *not* be a sub-type of 'HierarchicalReferences'",function(){

        var hr =  address_space.findReferenceType("HierarchicalReferences");
        var hasTypeDefinition_refId =  address_space.findReferenceType("HasTypeDefinition");

        hasTypeDefinition_refId.isSubtypeOf(hr).should.eql(false);
        hr.isSubtypeOf(hasTypeDefinition_refId).should.eql(false);

    });
    it("'HasTypeDefinition' should  be a sub-type of 'NonHierarchicalReferences'",function(){

        var nhr =  address_space.findReferenceType("NonHierarchicalReferences");
        var hasTypeDefinition_refId =  address_space.findReferenceType("HasTypeDefinition");

        hasTypeDefinition_refId.isSubtypeOf(nhr).should.eql(true);
        nhr.isSubtypeOf(hasTypeDefinition_refId).should.eql(false);

    });


    it("should return 4 refs for browseNode on RootFolder ,  referenceTypeId=null,!includeSubtypes  ",function(){
        var browse_service = require("../../lib/services/browse_service");
        var rootFolder = address_space.findObjectByBrowseName("Root");
        rootFolder.browseName.should.equal("Root");

        var references  = rootFolder.browseNode({
            browseDirection : browse_service.BrowseDirection.Forward,
            referenceTypeId : null,
            includeSubtypes : false,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(4);
    });

    it("should return 1 refs for browseNode on RootFolder ,  NonHierarchicalReferences, includeSubtypes  ",function(){
        var browse_service = require("../../lib/services/browse_service");
        var rootFolder = address_space.findObjectByBrowseName("Root");
        rootFolder.browseName.should.equal("Root");

        var references  = rootFolder.browseNode({
            browseDirection : browse_service.BrowseDirection.Forward,
            referenceTypeId : "NonHierarchicalReferences",
            includeSubtypes : true,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(1);
    });
    it("should return 3 refs for browseNode on RootFolder , Organizes ,!includeSubtypes  ",function(){
        var browse_service = require("../../lib/services/browse_service");
        var rootFolder = address_space.findObjectByBrowseName("Root");
        rootFolder.browseName.should.equal("Root");

        var references  = rootFolder.browseNode({
            browseDirection : browse_service.BrowseDirection.Forward,
            referenceTypeId : "Organizes",
            includeSubtypes : false,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(3);
    });

    it("should return 0 refs for browseNode on RootFolder , HierarchicalReferences ,!includeSubtypes  ",function(){
        var browse_service = require("../../lib/services/browse_service");
        var rootFolder = address_space.findObjectByBrowseName("Root");
        rootFolder.browseName.should.equal("Root");

        var references  = rootFolder.browseNode({
            browseDirection : browse_service.BrowseDirection.Both,
            referenceTypeId : "HierarchicalReferences",
            includeSubtypes : false,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });
        var browseNames = references.map(function (r) { return r.browseName.name;  });

        references.length.should.equal(0);
    });


    it("should return 3 refs for browseNode on RootFolder , HierarchicalReferences , includeSubtypes  ",function(){
        var browse_service = require("../../lib/services/browse_service");
        var rootFolder = address_space.findObjectByBrowseName("Root");
        rootFolder.browseName.should.equal("Root");

        var references  = rootFolder.browseNode({
            browseDirection : browse_service.BrowseDirection.Both,
            referenceTypeId : "HierarchicalReferences",
            includeSubtypes : true,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(3);
    });

    it("should return 6 refs for browseNode on ServerStatus (BrowseDirection.Forward)",function() {

        var browse_service = require("../../lib/services/browse_service");
        var serverStatus = address_space.findObjectByBrowseName("ServerStatus");
        serverStatus.browseName.should.equal("ServerStatus");

        var references = serverStatus.browseNode({
            browseDirection: browse_service.BrowseDirection.Forward,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(6);

        var expectedBrowseNames = [ 'StartTime', 'CurrentTime', 'State', 'BuildInfo', 'SecondsTillShutdown', 'ShutdownReason'];

        var browseNames = references.map(function (r) { return r.browseName.name;  });

        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

    });
    it("should return 7 refs for browseNode on ServerStatus (BrowseDirection.Both)",function(done){

        var browse_service = require("../../lib/services/browse_service");
        var serverStatus = address_space.findObjectByBrowseName("ServerStatus");
        serverStatus.browseName.should.equal("ServerStatus");

        var references  = serverStatus.browseNode({
            browseDirection : browse_service.BrowseDirection.Both,
            referenceTypeId : "HierarchicalReferences",
            includeSubtypes : true,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });

        references.length.should.equal(7);
        var browseNames = references.map(function(r){return r.browseName.name;});
        var expectedBrowseNames = [ 'StartTime', 'CurrentTime', 'State', 'BuildInfo', 'SecondsTillShutdown', 'ShutdownReason' , 'Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

        redirectToFile("ReferenceDescription",function(){
            assert(_.isArray(references));
            var dump = require("../../lib/address_space/basenode").dumpReferenceDescriptions;
            dump(address_space,references);
        },done)
    });

    it("should return 1 refs for browseNode on ServerStatus (BrowseDirection.Reverse)",function(){

        var browse_service = require("../../lib/services/browse_service");
        var serverStatus = address_space.findObjectByBrowseName("ServerStatus");
        serverStatus.browseName.should.equal("ServerStatus");

        var references  = serverStatus.browseNode({
            browseDirection : browse_service.BrowseDirection.Inverse,
            referenceTypeId : "HierarchicalReferences",
            includeSubtypes : true,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });

        references.length.should.equal(1);
        var browseNames = references.map(function(r){return r.browseName.name;});
        var expectedBrowseNames = [ 'Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);
    });

    it("should return 1 refs for browseNode on Server (BrowseDirection.Forward) and NodeClass set to Method",function() {

        var browse_service = require("../../lib/services/browse_service");
        var mask = browse_service.makeNodeClassMask("Method");

        var server = address_space.findObjectByBrowseName("Server");
        server.browseName.should.equal("Server");

        var references  = server.browseNode({
            browseDirection : browse_service.BrowseDirection.Forward,
            referenceTypeId : "HierarchicalReferences",
            includeSubtypes : true,
            nodeClassMask: mask, // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            resultMask: 0x3F
        });

        var browseNames = references.map(function(r){return r.browseName.name;});

        references.length.should.equal(1);

        var expectedBrowseNames = [ 'GetMonitoredItems'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

    });

    it("ReferenceType should have a toString (HierarchicalReferences)",function() {
        var hr =  address_space.findReferenceType("HierarchicalReferences");

        hr.toString().should.eql("A  HierarchicalReferences/HierarchicalReferences ns=0;i=33");
    });

    it("ReferenceType should have a toString (Organizes)",function() {
        var hr =  address_space.findReferenceType("Organizes");

        hr.toString().should.eql("   Organizes/OrganizedBy ns=0;i=35");
    });

});
