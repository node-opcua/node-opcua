
var address_space = require("./address_space");
var generate_address_space = require("./load_nodeset2").generate_address_space;
var AddressSpace = address_space.AddressSpace;
var should  = require("should");
var nodeid = require("../lib/datamodel/nodeid");
var ReferenceType = address_space.ReferenceType;


var assert = require("better-assert");



describe("testing ReferenceType",function(){

    var util = require("util");
    var nodeset_filename = __dirname+ "/../lib/server/mini.Node.Set2.xml";
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


    it("should returns 4 refs for browseNode on RootFolder ,  referenceTypeId=null,!includeSubtypes  ",function(){
        var browse_service = require("../lib/services/browse_service");
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

    it("should returns 1 refs for browseNode on RootFolder ,  NonHierarchicalReferences, includeSubtypes  ",function(){
        var browse_service = require("../lib/services/browse_service");
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
    it("should returns 3 refs for browseNode on RootFolder , Organizes ,!includeSubtypes  ",function(){
        var browse_service = require("../lib/services/browse_service");
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

    it("should returns 0 refs for browseNode on RootFolder , HierarchicalReferences ,!includeSubtypes  ",function(){
        var browse_service = require("../lib/services/browse_service");
        var rootFolder = address_space.findObjectByBrowseName("Root");
        rootFolder.browseName.should.equal("Root");

        var references  = rootFolder.browseNode({
            browseDirection : browse_service.BrowseDirection.Both,
            referenceTypeId : "HierarchicalReferences",
            includeSubtypes : false,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(0);
    });


    it("should returns 3 refs for browseNode on RootFolder , HierarchicalReferences , includeSubtypes  ",function(){
        var browse_service = require("../lib/services/browse_service");
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
});
