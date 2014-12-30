require("requirish")._(module);

var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var ReferenceType = address_space.ReferenceType;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;

var should  = require("should");
var nodeid = require("lib/datamodel/nodeid");

var dumpReferences = require("lib/address_space/basenode").dumpReferences;
var dumpBrowseDescription = require("lib/address_space/basenode").dumpBrowseDescription;
var browse_service = require("lib/services/browse_service");
var redirectToFile = require("lib/misc/utils").redirectToFile;

describe("testing dump browseDescriptions",function(){


    var util = require("util");
    var nodeset_filename = __dirname+ "/../../lib/server/mini.Node.Set2.xml";
    var address_space = new AddressSpace();
    before(function(done){
        generate_address_space(address_space, nodeset_filename,function(){
            done();
        });
    });


    it("should provide a service to build NodeClassMask easily",function(){

        var mask = browse_service.makeNodeClassMask("Object | ObjectType");
        mask.should.eql(1 + (1<<3));

    });

    it("should dump references",function(done) {

        var hr =  address_space.findReferenceType("HierarchicalReferences");

        redirectToFile("dumpReferences.log",function() {
            dumpReferences(address_space,hr.references);
        },done);

    });

    it("should dump a browseDescription",function(done){
        var browseDescription = {
            browseDirection : browse_service.BrowseDirection.Both,
            referenceTypeId : "HierarchicalReferences",
            includeSubtypes : true,
            nodeClassMask:  0, // 0 = all nodes
            resultMask: 0x3F
        };

        var hr =  address_space.findReferenceType("HierarchicalReferences");
        redirectToFile("dumpBrowseDescription.log",function() {
            dumpBrowseDescription(hr, browseDescription);
        },done);

    });

    it("should provide a convenient a way to construct the node full name ",function(){

        var obj = address_space.findObject("Server_ServerStatus_BuildInfo");
        obj.full_name().should.eql("Server.ServerStatus.BuildInfo");

    });
});


