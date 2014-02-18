var should = require("should");
var server_engine = require("../../lib/server/server_engine");
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var NodeClass = require("../../lib/browse_service").NodeClass;
var browse_service = require("../../lib/browse_service");
var read_service = require("../../lib/read_service");
var TimestampsToReturn = read_service.TimestampsToReturn;
var util = require("util");
var NodeId = require("../../lib/nodeid").NodeId;
var assert = require('better-assert');
var Variable = server_engine.Variable;
var AttributeIds = read_service.AttributeIds;
var Folder = server_engine.Folder;
var DataType = require("../../lib/variant").DataType;

describe("ServerEngine", function () {


    var server;
    beforeEach(function(){
        server = new server_engine.ServerEngine();
    })
    afterEach(function(){
        server = null;
    })

    it("should have a rootFolder ", function () {

        server.rootFolder.should.instanceOf(Folder);

    });

    it("should find the rootFolder by browseName", function () {

        var browseNode = server.findObject("RootFolder");

        browseNode.should.be.instanceOf(Folder);
        browseNode.should.equal(server.rootFolder);


    });

    it("should find the rootFolder by nodeId", function () {

        var browseNode = server.findObject("i=84");

        browseNode.should.be.instanceOf(Folder);
        browseNode.should.equal(server.rootFolder);

    });

    it("should have an ObjectsFolder", function () {

        var rootFolder = server.findObject("RootFolder");

        var objectFolder = server.findObject("ObjectsFolder");
        objectFolder.parent.should.equal(rootFolder);

    });

    it("should allow to create a new folder", function () {

        var rootFolder = server.findObject("RootFolder");
        var newFolder = server.createFolder("RootFolder", "MyNewFolder");

        newFolder.should.be.instanceOf(Folder);
        newFolder.parent.should.equal(rootFolder);

    });

    it("should allow to find a newly created folder by nodeId", function () {

        var newFolder = server.createFolder("ObjectsFolder", "MyNewFolder");

        assert(newFolder.nodeId instanceof NodeId);
        newFolder.nodeId.toString().should.eql("ns=1;i=1000");

        var result = server.findObject(newFolder.nodeId);
        result.should.eql(newFolder);

    });

    it("should allow to find a newly created folder by nodeId string", function () {

        var newFolder = server.createFolder("ObjectsFolder", "MyNewFolder");

        var result = server.findObject(newFolder.nodeId);
        result.should.eql(newFolder);
    });


    it("should allow to create a variable in a folder", function () {

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

        var browseResult = server.browseSingleNode("ObjectsFolder");

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

        var browseResult = server.browseSingleNode("RootFolder");

        browseResult.statusCode.should.equal(0);
        browseResult.references.length.should.equal(1);

        browseResult.references[0].isForward.should.equal(true);
        browseResult.references[0].browseName.name.should.equal("Objects");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=85");
        //xx browseResult.references[0].displayName.text.should.equal("Root");
        browseResult.references[0].typeDefinition.should.eql(resolveNodeId("FolderType"));
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);

    });

    it("should handle a BrowseRequest and set StatusCode if node doesn't exist",function() {

        var browseResult = server.browseSingleNode("ns=46;id=123456");

        browseResult.statusCode.toString(16).should.equal("80005e");
        browseResult.references.length.should.equal(0);


    });

    it("should handle a BrowseRequest with multiple nodes to browse",function() {

        var browseRequest = new browse_service.BrowseRequest({
            nodesToBrowse: [
                {
                    nodeId: resolveNodeId("RootFolder"),
                    includeSubtypes: true,
                    browseDirection: browse_service.BrowseDirection.Both,
                    resultMask: 63
                },
                {
                    nodeId: resolveNodeId("ObjectsFolder"),
                    includeSubtypes: true,
                    browseDirection: browse_service.BrowseDirection.Both,
                    resultMask: 63
                }
            ]
        });

        browseRequest.nodesToBrowse.length.should.equal(2);
        var results = server.browse(browseRequest.nodesToBrowse);

        results.length.should.equal(2);

    });

    it("should handle a readSingleNode - BrowseName",function() {

        var readResult = server.readSingleNode("RootFolder",AttributeIds.BrowseName);

        readResult.value.dataType.should.eql(DataType.QualifiedName);
        readResult.value.value.name.should.equal("Root");
    });

    it("should handle a readSingleNode - NodeClass",function() {

        var readResult = server.readSingleNode("RootFolder",AttributeIds.NodeClass);

        readResult.value.dataType.should.eql(DataType.UInt32);
        readResult.value.value.should.equal(NodeClass.Object.value);
    });

    it("should handle a readSingleNode - NodeId",function() {

        var readResult = server.readSingleNode("RootFolder",AttributeIds.NodeId);

        readResult.value.dataType.should.eql(DataType.NodeId);
        readResult.value.value.toString().should.equal("ns=0;i=84");
    });

    it("should handle a readSingleNode - DisplayName",function() {

        var readResult = server.readSingleNode("RootFolder",AttributeIds.DisplayName);

        readResult.value.dataType.should.eql(DataType.LocalizedText);
        readResult.value.value.text.toString().should.equal("Root");
    });

    it("should retun null  - readSingleNode - with unknown object",function() {

        var readResult = server.readSingleNode("**UNKNONW**",AttributeIds.DisplayName);
        assert(readResult === null);
    });

    it("should read ",function() {

        var readRequest = new read_service.ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: resolveNodeId("RootFolder"),
                    attributeId: AttributeIds.DisplayName,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ]
        });
        var dataValues = server.read(readRequest.nodesToRead);
        dataValues.length.should.equal(1);

    });

});