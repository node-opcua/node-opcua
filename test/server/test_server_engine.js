var should = require("should");

var NodeId = require("../../lib/nodeid").NodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var assert = require("assert");
var s = require("../../lib/structures");


var HasTypeDefinition = resolveNodeId("i=40");

function pack(obj) {
    if (obj.referenceType) {
        reference
    }
}
function Folder(options) {

    assert(options);
    assert(options.nodeId);
    assert(options.browseName);


    assert(this.referenceType.value === 61);

    this.nodeId = resolveNodeId(options.nodeId);

    this.browseName = options.browseName;

    options.displayName = options.displayName || options.browseName;

    this.displayName = [];
    if (typeof options.displayName  === "string") {
        this.displayName.push(new s.LocalizedText({ locale: "en", text: options.displayName }));
    }

    this.elements = [];

}
Folder.prototype.referenceType =resolveNodeId("FolderType");

function Variable(options) {

    assert(options);
    assert(options.nodeId);
    assert(options.browseName);

    this.referenceType = resolveNodeId("VariableType");

    this.nodeId = resolveNodeId(options.nodeId);

    this.displayName = [];
    this.displayName. push(new s.LocalizedText({ locale: "en", text: options.displayName }));

    this.browseName = options.browseName;

    this.value =  options.value;

}



function ServerEngine() {

    this._nodeid_index = {};
    this._browsename_index = {};
    this.rootFolder = new Folder( { nodeId: "RootFolder", browseName: "Root" });
    this._private_namespace = 1;
    this._internal_id_counter = 1000;

    this._register(this.rootFolder);

    this._add_objects_folder();
}



ServerEngine.prototype._register= function(object) {

    assert(object.nodeId);
    this._nodeid_index[object.nodeId.toString()] = object;
    this._browsename_index[object.browseName] = object.nodeId;

};
ServerEngine.prototype._resolveNodeId = function(nodeid){

    if (typeof nodeid === "string" ) {
        // check if the string is a known browse Name
        if (this._browsename_index.hasOwnProperty(nodeid)) {
            return this._browsename_index[nodeid];
        }
    }
    return resolveNodeId(nodeid);
};

ServerEngine.prototype._findObject= function(nodeId)
{
    nodeId = this._resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
};

ServerEngine.prototype._build_new_NodeId = function() {
    var nodeId =  new NodeId(this._internal_id_counter,this._private_namespace);
    this._internal_id_counter+=1;
    return nodeId;
};

ServerEngine.prototype.getFolder = function(folder) {
    // coerce rootFolder
    if (!(folder instanceof Folder)) {
        folder = this._findObject(folder) || folder;
    }
    assert(folder instanceof Folder, "expecting a Folder here " + folder);
    return folder;
};


ServerEngine.prototype.createFolder = function(parentFolder,newFolderName) {

    parentFolder = this.getFolder(parentFolder);


    options = {
        nodeId:               this._build_new_NodeId(),
        browseName:           newFolderName,
        hasTypeDefinition:    "FolderType",
        organizes_Reversed:   parentFolder.nodeId
    };
    return this._createObject(options);
};



ServerEngine.prototype._createObject = function(options)
{
    assert(options.hasTypeDefinition, "must have options.hasTypeDefinition");
    var typeDefinitionId = this._resolveNodeId(options.hasTypeDefinition);
    assert(typeDefinitionId.toString() ===  "ns=0;i=61" ); // FolderType

    var object = new Folder({
        nodeId:     options.nodeId,
        browseName: options.browseName,
        symbolicName: options.symbolicName || options.browseName,
        displayName: options.displayName || options.browseName,
        description: options.description
    });
    this._register(object);

    if (options.organizes_Reversed) {
        // bind object with parent
        var parent = this._findObject(options.organizes_Reversed);
        parent.elements.push(object);
        object.parent = parent;
    }

    return object;
};

ServerEngine.prototype._add_objects_folder = function() {

    var options  = {
        nodeId:       "i=85",
        browseName:   "Objects",
        symbolicName: "ObjectsFolder",
        displayName:  "Objects",
        description:  "The browse entry point when looking for objects in the server address space.",
        hasTypeDefinition: "FolderType",
        organizes_Reversed:"i=84"
    };
    return this._createObject(options);

};

ServerEngine.prototype.addVariableInFolder = function(parentFolder,variableDefinition){

    parentFolder = this.getFolder(parentFolder);

    var variableName = variableDefinition.name;
    var value        = variableDefinition.value;

    var newNodeId = this._build_new_NodeId();
    var variable = new Variable( { nodeId: newNodeId, browseName: variableName, value: value });
    this._register(variable);

    parentFolder.elements.push(variable);

    variable.parent = parentFolder;
    return variable;
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


    it("should have a rootFolder ",function(){

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
        newFolder.parent.should.equal(rootFolder);

    });

    it("should allow browse a newly created folder",function(){

        var server = new server_engine.ServerEngine();
        var newFolder = server.createFolder("RootFolder","MyNewFolder");

        var result = server.browseSync(newFolder.nodeId);
        result.should.eql(newFolder);

    });

    it("should allow to create a variable in a folder",function(){

        var server = new server_engine.ServerEngine();
        var rootFolder = server.browseSync(resolveNodeId("RootFolder"));
        var newFolder  = server.createFolder("RootFolder","MyNewFolder");

        var newVariable = server.addVariableInFolder("MyNewFolder",
            {
                name: "Temperature",
                value: 10.0
            });

        newVariable.should.be.instanceOf(Variable);
        newVariable.parent.should.equal(newFolder);

    });

    it("should have ObjectsFolder",function(){



    });
});