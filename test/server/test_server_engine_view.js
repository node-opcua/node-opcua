require("requirish")._(module);
var should = require("should");
import ServerEngine , { mini_nodeset_filename } from "lib/server/ServerEngine";
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;
var read_service = require("lib/services/read_service");
var TimestampsToReturn = read_service.TimestampsToReturn;
var util = require("util");
var NodeId = require("lib/datamodel/nodeid").NodeId;
var assert = require("better-assert");
var AttributeIds = read_service.AttributeIds;

var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var VariableIds = require("lib/opcua_node_ids").VariableIds;
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

describe("Testing the server  engine - View related ", function () {

    var engine;
    beforeEach(function (done) {
        resourceLeakDetector.start();
        engine = new ServerEngine();
        engine.initialize({nodeset_filename: mini_nodeset_filename}, function () {
            var FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            var BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });
    afterEach(function () {
        should.exist(engine);
        engine.shutdown();
        engine = null;
        resourceLeakDetector.stop();
    });

    it("should create a view in the address space", function () {

        var viewsFolder = engine.addressSpace.findNode("ViewsFolder");

        var view = engine.addressSpace.addView({
            organizedBy: viewsFolder,
            browseName: "MyView"
        });
        console.log(view.toString());
        view.browseName.toString().should.eql("MyView");
        //xx view.parentObj.browseName.toString().should.eql("Views");
    });
});
