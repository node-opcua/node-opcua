var should = require("should");

var NodeId = require("../../lib/nodeid").NodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var assert = require("assert");
var s = require("../../lib/structures");


function Folder(options)
{
    assert(options);
    assert(options.nodeId);

    this.referenceType = resolveNodeId("FolderType");

    this.nodeId = resolveNodeId(options.nodeId);

    this.displayName = [];
    this.displayName. push(new s.LocalizedText({ locale: "en", text: options.displayName }));

    this.elements = [];

}





function ServerEngine()
{

    this._object_index = {};

    this.rootFolder = new Folder( { nodeId: "RootFolder", displayName: "Root" });
    this._private_namespace = 1;
    this._internal_id_counter = 1000;

    this._register(this.rootFolder);
};

ServerEngine.prototype._register= function(object) {
    assert(object.nodeId);
    this._object_index[object.nodeId.toString()] = object;
};
ServerEngine.prototype._findObject= function(nodeId)
{
    nodeId = resolveNodeId(nodeId);
    return this._object_index[nodeId.toString()];
};

ServerEngine.prototype._build_new_NodeId = function() {
    var nodeId =  new NodeId(this._internal_id_counter,this._private_namespace);
    this._internal_id_counter+=1;
    return nodeId;
};

ServerEngine.prototype.createFolder = function(parentFolder,newFolderName)
{
    // coerce rootFolder
    if (!(parentFolder instanceof Folder)) {
        parentFolder = this._findObject(parentFolder);
    }
    assert(parentFolder instanceof Folder, "expecting a Folder here");

    var newNodeId = this._build_new_NodeId();

    var folder = new Folder( { nodeId: newNodeId, displayName: "Root" });
    this._register(folder);

    parentFolder.elements.push(folder);

    return folder;

};


ServerEngine.prototype.browseSync = function(nodeToBrowse)
{
    // coerce nodeToBrowse to NodeId
    nodeToBrowse = resolveNodeId(nodeToBrowse);
    assert( nodeToBrowse instanceof NodeId);

    return this._findObject(nodeToBrowse);

};


// var server_engine = require("server_engine");
server_engine = {};
server_engine.ServerEngine = ServerEngine;


describe("ServerEngine",function(){


    it("should create a ServerEngine",function(){

        var server = new server_engine.ServerEngine();

        server.rootFolder.should.instanceOf(Folder);


    });

    it("should browse the RootFolder",function(){

        var server = new server_engine.ServerEngine();

        var browseNode = server.browseSync(resolveNodeId("RootFolder"));

        browseNode.should.be.instanceOf(Folder);

        browseNode.should.equal(server.rootFolder);


    });

    it("should allow to create a new folder",function(){

        var server = new server_engine.ServerEngine();

        var rootFolder = server.browseSync(resolveNodeId("RootFolder"));

        var newFolder = server.createFolder("RootFolder","MyNewFolder");

        newFolder.should.be.instanceOf(Folder);

        var result = server.browseSync(newFolder.nodeId);

        result.should.eql(newFolder);



    });
});