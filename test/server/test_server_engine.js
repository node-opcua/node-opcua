var should = require("should");
var server_engine = require("../../lib/server/server_engine");
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var NodeClass = require("../../lib/browse_service").NodeClass;
var browse_service = require("../../lib/browse_service");
var util = require("util");
var NodeId = require("../../lib/nodeid").NodeId;
var assert = require("assert");
var Variable = server_engine.Variable;
var Folder = server_engine.Folder;


describe("ServerEngine", function () {


    it("should have a rootFolder ", function () {

        var server = new server_engine.ServerEngine();
        server.rootFolder.should.instanceOf(Folder);

    });

    it("should find the rootFolder by browseName", function () {

        var server = new server_engine.ServerEngine();
        var browseNode = server.findObject("RootFolder");

        browseNode.should.be.instanceOf(Folder);
        browseNode.should.equal(server.rootFolder);


    });

    it("should find the rootFolder by nodeId", function () {

        var server = new server_engine.ServerEngine();
        var browseNode = server.findObject("i=84");

        browseNode.should.be.instanceOf(Folder);
        browseNode.should.equal(server.rootFolder);

    });

    it("should have an ObjectsFolder", function () {

        var server = new server_engine.ServerEngine();
        var rootFolder = server.findObject("RootFolder");

        var objectFolder = server.findObject("ObjectsFolder");
        objectFolder.parent.should.equal(rootFolder);

    });

    it("should allow to create a new folder", function () {

        var server = new server_engine.ServerEngine();
        var rootFolder = server.findObject("RootFolder");
        var newFolder = server.createFolder("RootFolder", "MyNewFolder");

        newFolder.should.be.instanceOf(Folder);
        newFolder.parent.should.equal(rootFolder);

    });

    it("should allow to find a newly created folder by nodeId", function () {

        var server = new server_engine.ServerEngine();
        var newFolder = server.createFolder("ObjectsFolder", "MyNewFolder");

        assert(newFolder.nodeId instanceof NodeId);
        newFolder.nodeId.toString().should.eql("ns=1;i=1000");

        var result = server.findObject(newFolder.nodeId);
        result.should.eql(newFolder);

    });

    it("should allow to find a newly created folder by nodeId string", function () {
        var server = new server_engine.ServerEngine();

        var newFolder = server.createFolder("ObjectsFolder", "MyNewFolder");

        var result = server.findObject(newFolder.nodeId);
        result.should.eql(newFolder);
    });


    it("should allow to create a variable in a folder", function () {

        var server = new server_engine.ServerEngine();
        var rootFolder = server.findObject("ObjectsFolder");
        var newFolder = server.createFolder("ObjectsFolder", "MyNewFolder");

        var newVariable = server.addVariableInFolder("MyNewFolder",
            {
                name: "Temperature",
                value: 10.0
            });

        newVariable.value.should.equal(10.0);

        newVariable.should.be.instanceOf(Variable);
        newVariable.parent.should.equal(newFolder);

    });


    it("should browse object folder",function(){
        var server = new server_engine.ServerEngine();

        var browseResult = server.browseSync("ObjectsFolder");

        browseResult.statusCode.should.equal(0);
        browseResult.references.length.should.equal(1);

        browseResult.references[0].isForward.should.equal(false);
        browseResult.references[0].browseName.name.should.equal("Root");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=84");
        //xx browseResult.references[0].displayName.text.should.equal("Root");
        browseResult.references[0].typeDefinition.should.eql(resolveNodeId("FolderType"));
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);


    });
    it("should browse root folder",function(){

        var server = new server_engine.ServerEngine();

        var browseResult = server.browseSync("RootFolder");

        browseResult.statusCode.should.equal(0);
        browseResult.references.length.should.equal(1);

        browseResult.references[0].isForward.should.equal(true);
        browseResult.references[0].browseName.name.should.equal("Objects");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=85");
        //xx browseResult.references[0].displayName.text.should.equal("Root");
        browseResult.references[0].typeDefinition.should.eql(resolveNodeId("FolderType"));
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);

    });

});