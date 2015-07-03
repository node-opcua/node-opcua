"use strict";
require("requirish")._(module);
var should  = require("should");
var assert = require("assert");

var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

var NodeId = require("lib/datamodel/nodeid").NodeId;

describe("testing address space",function(){

    var address_space = null,baseObjectType,rootFolder;
    before(function(done){
        get_mini_address_space(function(err,data) {
            address_space = data;
            baseObjectType = address_space.findObject("BaseObjectType").nodeId;
            rootFolder = address_space.findObject("RootFolder");
            done(err);
        });
    });
    function find_reference(references,nodeId) {
        assert(nodeId instanceof NodeId);
        return references.filter(function(r){return r.nodeId.toString() === nodeId.toString();});
    }

    it("should be possible to remove an object previously added to the address space",function() {

        var options ={ browseName: "SomeObject"  };
        var object = address_space.addObjectInFolder("RootFolder",options);

        // object shall  be found with a global nodeId search
        address_space.findObject(object.nodeId).should.eql(object);

        // object shall  be found in parent folder
        var references = rootFolder.findReferences("HasComponent",true);
        find_reference(references,object.nodeId).length.should.eql(1);


        address_space.deleteObject(object.nodeId);

        // object shall not be found with a global nodeId search
        should(address_space.findObject(object.nodeId)).eql(undefined);

        // object shall not be found in parent folder anymore
        references = rootFolder.findReferences("HasComponent",true);
        find_reference(references,object.nodeId).length.should.eql(0);

    });

    it("should be possible to remove an object and its children previously added to the address space",function() {

        var options ={ browseName: "SomeObject"  };
        var object = address_space.addObjectInFolder("RootFolder",options);
        var innerVar = address_space.addVariable(object,{browseName: "Hello", dataType:"String"});

        // object shall  be found with a global nodeId search
        address_space.findObject(object.nodeId).should.eql(object);
        address_space.findObject(innerVar.nodeId).should.eql(innerVar);

        var references = object.findReferences("HasComponent",true);
        find_reference(references,innerVar.nodeId).length.should.eql(1);

        references = rootFolder.findReferences("HasComponent",true);
        find_reference(references,object.nodeId).length.should.eql(1);

        address_space.deleteObject(object.nodeId);

        // object shall not be found with a global nodeId search
        should(address_space.findObject(object.nodeId)).eql(undefined);
        should(address_space.findObject(innerVar.nodeId)).eql(undefined);

    });

});
