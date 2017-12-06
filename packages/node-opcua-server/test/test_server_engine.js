/* jslint */
/*global require,describe, it, before, after */
"use strict";
var should = require("should");

var assert = require("node-opcua-assert");
var util = require("util");

var server_engine = require("../src/server_engine");
var ServerEngine = server_engine.ServerEngine;

var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var NodeClass = require("node-opcua-data-model").NodeClass;

var browse_service = require("node-opcua-service-browse");
var BrowseDirection = require("node-opcua-data-model").BrowseDirection;

var read_service = require("node-opcua-service-read");
var TimestampsToReturn = read_service.TimestampsToReturn;
var NodeId = require("node-opcua-nodeid").NodeId;
var makeExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;
var AttributeIds = require("node-opcua-data-model").AttributeIds;

var DataType = require("node-opcua-variant").DataType;
var DataValue =  require("node-opcua-data-value").DataValue;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;

var VariableIds = require("node-opcua-constants").VariableIds;
var ObjectIds = require("node-opcua-constants").ObjectIds;
var Variant = require("node-opcua-variant").Variant;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;

var historizing_service = require("node-opcua-service-history");
var HistoryReadRequest = historizing_service.HistoryReadRequest;
var HistoryReadDetails = historizing_service.HistoryReadDetails;
var HistoryReadResult = historizing_service.HistoryReadResult;
var HistoryData = historizing_service.HistoryData;

var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255

var assert_arrays_are_equal = require("node-opcua-test-helpers").assert_arrays_are_equal;

var QualifiedName = require("node-opcua-data-model").QualifiedName;
var UAObject = require("node-opcua-address-space").UAObject;
var Reference = require("node-opcua-address-space").Reference;

var SessionContext = require("node-opcua-address-space").SessionContext;
var context = SessionContext.defaultContext;

function resolveExpandedNodeId(nodeId) {
    return makeExpandedNodeId(resolveNodeId(nodeId));
}

var describeWithLeakDetector = require("node-opcua-leak-detector").describeWithLeakDetector;
describeWithLeakDetector("testing ServerEngine", function () {

    var engine, FolderTypeId, BaseDataVariableTypeId, ref_Organizes_Id;

    var defaultBuildInfo = {
        productName: "NODEOPCUA-SERVER",
        softwareVersion: "1.0",
        manufacturerName: "<Manufacturer>",
        productUri: "URI:NODEOPCUA-SERVER"
    };
    before(function (done) {

        engine = new ServerEngine({buildInfo: defaultBuildInfo});

        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {

            FolderTypeId = engine.addressSpace.findObjectType("FolderType").nodeId;
            BaseDataVariableTypeId = engine.addressSpace.findVariableType("BaseDataVariableType").nodeId;
            ref_Organizes_Id = engine.addressSpace.findReferenceType("Organizes").nodeId;
            ref_Organizes_Id.toString().should.eql("ns=0;i=35");


            // add a variable as a Array of Double with some values
            var testArray = [];
            for (var i = 0; i < 10; i++) {
                testArray.push(i * 1.0);
            }

            engine.addressSpace.addVariable({
                  organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                  browseName: "TestArray",
                  nodeId: "ns=1;s=TestArray",
                  dataType: "Double",
                  value: {
                      get: function () {
                          return new Variant({
                              dataType: DataType.Double,
                              arrayType: VariantArrayType.Array,
                              value: testArray
                          });
                      },
                      set: null // read only
                  }
              }
            );

            // add a writable Int32
            engine.addressSpace.addVariable({
                  organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                  browseName: "WriteableInt32",
                  nodeId: "ns=1;s=WriteableInt32",
                  dataType: "Int32",
                  value: {
                      get: function () {
                          return new Variant({
                              dataType: DataType.Double,
                              arrayType: VariantArrayType.Array,
                              value: testArray
                          });
                      },
                      set: function (variant) {
                          // Variation 1 : synchronous
                          // assert(_.isFunction(callback));
                          return StatusCodes.Good;
                      }
                  }
              }
            );

            // add a writable Int32
            engine.addressSpace.addVariable({
                  organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                  browseName: "WriteableUInt32Async",
                  nodeId: "ns=1;s=WriteableUInt32Async",
                  dataType: "UInt32",
                  value: {
                      get: function () {
                          return new Variant({
                              dataType: DataType.Double,
                              arrayType: VariantArrayType.Array,
                              value: testArray
                          });
                      }

                  }
              }
            );
            done();
        });

    });
    after(function () {
        engine.shutdown();
        engine = null;
    });


    it("findReferenceType findReferenceTypeFromInverseName - should provide a way to access a referenceType from its inverse name", function () {
        var addressSpace = engine.addressSpace;
        var n1 = addressSpace.findReferenceType("Organizes").nodeId;
        should.not.exist(addressSpace.findReferenceType("OrganizedBy"));

        var n2 = addressSpace.findReferenceTypeFromInverseName("OrganizedBy").nodeId;
        should.not.exist(addressSpace.findReferenceTypeFromInverseName("Organizes"));

        n1.should.equal(n2);

    });

    it("findReferenceType findReferenceTypeFromInverseName - should normalize a {referenceType/isForward} combination", function () {
        var addressSpace = engine.addressSpace;

        addressSpace.normalizeReferenceType(
          {referenceType: "OrganizedBy", isForward: true}).should.eql(
          new Reference({referenceType: "Organizes", isForward: false})
        );

        addressSpace.normalizeReferenceType(
          {referenceType: "OrganizedBy", isForward: false}).should.eql(
          new Reference({referenceType: "Organizes", isForward: true})
        );
        addressSpace.normalizeReferenceType(
          {referenceType: "Organizes", isForward: false}).should.eql(
          new Reference({referenceType: "Organizes", isForward: false})
        );
        addressSpace.normalizeReferenceType(
          {referenceType: "Organizes", isForward: true}).should.eql(
          new Reference({referenceType: "Organizes", isForward: true})
        );
    });

    it("findReferenceType findReferenceTypeFromInverseName - should provide a easy way to get the inverse name of a Reference Type", function () {
        var addressSpace = engine.addressSpace;

        addressSpace.inverseReferenceType("Organizes").should.eql("OrganizedBy");
        addressSpace.inverseReferenceType("ChildOf").should.eql("HasChild");
        addressSpace.inverseReferenceType("AggregatedBy").should.eql("Aggregates");
        addressSpace.inverseReferenceType("PropertyOf").should.eql("HasProperty");
        addressSpace.inverseReferenceType("ComponentOf").should.eql("HasComponent");
        addressSpace.inverseReferenceType("HistoricalConfigurationOf").should.eql("HasHistoricalConfiguration");
        addressSpace.inverseReferenceType("HasSupertype").should.eql("HasSubtype");
        addressSpace.inverseReferenceType("EventSourceOf").should.eql("HasEventSource");

        addressSpace.inverseReferenceType("OrganizedBy").should.eql("Organizes");
        addressSpace.inverseReferenceType("HasChild").should.eql("ChildOf");
        addressSpace.inverseReferenceType("Aggregates").should.eql("AggregatedBy");
        addressSpace.inverseReferenceType("HasProperty").should.eql("PropertyOf");
        addressSpace.inverseReferenceType("HasComponent").should.eql("ComponentOf");
        addressSpace.inverseReferenceType("HasHistoricalConfiguration").should.eql("HistoricalConfigurationOf");
        addressSpace.inverseReferenceType("HasSubtype").should.eql("HasSupertype");
        addressSpace.inverseReferenceType("HasEventSource").should.eql("EventSourceOf");
    });

    it("should have a rootFolder ", function () {

        engine.rootFolder.typeDefinition.should.eql(FolderTypeId);

    });

    it("should find the rootFolder by browseName", function () {

        var browseNode = engine.addressSpace.findNode("RootFolder");

        browseNode.typeDefinition.should.eql(FolderTypeId);
        browseNode.should.equal(engine.rootFolder);

    });

    it("should find the rootFolder by nodeId", function () {

        var browseNode = engine.addressSpace.findNode("i=84");

        browseNode.typeDefinition.should.eql(FolderTypeId);
        browseNode.should.equal(engine.rootFolder);

    });

    it("should have an 'Objects' folder", function () {

        var rootFolder = engine.addressSpace.rootFolder;


        assert(rootFolder.objects);
        rootFolder.objects.findReferences("Organizes", false)[0].nodeId.should.eql(rootFolder.nodeId);
        rootFolder.objects.typeDefinitionObj.browseName.toString().should.eql("FolderType");
        rootFolder.objects.typeDefinition.should.eql(FolderTypeId);
    });

    it("should have a 'Server' object in the Objects Folder", function () {

        var server = engine.addressSpace.rootFolder.objects.server;
        assert(server);
        server.findReferences("Organizes", false)[0].nodeId.should.eql(engine.addressSpace.rootFolder.objects.nodeId);

    });

    it("should have a 'Server.NamespaceArray' Variable ", function () {

        var server = engine.addressSpace.rootFolder.objects.server;

        var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray);
        var server_NamespaceArray = engine.addressSpace.findNode(server_NamespaceArray_Id);
        assert(server_NamespaceArray !== null);

        //xx console.log(require("util").inspect(server_NamespaceArray));

        server_NamespaceArray.should.have.property("parent");
        // TODO : should(server_NamespaceArray.parent !==  null).ok;
        server_NamespaceArray.parent.nodeId.should.eql(server.nodeId);


    });

    it("should have a 'Server.Server_ServerArray' Variable", function () {

        // find 'Objects' folder
        var objects = engine.addressSpace.rootFolder.objects;
        var server = objects.server;

        var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_ServerArray);
        var server_NamespaceArray = engine.addressSpace.findNode(server_NamespaceArray_Id);
        assert(server_NamespaceArray !== null);
        //xx server_NamespaceArray.parent.nodeId.should.eql(serverObject.nodeId);
    });

    it("should be possible to create a new folder under the 'Root' folder", function () {

        // find 'Objects' folder
        var objects = engine.addressSpace.rootFolder.objects;

        var newFolder = engine.addressSpace.addFolder("ObjectsFolder", "MyNewFolder");
        assert(newFolder);

        newFolder.typeDefinition.should.eql(FolderTypeId);
        newFolder.nodeClass.should.eql(NodeClass.Object);

        newFolder.findReferences("Organizes", false)[0].nodeId.should.eql(objects.nodeId);

    });

    it("should be possible to find a newly created folder by nodeId", function () {

        var newFolder = engine.addressSpace.addFolder("ObjectsFolder", "MyNewFolder");

        // a specific node id should have been assigned by the engine
        assert(newFolder.nodeId instanceof NodeId);
        newFolder.nodeId.namespace.should.eql(1);

        var result = engine.addressSpace.findNode(newFolder.nodeId);
        result.should.eql(newFolder);

    });

    it("should be possible to find a newly created folder by 'browse name'", function () {

        var newFolder = engine.addressSpace.addFolder("ObjectsFolder", "MySecondNewFolder");

        var result = engine.addressSpace.rootFolder.objects.getFolderElementByName("MySecondNewFolder");
        assert(result !== null);
        result.should.eql(newFolder);
    });

    xit("should not be possible to create a object with an existing 'browse name'", function () {

        var newFolder1 = engine.addressSpace.addFolder("ObjectsFolder", "NoUniqueName");

        (function () {
            engine.addressSpace.addFolder("ObjectsFolder", "NoUniqueName");
        }).should.throw("browseName already registered");

        var result = engine.addressSpace.rootFolder.objects.getFolderElementByName("NoUniqueName");
        result.should.eql(newFolder1);
    });

    it("should be possible to create a variable in a folder", function (done) {

        var addressSpace = engine.addressSpace;
        var newFolder = addressSpace.addFolder("ObjectsFolder", "MyNewFolder1");

        var newVariable = addressSpace.addVariable(
          {
              componentOf: newFolder,
              browseName: "Temperature",
              dataType: "Float",
              value: {
                  get: function () {
                      return new Variant({dataType: DataType.Float, value: 10.0});
                  },
                  set: function () {
                      return StatusCodes.BadNotWritable;
                  }
              }

          });
        newVariable.typeDefinition.should.equal(BaseDataVariableTypeId);
        newVariable.parent.nodeId.should.equal(newFolder.nodeId);

        newVariable.readValueAsync(context, function (err, dataValue) {
            if (!err) {
                dataValue.statusCode.should.eql(StatusCodes.Good);
                dataValue.value.should.be.instanceOf(Variant);
                dataValue.value.value.should.equal(10.0);
            }
            done(err);
        });


    });

    it("should be possible to create a variable in a folder with a predefined nodeID", function () {

        var newFolder = engine.addressSpace.addFolder("ObjectsFolder", "MyNewFolder3");

        var newVariable = engine.addressSpace.addVariable({
            componentOf: newFolder,
            nodeId: "ns=4;b=01020304ffaa",  // << fancy node id here !
            browseName: "Temperature",
            dataType: "Double",
            value: {
                get: function () {
                    return new Variant({dataType: DataType.Double, value: 10.0});
                },
                set: function () {
                    return StatusCodes.BadNotWritable;
                }
            }

        });


        newVariable.nodeId.toString().should.eql("ns=4;b=01020304ffaa");


    });

    it("should be possible to create a variable in a folder that returns a timestamped value", function (done) {

        var newFolder = engine.addressSpace.addFolder("ObjectsFolder", "MyNewFolder4");

        var temperature = new DataValue({
            value: new Variant({dataType: DataType.Double, value: 10.0}),
            sourceTimestamp: new Date(Date.UTC(1999, 9, 9)),
            sourcePicoseconds: 10
        });

        var newVariable = engine.addressSpace.addVariable({
            componentOf: newFolder,
            browseName: "TemperatureWithSourceTimestamps",
            dataType: "Double",
            value: {
                timestamped_get: function () {
                    return temperature;
                }
            }
        });


        newVariable.readValueAsync(context, function (err, dataValue) {

            if (!err) {

                dataValue = newVariable.readAttribute(context, AttributeIds.Value, undefined, undefined);
                dataValue.should.be.instanceOf(DataValue);
                dataValue.sourceTimestamp.should.eql(new Date(Date.UTC(1999, 9, 9)));
                dataValue.sourcePicoseconds.should.eql(10);

            }
            done(err);
        });


    });

    it("should be possible to create a variable that returns historical data", function (done) {

        var newFolder = engine.addressSpace.addFolder("ObjectsFolder", "MyNewFolderHistorical1");
        var readValue = new DataValue({
            value: new Variant({dataType: DataType.Double, value: 10.0}),
            sourceTimestamp: new Date(Date.UTC(1999, 9, 9)),
            sourcePicoseconds: 10
        });

        var newVariable = engine.addressSpace.addVariable({
            componentOf: newFolder,
            browseName: "TemperatureHistorical",
            dataType: "Double",
            historizing: true,
            userAccessLevel: 7,
            value: {
                timestamped_get: function () {
                    return (readValue);
                },
                historyRead: function (context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {

                    assert(context instanceof SessionContext);
                    assert(callback instanceof Function);

                    var results = [];
                    var d = new Date();
                    d.setUTCMinutes(0);
                    d.setUTCSeconds(0);
                    d.setUTCMilliseconds(0);
                    for (var i = 0; i < 50; i++) {
                        d.setUTCMinutes(i);
                        results.push(new DataValue({
                            value: {dataType: DataType.Double, value: Math.random() * 75 - 25},
                            sourceTimestamp: d
                        }));
                    }

                    var historyReadResult = new HistoryReadResult({
                        historyData: new HistoryData({
                            dataValues: results
                        })
                    });
                    callback(null, historyReadResult);
                }
            }
        });


        var historyReadRequest = new HistoryReadRequest({
            historyReadDetails: new HistoryReadDetails(),
            timestampsToReturn: 3,
            nodesToRead: [{
                nodeId: newVariable.nodeId,
                continuationPoint: null
            }]
        });

        engine.historyRead(context, historyReadRequest, function (err, historyReadResult) {
            historyReadResult[0].should.be.instanceOf(HistoryReadResult);
            historyReadResult[0].historyData.dataValues.length.should.eql(50);

            done(err);
        });

    });

    it("should be possible to create a object in a folder", function () {

        var simulation = engine.addressSpace.addObject({
            organizedBy: "ObjectsFolder",
            browseName: "Scalar_Simulation",
            description: "This folder will contain one item per supported data-type.",
            nodeId: makeNodeId(4000, 1)
        });


    });

    it("should be possible to create 3 new folders with a filter function", function () {

        var newFolderWithFilteredItems = engine.addressSpace.addFolder("ObjectsFolder", {"browseName": "filteredItemsFolder"});

        var newFolder1 = engine.addressSpace.addFolder(newFolderWithFilteredItems, {
            "browseName": "filteredFolder1", "browseFilter": function (session) {
                if (session && session.hasOwnProperty("testFilterArray"))
                    if (session["testFilterArray"].indexOf(1) > -1)
                        return (true);
                    else
                        return (false);
                else
                    return (true);
            }
        });
        assert(newFolder1);

        var newFolder2 = engine.addressSpace.addFolder(newFolderWithFilteredItems, {
            "browseName": "filteredFolder2", "browseFilter": function (session) {
                if (session && session.hasOwnProperty("testFilterArray"))
                    if (session["testFilterArray"].indexOf(2) > -1)
                        return (true);
                    else
                        return (false);
                else
                    return (true);
            }
        });
        assert(newFolder2);

        var newFolder3 = engine.addressSpace.addFolder(newFolderWithFilteredItems, {
            "browseName": "filteredFolder3", "browseFilter": function (session) {
                if (session && session.hasOwnProperty("testFilterArray"))
                    if (session["testFilterArray"].indexOf(3) > -1)
                        return (true);
                    else
                        return (false);
                else
                    return (true);
            }
        });
        assert(newFolder3);

    });

    it("should browse the 'Objects' folder for back references", function () {

        var browseDescription = {
            browseDirection: BrowseDirection.Inverse,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "Organizes",
            resultMask: 0x3F
        };

        var browseResult = engine.browseSingleNode("ObjectsFolder", browseDescription);

        browseResult.statusCode.should.eql(StatusCodes.Good);
        browseResult.references.length.should.equal(1);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[0].isForward.should.equal(false);
        browseResult.references[0].browseName.name.should.equal("Root");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=84");
        //xx browseResult.references[0].displayName.text.should.equal("Root");
        browseResult.references[0].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);


    });

    it("should browse root folder with referenceTypeId", function () {

        var browseDescription = {
            browseDirection: BrowseDirection.Both,
            referenceTypeId: "Organizes",
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };
        var browseResult = engine.browseSingleNode("RootFolder", browseDescription);

        var browseNames = browseResult.references.map(function (r) {
            return r.browseName.name;
        });
        console.log(browseNames);

        browseResult.statusCode.should.eql(StatusCodes.Good);


        browseResult.references.length.should.equal(3);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[0].isForward.should.equal(true);
        browseResult.references[0].browseName.name.should.equal("Objects");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=85");
        browseResult.references[0].displayName.text.should.equal("Objects");
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);
        browseResult.references[0].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[1].isForward.should.equal(true);
        browseResult.references[1].browseName.name.should.equal("Types");
        browseResult.references[1].nodeId.toString().should.equal("ns=0;i=86");
        browseResult.references[1].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[1].nodeClass.should.eql(NodeClass.Object);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[2].isForward.should.equal(true);
        browseResult.references[2].browseName.name.should.equal("Views");
        browseResult.references[2].nodeId.toString().should.equal("ns=0;i=87");
        browseResult.references[2].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[2].nodeClass.should.eql(NodeClass.Object);

    });

    it("should browse root and find all hierarchical children of the root node (includeSubtypes: true)", function () {

        var browseDescription1 = {
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "Organizes",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };
        var browseResult1 = engine.browseSingleNode("RootFolder", browseDescription1);
        browseResult1.references.length.should.equal(3);

        var browseDescription2 = {
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true, // should include also HasChild , Organizes , HasEventSource etc ...
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };
        var browseResult2 = engine.browseSingleNode("RootFolder", browseDescription2);
    });

    it("should browse root folder with abstract referenceTypeId and includeSubtypes set to true", function () {

        var ref_hierarchical_Ref_Id = engine.addressSpace.findReferenceType("HierarchicalReferences").nodeId;
        ref_hierarchical_Ref_Id.toString().should.eql("ns=0;i=33");

        var browseDescription = new browse_service.BrowseDescription({
            browseDirection: BrowseDirection.Both,
            referenceTypeId: ref_hierarchical_Ref_Id,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        browseDescription.browseDirection.should.eql(BrowseDirection.Both);

        var browseResult = engine.browseSingleNode("RootFolder", browseDescription);

        browseResult.statusCode.should.eql(StatusCodes.Good);

        browseResult.references.length.should.equal(3);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[0].isForward.should.equal(true);
        browseResult.references[0].browseName.name.should.equal("Objects");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=85");
        browseResult.references[0].displayName.text.should.equal("Objects");
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);
        browseResult.references[0].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[1].isForward.should.equal(true);
        browseResult.references[1].browseName.name.should.equal("Types");
        browseResult.references[1].nodeId.toString().should.equal("ns=0;i=86");
        browseResult.references[1].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[1].nodeClass.should.eql(NodeClass.Object);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[2].isForward.should.equal(true);
        browseResult.references[2].browseName.name.should.equal("Views");
        browseResult.references[2].nodeId.toString().should.equal("ns=0;i=87");
        browseResult.references[2].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[2].nodeClass.should.eql(NodeClass.Object);

    });

    it("should browse a 'Server' object in  the 'Objects' folder", function () {

        var browseDescription = {
            browseDirection: BrowseDirection.Forward,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "Organizes",
            resultMask: 0x3F
        };
        var browseResult = engine.browseSingleNode("ObjectsFolder", browseDescription);
        browseResult.statusCode.should.eql(StatusCodes.Good);

        browseResult.references.length.should.be.greaterThan(1);
        //xx console.log(browseResult.references[0].browseName.name);

        browseResult.references[0].browseName.name.should.equal("Server");

    });

    it("should handle a BrowseRequest and set StatusCode if node doesn't exist", function () {

        var browseResult = engine.browseSingleNode("ns=46;i=123456");

        browseResult.statusCode.should.equal(StatusCodes.BadNodeIdUnknown);
        browseResult.references.length.should.equal(0);

    });

    it("should handle a BrowseRequest with multiple nodes to browse", function () {

        var browseRequest = new browse_service.BrowseRequest({
            nodesToBrowse: [
                {
                    nodeId: resolveNodeId("RootFolder"),
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Both,
                    resultMask: 63
                },
                {
                    nodeId: resolveNodeId("ObjectsFolder"),
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Both,
                    resultMask: 63
                }

            ]
        });

        browseRequest.nodesToBrowse.length.should.equal(2);
        var results = engine.browse(browseRequest.nodesToBrowse);

        results.length.should.equal(2);

        // RootFolder should have 4 nodes ( 1 hasTypeDefinition , 3 sub-folders)
        results[0].references.length.should.equal(4);

    });

    it("should handle a BrowseRequest of a session with a filtered result", function () {
        var browseDescription = {
            nodesToBrowse: [{
                nodeId: engine.addressSpace.rootFolder.objects.getFolderElementByName("filteredItemsFolder").nodeId,
                browseDirection: BrowseDirection.Forward,
                resultMask: 63,
                nodeClassMask: 1 // 1=Objects
            }]
        };

        var browseRequest = new browse_service.BrowseRequest(browseDescription);
        var session = engine.createSession();

        session.testFilterArray = [1, 3];
        var results1 = engine.browse(browseRequest.nodesToBrowse, session);
        results1[0].references.length.should.equal(2);

        session.testFilterArray = [1, 2, 3];
        var results2 = engine.browse(browseRequest.nodesToBrowse, session);
        results2[0].references.length.should.equal(3);

        session.testFilterArray = [3];
        var results3 = engine.browse(browseRequest.nodesToBrowse, session);
        results3[0].references.length.should.equal(1);
        results3[0].references[0].displayName.text.should.equal("filteredFolder3");

        engine.closeSession(session.authenticationToken, true);

    });

    it("should provide results that conforms to browseDescription.resultMask", function () {

        var check_flag = require("node-opcua-utils").check_flag;
        var ResultMask = require("node-opcua-data-model").ResultMask;

        function test_referenceDescription(referenceDescription, resultMask) {
            if (check_flag(resultMask, ResultMask.ReferenceType)) {
                should(referenceDescription.referenceTypeId).be.instanceOf(Object);
            } else {
                should(referenceDescription.referenceTypeId).be.eql(makeNodeId(0, 0));
            }
            if (check_flag(resultMask, ResultMask.BrowseName)) {
                should(referenceDescription.browseName).be.instanceOf(Object);
            } else {
                should(referenceDescription.browseName).be.eql(new QualifiedName({}));
            }
            if (check_flag(resultMask, ResultMask.NodeClass)) {
                should(referenceDescription.nodeClass).be.not.eql(NodeClass.Unspecified);
            } else {
                should(referenceDescription.nodeClass).be.eql(NodeClass.Unspecified);
            }
        }

        function test_result_mask(resultMask) {

            var browseDescription = {
                browseDirection: BrowseDirection.Both,
                referenceTypeId: "HierarchicalReferences",
                includeSubtypes: true,
                nodeClassMask: 0, // 0 = all nodes
                resultMask: resultMask
            };
            var browseResult = engine.browseSingleNode("ObjectsFolder", browseDescription);

            browseResult.references.length.should.be.greaterThan(1);
            browseResult.references.forEach(function (referenceDescription) {
                test_referenceDescription(referenceDescription, resultMask.value);
            });

        }

        // ReferenceType
        test_result_mask(ResultMask.BrowseName);
        test_result_mask(ResultMask.NodeClass);
        test_result_mask(ResultMask.NodeClass & ResultMask.BrowseName);


    });

    describe("readSingleNode on Object", function () {

        it("should handle a readSingleNode - BrowseName", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.BrowseName);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.QualifiedName);
            readResult.value.value.name.should.equal("Root");
        });

        it("should handle a readSingleNode - NodeClass", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.NodeClass);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.Int32);
            readResult.value.value.should.equal(NodeClass.Object.value);
        });

        it("should handle a readSingleNode - NodeId", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.NodeId);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.NodeId);
            readResult.value.value.toString().should.equal("ns=0;i=84");
        });

        it("should handle a readSingleNode - DisplayName", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.DisplayName);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.LocalizedText);
            readResult.value.value.text.toString().should.equal("Root");
        });

        it("should handle a readSingleNode - Description", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.Description);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.LocalizedText);
            readResult.value.value.text.toString().should.equal("The root of the server address space.");
        });

        it("should handle a readSingleNode - WriteMask", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.WriteMask);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.UInt32);
            readResult.value.value.should.equal(0);
        });

        it("should handle a readSingleNode - UserWriteMask", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.UserWriteMask);
            readResult.value.dataType.should.eql(DataType.UInt32);
            readResult.value.value.should.equal(0);
        });

        it("should handle a readSingleNode - EventNotifier", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.EventNotifier);
            readResult.value.dataType.should.eql(DataType.Byte);
            readResult.value.value.should.equal(0);
        });

        it("should return BadAttributeIdInvalid  - readSingleNode - for bad attribute    ", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.ContainsNoLoops);
            readResult.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
            assert(readResult.value === null);
        });
    });

    describe("readSingleNode on ReferenceType", function () {

        var ref_Organizes_nodeId;
        beforeEach(function () {
            ref_Organizes_nodeId = engine.addressSpace.findReferenceType("Organizes").nodeId;
        });

        //  --- on reference Type ....
        it("should handle a readSingleNode - IsAbstract", function () {

            var readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.IsAbstract);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(false);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });

        it("should handle a readSingleNode - Symmetric", function () {

            var readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.Symmetric);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(false);
        });

        it("should handle a readSingleNode - InverseName", function () {

            var readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.InverseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.LocalizedText);
            //xx readResult.value.value.should.equal(false);
        });

        it("should handle a readSingleNode - BrowseName", function () {

            var readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.BrowseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.QualifiedName);
            readResult.value.value.name.should.eql("Organizes");
            //xx readResult.value.value.should.equal(false);
        });
        it("should return BadAttributeIdInvalid on EventNotifier", function () {

            var readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.EventNotifier);
            readResult.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
            assert(readResult.value === null);
        });
    });

    describe("readSingleNode on VariableType", function () {
        //
        it("should handle a readSingleNode - BrowseName", function () {

            var readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.BrowseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - IsAbstract", function () {

            var readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.IsAbstract);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(false);
        });
        it("should handle a readSingleNode - Value", function () {

            var readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.Value);
            readResult.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
        });

        it("should handle a readSingleNode - DataType", function () {

            var readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.DataType);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - ValueRank", function () {

            var readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.ValueRank);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - ArrayDimensions", function () {

            var readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.ArrayDimensions);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.arrayType.should.eql(VariantArrayType.Array);
        });
    });

    describe("readSingleNode on Variable (ProductUri)", function () {
        var productUri_id = makeNodeId(2262, 0);
        it("should handle a readSingleNode - BrowseName", function () {

            var readResult = engine.readSingleNode(context, productUri_id, AttributeIds.BrowseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - ArrayDimensions", function () {

            var readResult = engine.readSingleNode(context, productUri_id, AttributeIds.ArrayDimensions);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.arrayType.should.eql(VariantArrayType.Array);
        });
        it("should handle a readSingleNode - AccessLevel", function () {

            var readResult = engine.readSingleNode(context, productUri_id, AttributeIds.AccessLevel);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - UserAccessLevel", function () {

            var readResult = engine.readSingleNode(context, productUri_id, AttributeIds.UserAccessLevel);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - MinimumSamplingInterval", function () {

            var readResult = engine.readSingleNode(context, productUri_id, AttributeIds.MinimumSamplingInterval);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.value.should.eql(1000);
        });
        it("should handle a readSingleNode - Historizing", function () {

            var readResult = engine.readSingleNode(context, productUri_id, AttributeIds.Historizing);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.value.should.eql(false);
        });
    });

    describe("readSingleNode on View", function () {

        // for views
        xit("should handle a readSingleNode - ContainsNoLoops", function () {

            var readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.ContainsNoLoops);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(true);
        });
    });

    describe("readSingleNode on DataType", function () {
        // for views
        it("should have ServerStatusDataType dataType exposed", function () {
            var obj = engine.addressSpace.findDataType("ServerStatusDataType");
            obj.browseName.toString().should.eql("ServerStatusDataType");
            obj.nodeClass.should.eql(NodeClass.DataType);
        });
        it("should handle a readSingleNode - ServerStatusDataType - BrowseName", function () {

            var obj = engine.addressSpace.findDataType("ServerStatusDataType");
            var serverStatusDataType_id = obj.nodeId;
            var readResult = engine.readSingleNode(context, serverStatusDataType_id, AttributeIds.BrowseName);
            readResult.value.dataType.should.eql(DataType.QualifiedName);
            readResult.value.value.name.should.equal("ServerStatusDataType");
        });

        it("should handle a readSingleNode - ServerStatusDataType - Description", function () {

            var obj = engine.addressSpace.findDataType("ServerStatusDataType");
            var serverStatusDataType_id = obj.nodeId;
            var readResult = engine.readSingleNode(context, serverStatusDataType_id, AttributeIds.Description);
            readResult.value.dataType.should.eql(DataType.LocalizedText);

        });
    });

    it("should return BadNodeIdUnknown  - readSingleNode - with unknown object", function () {

        var readResult = engine.readSingleNode(context, "**UNKNOWN**", AttributeIds.DisplayName);
        readResult.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
    });

    it("should read the display name of RootFolder", function () {

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
        var dataValues = engine.read(context, readRequest);
        dataValues.length.should.equal(1);

    });

    describe("testing read with indexRange for attributes that can't be used with IndexRange ", function () {
        // see CTT Attribute Service, AttributeRead , Test-Case / Err015.js
        // Read a single node specifying an IndexRange for attributes that can't be used
        // with IndexRange, as in:
        // AccessLevel, BrowseName, DataType, DisplayName, Historizing, NodeClass, NodeId, UserAccessLevel, ValueRank
        // Expect BadIndexRangeNoData

        var nodeId = "ns=1;s=TestVar";
        before(function () {
            engine.addressSpace.addVariable({
                  organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                  browseName: "TestVar",
                  nodeId: nodeId,
                  dataType: "Double",
                  value: {
                      get: function () {
                          return new Variant({
                              dataType: DataType.Double,
                              value: 0
                          });
                      },
                      set: null // read only
                  }
              }
            );
        });

        function read_shall_get_BadIndexRangeNoData(attributeId, done) {
            assert(attributeId >= 0 && attributeId < 22);
            var readRequest = new read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Both,
                nodesToRead: [
                    {
                        nodeId: nodeId,
                        attributeId: attributeId,
                        indexRange: "1:2",
                        dataEncoding: null /* */
                    }
                ]
            });
            var dataValues = engine.read(context, readRequest);
            dataValues.length.should.eql(1);
            dataValues[0].statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            done();
        }

        var attributes = ["AccessLevel", "BrowseName", "DataType", "DisplayName", "Historizing", "NodeClass", "NodeId", "UserAccessLevel", "ValueRank"];
        attributes.forEach(function (attribute) {

            it("shall return BadIndexRangeNoData when performing a read with a  indexRange and attributeId = " + attribute + " ", function (done) {
                read_shall_get_BadIndexRangeNoData(AttributeIds[attribute], done);
            });

        });

        it("should return ", function () {
            var readRequest = new read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Both,
                nodesToRead: [
                    {
                        nodeId: nodeId,
                        attributeId: AttributeIds.Value,
                        indexRange: null,
                        dataEncoding: {name: "Invalid Data Encoding"} // QualifiedName
                    }
                ]
            });
            var dataValues = engine.read(context, readRequest);
            dataValues.length.should.eql(1);
            dataValues[0].statusCode.should.eql(StatusCodes.BadDataEncodingInvalid);
        });
    });

    describe("testing read operation with timestamps", function () {

        var nodesToRead =
          [
              {
                  nodeId: resolveNodeId("RootFolder"),
                  attributeId: AttributeIds.DisplayName,
                  indexRange: null, /* ???? */
                  dataEncoding: null /* */
              },
              {
                  nodeId: resolveNodeId("RootFolder"),
                  attributeId: AttributeIds.BrowseName,
                  indexRange: null, /* ???? */
                  dataEncoding: null /* */
              },
              {
                  nodeId: resolveNodeId("ns=0;i=2259"), //Server_serverStatus_State
                  attributeId: AttributeIds.Value,
                  indexRange: null, /* ???? */
                  dataEncoding: null /* */
              }
          ];
        it("should read and set the required timestamps : TimestampsToReturn.Neither", function (done) {

            var DataValue =  require("node-opcua-data-value").DataValue;
            var readRequest = new read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: nodesToRead
            });

            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {

                    var dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(3);

                    dataValues[0].should.be.instanceOf(DataValue);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    should(dataValues[0].serverTimestamp).eql(null);
                    should(dataValues[0].sourceTimestamp).eql(null);
                    should(dataValues[0].serverPicoseconds).eql(0);
                    should(dataValues[0].sourcePicoseconds).eql(0);

                    dataValues[1].should.be.instanceOf(DataValue);
                    dataValues[1].statusCode.should.eql(StatusCodes.Good);
                    should(dataValues[1].serverTimestamp).eql(null);
                    should(dataValues[1].sourceTimestamp).eql(null);
                    should(dataValues[1].serverPicoseconds).eql(0);
                    should(dataValues[1].sourcePicoseconds).eql(0);

                    dataValues[2].should.be.instanceOf(DataValue);
                    dataValues[2].statusCode.should.eql(StatusCodes.Good);
                    should(dataValues[2].serverTimestamp).eql(null);
                    should(dataValues[2].sourceTimestamp).eql(null);
                    should(dataValues[2].serverPicoseconds).eql(0);
                    should(dataValues[2].sourcePicoseconds).eql(0);
                }
                done(err);
            });

        });

        it("should read and set the required timestamps : TimestampsToReturn.Server", function () {

            var DataValue =  require("node-opcua-data-value").DataValue;
            var readRequest = new read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Server,
                nodesToRead: nodesToRead
            });
            var dataValues = engine.read(context, readRequest);

            dataValues.length.should.equal(3);
            dataValues[0].should.be.instanceOf(DataValue);
            dataValues[1].should.be.instanceOf(DataValue);
            dataValues[2].should.be.instanceOf(DataValue);

            dataValues[0].statusCode.should.eql(StatusCodes.Good);
            should(dataValues[0].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[0].serverPicoseconds).be.eql(0);
            should(dataValues[0].sourceTimestamp).be.eql(null);
            should(dataValues[0].sourcePicoseconds).be.eql(0);

            dataValues[1].statusCode.should.eql(StatusCodes.Good);
            should(dataValues[1].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[1].serverPicoseconds).be.eql(0);
            should(dataValues[1].sourceTimestamp).be.eql(null);
            should(dataValues[1].sourcePicoseconds).be.eql(0);

            dataValues[2].statusCode.should.eql(StatusCodes.Good);
            should(dataValues[2].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[2].serverPicoseconds).be.eql(0);
            should(dataValues[2].sourceTimestamp).be.eql(null);
            should(dataValues[2].sourcePicoseconds).be.eql(0);

        });

        it("should read and set the required timestamps : TimestampsToReturn.Source", function () {

            var DataValue =  require("node-opcua-data-value").DataValue;
            var readRequest = new read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Source,
                nodesToRead: nodesToRead
            });

            var dataValues = engine.read(context, readRequest);

            dataValues.length.should.equal(3);
            dataValues[0].should.be.instanceOf(DataValue);
            dataValues[1].should.be.instanceOf(DataValue);
            dataValues[2].should.be.instanceOf(DataValue);

            dataValues[0].statusCode.should.eql(StatusCodes.Good);
            dataValues[1].statusCode.should.eql(StatusCodes.Good);
            dataValues[2].statusCode.should.eql(StatusCodes.Good);

            should(dataValues[0].serverTimestamp).be.eql(null);
            should(dataValues[0].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[0].serverPicoseconds).be.eql(0);
            should(dataValues[0].sourcePicoseconds).be.eql(0);

            should(dataValues[1].serverTimestamp).be.eql(null);
            should(dataValues[1].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[1].serverPicoseconds).be.eql(0);
            should(dataValues[1].sourcePicoseconds).be.eql(0);

            should(dataValues[2].sourceTimestamp).be.instanceOf(Date);

        });

        it("should read and set the required timestamps : TimestampsToReturn.Both", function () {


            var DataValue =  require("node-opcua-data-value").DataValue;
            var readRequest = new read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Both,
                nodesToRead: nodesToRead
            });
            var dataValues = engine.read(context, readRequest);

            dataValues.length.should.equal(3);
            dataValues[0].should.be.instanceOf(DataValue);
            dataValues[1].should.be.instanceOf(DataValue);
            dataValues[2].should.be.instanceOf(DataValue);

            should(dataValues[0].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[0].serverPicoseconds).be.eql(0);
            should(dataValues[0].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[0].sourcePicoseconds).be.eql(0);

            should(dataValues[1].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[1].serverPicoseconds).be.eql(0);
            should(dataValues[1].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[1].sourcePicoseconds).be.eql(0);

            should(dataValues[2].sourceTimestamp).be.instanceOf(Date);

        });

    });

    it("should read Server_NamespaceArray ", function (done) {

        var readRequest = new read_service.ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.DisplayName,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                },
                {
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.Value,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ]
        });

        engine.refreshValues(readRequest.nodesToRead, function (err) {
            if (!err) {
                var dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(2);
                dataValues[0].value.value.text.should.eql("NamespaceArray");
                dataValues[1].value.value.should.be.instanceOf(Array);
                dataValues[1].value.value.length.should.be.eql(2);
            }
            done(err);
        });
    });

    it("should handle indexRange with individual value", function (done) {

        var readRequest = new read_service.ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: "ns=1;s=TestArray",
                    attributeId: AttributeIds.Value,
                    indexRange: "2",     // <<<<<<<<<<<<<<<<<<<<<<<<<<
                    dataEncoding: null /* */
                }
            ]
        });
        engine.refreshValues(readRequest.nodesToRead, function (err) {
            if (!err) {
                var dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(1);
                dataValues[0].statusCode.should.eql(StatusCodes.Good);

                dataValues[0].value.value.should.be.instanceOf(Float64Array);
                dataValues[0].value.value.length.should.be.eql(1);
                dataValues[0].value.value[0].should.be.eql(2.0);
            }
            done(err);
        });
    });

    it("should handle indexRange with a simple range", function (done) {

        var readRequest = new read_service.ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: "ns=1;s=TestArray",
                    attributeId: AttributeIds.Value,
                    indexRange: "2:5",    // <<<<<<<<<<<<<<<<<<<<<<<<<<
                    dataEncoding: null /* */
                }
            ]
        });
        engine.refreshValues(readRequest.nodesToRead, function (err) {
            if (!err) {
                var dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(1);
                dataValues[0].statusCode.should.eql(StatusCodes.Good);
                dataValues[0].value.value.should.be.instanceOf(Float64Array);
                dataValues[0].value.value.length.should.be.eql(4);
                assert_arrays_are_equal(dataValues[0].value.value, new Float64Array([2.0, 3.0, 4.0, 5.0]));
            }
            done(err);
        });

    });

    it("should receive BadIndexRangeNoData when indexRange try to access outside boundary", function (done) {

        var readRequest = new read_service.ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: "ns=1;s=TestArray",
                    attributeId: AttributeIds.Value,
                    indexRange: "5000:6000",    // <<<<<<<<<<<<<<<<<<<<<<<<<< BAD BOUNDARY !!!
                    dataEncoding: null /* */
                }
            ]
        });
        engine.refreshValues(readRequest.nodesToRead, function (err) {
            if (!err) {
                var dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(1);
                dataValues[0].statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            }
            done(err);
        });

    });

    it("should read Server_NamespaceArray  DataType", function () {
        var readRequest = new read_service.ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.DataType,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ]
        });
        var dataValues = engine.read(context, readRequest);
        dataValues.length.should.equal(1);
        dataValues[0].value.dataType.should.eql(DataType.NodeId);
        dataValues[0].value.value.toString().should.eql("ns=0;i=12"); // String
    });

    it("should read Server_NamespaceArray ValueRank", function () {

        var readRequest = new read_service.ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.ValueRank,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ]
        });

        var dataValues = engine.read(context, readRequest);
        dataValues.length.should.equal(1);
        dataValues[0].statusCode.should.eql(StatusCodes.Good);

        //xx console.log("xxxxxxxxx =  dataValues[0].value.value",typeof( dataValues[0].value.value), dataValues[0].value.value);
        dataValues[0].value.value.should.eql(VariantArrayType.Array.value);

    });

    describe("testing ServerEngine browsePath", function () {
        var translate_service = require("node-opcua-service-translate-browse-path");
        var nodeid = require("node-opcua-nodeid");

        it("translating a browse path to a nodeId with a invalid starting node shall return BadNodeIdUnknown", function () {
            var browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(0), // <=== invalid node id
                relativePath: []
            });

            var browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);

            browsePathResult.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
        });


        it("translating a browse path to a nodeId with an empty relativePath  shall return BadNothingToDo", function () {

            var browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84), // <=== valid node id
                relativePath: {elements: []}         // <=== empty path
            });
            var browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);
            browsePathResult.statusCode.should.eql(StatusCodes.BadNothingToDo);
        });

        it("The Server shall return BadBrowseNameInvalid if the targetName is missing. ", function () {
            var browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84),
                relativePath: {
                    elements: [
                        {
                            //xx referenceTypeId: null,
                            isInverse: false,
                            includeSubtypes: 0,
                            targetName: null // { namespaceIndex:0 , name: "Server"}
                        }
                    ]
                }
            });

            var browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);

            browsePathResult.statusCode.should.eql(StatusCodes.BadBrowseNameInvalid);
            browsePathResult.targets.length.should.eql(0);
        });
        it("The Server shall return BadNoMatch if the targetName doesn't exist. ", function () {
            var browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84),
                relativePath: {
                    elements: [
                        {
                            //xx referenceTypeId: null,
                            isInverse: false,
                            includeSubtypes: 0,
                            targetName: {namespaceIndex: 0, name: "xxxx invalid name xxx"}
                        }
                    ]
                }
            });

            var browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);
            browsePathResult.statusCode.should.eql(StatusCodes.BadNoMatch);
            browsePathResult.targets.length.should.eql(0);
        });

        it("The Server shall return Good if the targetName does exist. ", function () {

            var browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84),
                relativePath: {
                    elements: [
                        {
                            //xx referenceTypeId: null,
                            isInverse: false,
                            includeSubtypes: 0,
                            targetName: {namespaceIndex: 0, name: "Objects"}
                        }
                    ]
                }
            });

            var browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);
            browsePathResult.statusCode.should.eql(StatusCodes.Good);
            browsePathResult.targets.length.should.eql(1);
            browsePathResult.targets[0].targetId.should.eql(makeExpandedNodeId(85));
            var UInt32_MaxValue = 0xFFFFFFFF;
            browsePathResult.targets[0].remainingPathIndex.should.equal(UInt32_MaxValue);
        });

    });

    describe("Accessing ServerStatus nodes", function () {

        it("should read  Server_ServerStatus_CurrentTime", function (done) {

            var readRequest = new read_service.ReadRequest({
                timestampsToReturn: read_service.TimestampsToReturn.Neither,
                nodesToRead: [{
                    nodeId: VariableIds.Server_ServerStatus_CurrentTime,
                    attributeId: AttributeIds.Value
                }]
            });
            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {
                    var dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.DateTime);
                    dataValues[0].value.value.should.be.instanceOf(Date);
                }
                done(err);
            });

        });

        it("should read  Server_ServerStatus_StartTime", function (done) {

            var readRequest = new read_service.ReadRequest({
                timestampsToReturn: read_service.TimestampsToReturn.Neither,
                nodesToRead: [{
                    nodeId: VariableIds.Server_ServerStatus_StartTime,
                    attributeId: AttributeIds.Value
                }]
            });
            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {
                    var dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.DateTime);
                    dataValues[0].value.value.should.be.instanceOf(Date);
                }
                done(err);
            });

        });

        it("should read  Server_ServerStatus_BuildInfo_BuildNumber", function (done) {

            engine.serverStatus.buildInfo.buildNumber = "1234";

            var readRequest = new read_service.ReadRequest({
                timestampsToReturn: read_service.TimestampsToReturn.Neither,
                nodesToRead: [{
                    nodeId: VariableIds.Server_ServerStatus_BuildInfo_BuildNumber,
                    attributeId: AttributeIds.Value
                }]
            });
            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {
                    var dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.String);
                    dataValues[0].value.value.should.eql("1234");
                }
                done(err);
            });
        });

        it("should read  Server_ServerStatus_BuildInfo_BuildNumber (2nd)", function () {

            engine.serverStatus.buildInfo.buildNumber = "1234";

            var nodeid = VariableIds.Server_ServerStatus_BuildInfo_BuildNumber;
            var node = engine.addressSpace.findNode(nodeid);
            should.exist(node);

            var dataValue = node.readAttribute(context, AttributeIds.Value);

            dataValue.statusCode.should.eql(StatusCodes.Good);
            dataValue.value.dataType.should.eql(DataType.String);
            dataValue.value.value.should.eql("1234");

        });

        it("should read  Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount", function (done) {


            var nodeid = VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount;
            var node = engine.addressSpace.findNode(nodeid);
            should.exist(node);

            var nodesToRead = [{
                nodeId: nodeid,
                attributeId: AttributeIds.Value
            }];
            engine.refreshValues(nodesToRead, function (err) {
                if (!err) {
                    var dataValue = node.readAttribute(context, AttributeIds.Value);
                    dataValue.statusCode.should.eql(StatusCodes.Good);
                    dataValue.value.dataType.should.eql(DataType.UInt32);
                    dataValue.value.value.should.eql(0);
                }
                done(err);
            });

        });

        it("should read all attributes of Server_ServerStatus_CurrentTime", function (done) {

            var readRequest = new read_service.ReadRequest({
                timestampsToReturn: read_service.TimestampsToReturn.Neither,
                nodesToRead: [1, 2, 3, 4, 5, 6, 7, 13, 14, 15, 16, 17, 18, 19, 20].map(function (attributeId) {
                    return {
                        nodeId: VariableIds.Server_ServerStatus_CurrentTime,
                        attributeId: attributeId
                    };
                })
            });
            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {
                    var dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(15);
                    dataValues[7].statusCode.should.eql(StatusCodes.Good);
                    dataValues[7].value.dataType.should.eql(DataType.DateTime);
                    dataValues[7].value.value.should.be.instanceOf(Date);
                }
                done(err);
            });

        });
    });

    describe("Accessing ServerStatus as a single composite object", function () {

        it("should be possible to access the ServerStatus Object as a variable", function (done) {

            var readRequest = new read_service.ReadRequest({
                timestampsToReturn: read_service.TimestampsToReturn.Neither,
                nodesToRead: [{
                    nodeId: VariableIds.Server_ServerStatus,
                    attributeId: AttributeIds.Value
                }]
            });
            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {
                    var dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.ExtensionObject);

                    dataValues[0].value.value.should.be.instanceOf(Object);

                    var serverStatus = dataValues[0].value.value;

                    serverStatus.state.key.should.eql("Running");
                    serverStatus.state.value.should.eql(0);
                    serverStatus.shutdownReason.text.should.eql("");

                    serverStatus.buildInfo.productName.should.equal("NODEOPCUA-SERVER");
                    serverStatus.buildInfo.softwareVersion.should.equal("1.0");
                    serverStatus.buildInfo.manufacturerName.should.equal("<Manufacturer>");
                    serverStatus.buildInfo.productUri.should.equal("URI:NODEOPCUA-SERVER");
                }
                done(err);
            });
        });
    });


    describe("Accessing BuildInfo as a single composite object", function () {

        it("should be possible to read the Server_ServerStatus_BuildInfo Object as a complex structure", function (done) {

            var readRequest = new read_service.ReadRequest({
                timestampsToReturn: read_service.TimestampsToReturn.Neither,
                nodesToRead: [{
                    nodeId: VariableIds.Server_ServerStatus_BuildInfo,
                    attributeId: AttributeIds.Value
                }]
            });
            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {
                    var dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.ExtensionObject);

                    console.log('buildInfo', dataValues[0].value.value);
                    dataValues[0].value.value.should.be.instanceOf(Object);

                    var buildInfo = dataValues[0].value.value;

                    buildInfo.productName.should.equal("NODEOPCUA-SERVER");
                    buildInfo.softwareVersion.should.equal("1.0");
                    buildInfo.manufacturerName.should.equal("<Manufacturer>");
                    buildInfo.productUri.should.equal("URI:NODEOPCUA-SERVER");
                }
                done(err);
            });
        });
    });


    describe("writing nodes ", function () {

        var WriteValue = require("node-opcua-service-write").WriteValue;

        it("should write a single node", function (done) {

            var nodeToWrite = new WriteValue({
                nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                attributeId: AttributeIds.Value,
                indexRange: null,
                value: { // dataValue
                    value: { // variant
                        dataType: DataType.Int32,
                        value: 10
                    }
                }
            });
            engine.writeSingleNode(context, nodeToWrite, function (err, statusCode) {
                statusCode.should.eql(StatusCodes.Good);
                done(err);
            });
        });

        it("should return BadNotWritable when trying to write a Executable attribute", function (done) {

            var nodeToWrite = new WriteValue({
                nodeId: resolveNodeId("RootFolder"),
                attributeId: AttributeIds.Executable,
                indexRange: null,
                value: { // dataValue
                    value: { // variant
                        dataType: DataType.UInt32,
                        value: 10
                    }
                }
            });
            engine.writeSingleNode(context, nodeToWrite, function (err, statusCode) {
                statusCode.should.eql(StatusCodes.BadNotWritable);
                done(err);
            });

        });

        it("should write many nodes", function (done) {

            var nodesToWrite = [
                new WriteValue({
                    nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                    attributeId: AttributeIds.Value,
                    indexRange: null,
                    value: { // dataValue
                        value: { // variant
                            dataType: DataType.Int32,
                            value: 10
                        }
                    }
                }),
                new WriteValue({
                    nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                    attributeId: AttributeIds.Value,
                    indexRange: null,
                    value: { // dataValue
                        value: { // variant
                            dataType: DataType.Int32,
                            value: 10
                        }
                    }
                })
            ];

            engine.write(context, nodesToWrite, function (err, results) {
                results.length.should.eql(2);
                results[0].should.eql(StatusCodes.Good);
                results[1].should.eql(StatusCodes.Good);
                done(err);
            });

        });

        it(" write a single node with a null variant shall return BadTypeMismatch", function (done) {

            var nodeToWrite = new WriteValue({
                nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                attributeId: AttributeIds.Value,
                indexRange: null,
                value: { // dataValue
                    value: null
                }
            });
            engine.writeSingleNode(context, nodeToWrite, function (err, statusCode) {
                statusCode.should.eql(StatusCodes.BadTypeMismatch);
                done(err);
            });
        });

    });


    describe("testing the ability to handle variable that returns a StatusCode rather than a Variant", function () {

        before(function () {
            // add a variable that fails to provide a Variant.
            // we simulate the scenario where the variable represent a PLC value,
            // and for some reason, the server cannot access the PLC.
            // In this case we expect the value getter to return a StatusCode rather than a Variant
            engine.addressSpace.addVariable({
                  organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                  browseName: "FailingPLCValue",
                  nodeId: "ns=1;s=FailingPLCValue",
                  dataType: "Double",
                  value: {
                      get: function () {
                          // we return a StatusCode here instead of a Variant
                          // this means : "Houston ! we have a problem"
                          return StatusCodes.BadResourceUnavailable;
                      },
                      set: null // read only
                  }
              }
            );
        });

        it("ZZ should have statusCode=BadResourceUnavailable when trying to read the FailingPLCValue variable", function (done) {

            var readRequest = new read_service.ReadRequest({
                timestampsToReturn: read_service.TimestampsToReturn.Neither,
                nodesToRead: [{
                    nodeId: "ns=1;s=FailingPLCValue",
                    attributeId: AttributeIds.Value
                }]
            });
            engine.refreshValues(readRequest.nodesToRead, function (err) {
                if (!err) {
                    var readResults = engine.read(context, readRequest);
                    readResults[0].statusCode.should.eql(StatusCodes.BadResourceUnavailable);
                }
                done(err);
            });

        });
    });

    describe("ServerEngine : forcing variable value refresh", function () {


        var value1 = 0;
        var value2 = 0;

        before(function () {

            // add a variable that provide a on demand refresh function
            engine.addressSpace.addVariable({
                  organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                  browseName: "RefreshedOnDemandValue",
                  nodeId: "ns=1;s=RefreshedOnDemandValue",
                  dataType: "Double",
                  value: {
                      refreshFunc: function (callback) {
                          // add some delay to simulate a long operation to perform the asynchronous read
                          setTimeout(function () {
                              value1 += 1;
                              var dataValue = new DataValue({
                                  value: {
                                      dataType: DataType.Double,
                                      value: value1
                                  }
                              });
                              callback(null, dataValue);
                          }, 10);
                      }
                  }
              }
            );
            // add an other variable that provide a on demand refresh function
            engine.addressSpace.addVariable({
                  organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                  browseName: "OtherRefreshedOnDemandValue",
                  nodeId: "ns=1;s=OtherRefreshedOnDemandValue",
                  dataType: "Double",
                  value: {
                      refreshFunc: function (callback) {
                          setTimeout(function () {
                              value2 += 1;
                              var dataValue = new DataValue({
                                  value: {dataType: DataType.Double, value: value2}
                              });
                              callback(null, dataValue);
                          }, 10);
                      }
                  }
              }
            );
        });


        beforeEach(function () {
            // reset counters;
            value1 = 0;
            value2 = 0;

        });


        it("should refresh a single variable value asynchronously", function (done) {

            var nodesToRefresh = [{nodeId: "ns=1;s=RefreshedOnDemandValue"}];

            var v = engine.readSingleNode(context, nodesToRefresh[0].nodeId, AttributeIds.Value);
            v.statusCode.should.equal(StatusCodes.UncertainInitialValue);

            engine.refreshValues(nodesToRefresh, function (err, values) {

                if (!err) {
                    values[0].value.value.should.equal(1);

                    value1.should.equal(1);
                    value2.should.equal(0);

                    var dataValue = engine.readSingleNode(context, nodesToRefresh[0].nodeId, AttributeIds.Value);
                    dataValue.statusCode.should.eql(StatusCodes.Good);
                    dataValue.value.value.should.eql(1);

                }
                done(err);
            });
        });

        it("should refresh multiple variable values asynchronously", function (done) {


            var nodesToRefresh = [
                {nodeId: "ns=1;s=RefreshedOnDemandValue"},
                {nodeId: "ns=1;s=OtherRefreshedOnDemandValue"}
            ];

            engine.refreshValues(nodesToRefresh, function (err, values) {
                if (!err) {
                    values.length.should.equal(2, " expecting two node asynchronous refresh call");

                    values[0].value.value.should.equal(1);
                    values[1].value.value.should.equal(1);

                    value1.should.equal(1);
                    value2.should.equal(1);
                }
                done(err);
            });
        });

        it("should  refresh nodes only once if they are duplicated ", function (done) {

            var nodesToRefresh = [
                {nodeId: "ns=1;s=RefreshedOnDemandValue"},
                {nodeId: "ns=1;s=RefreshedOnDemandValue"}, // <== duplicated node
                {nodeId: "ns=1;s=RefreshedOnDemandValue", attributeId: AttributeIds.DisplayName}
            ];
            engine.refreshValues(nodesToRefresh, function (err, values) {

                if (!err) {
                    values.length.should.equal(1, " expecting only one node asynchronous refresh call");

                    value1.should.equal(1);
                    value2.should.equal(0);
                }

                done(err);
            });
        });

        it("should ignore nodes with attributeId!=AttributeIds.Value ", function (done) {
            value1.should.equal(0);
            value2.should.equal(0);
            var nodesToRefresh = [
                {nodeId: "ns=1;s=RefreshedOnDemandValue", attributeId: AttributeIds.DisplayName}
            ];
            engine.refreshValues(nodesToRefresh, function (err, values) {
                if (!err) {
                    values.length.should.equal(0, " expecting no asynchronous refresh call");
                    value1.should.equal(0);
                    value2.should.equal(0);
                }
                done(err);
            });
        });

        it("should perform readValueAsync on Variable", function (done) {

            var variable = engine.addressSpace.findNode("ns=1;s=RefreshedOnDemandValue");

            value1.should.equal(0);
            variable.readValueAsync(context, function (err, value) {
                value1.should.equal(1);

                done(err);
            });

        });
    });

    describe("ServerEngine Diagnostic", function () {

        it("should have ServerDiagnosticObject", function () {
            var server = engine.addressSpace.rootFolder.objects.server;
            server.browseName.toString().should.eql("Server");
            server.serverDiagnostics.browseName.toString().should.eql("ServerDiagnostics");
            server.serverDiagnostics.enabledFlag.browseName.toString().should.eql("EnabledFlag");
        });
    });

});


describe("ServerEngine advanced", function () {


    it("ServerEngine#registerShutdownTask should execute shutdown tasks on shutdown", function (done) {

        var engine = new ServerEngine();

        var sinon = require("sinon");
        var myFunc = sinon.spy();

        engine.registerShutdownTask(myFunc);

        engine.shutdown();

        myFunc.calledOnce.should.eql(true);

        done();
    });

    it("ServerEngine#shutdown engine should take care of disposing session on shutdown", function (done) {

        var engine = new ServerEngine();
        var session1 = engine.createSession();
        var session2 = engine.createSession();
        var session3 = engine.createSession();

        should.exist(session1);
        should.exist(session2);
        should.exist(session3);

        engine.shutdown();
        // leaks will be detected if engine failed to dispose session
        done();
    });

});


describe("ServerEngine ServerStatus & ServerCapabilities", function () {

    var sinon = require("sinon");

    var engine;

    var defaultBuildInfo = {
        productName: "NODEOPCUA-SERVER",
        softwareVersion: "1.0",
        manufacturerName: "<Manufacturer>",
        productUri: "URI:NODEOPCUA-SERVER"
    };

    this.timeout(40000);
    var test;
    before(function (done) {

        test = this;

        engine = new ServerEngine({buildInfo: defaultBuildInfo});

        engine.initialize({nodeset_filename: server_engine.standard_nodeset_file}, function () {
            done();
        });

    });
    after(function () {
        engine.shutdown();
        engine = null;
    });
    beforeEach(function () {
        test.clock = sinon.useFakeTimers(Date.now());

    });
    afterEach(function () {
        test.clock.restore();
    });

    it("ServerEngine#ServerCapabilities should expose ServerCapabilities ", function (done) {

        var serverCapabilitiesId = makeNodeId(ObjectIds.Server_ServerCapabilities); // ns=0;i=2268
        serverCapabilitiesId.toString().should.eql("ns=0;i=2268");

        var addressSpace = engine.addressSpace;
        var serverCapabilitiesNode = addressSpace.findNode(serverCapabilitiesId);

        should(serverCapabilitiesNode).be.instanceOf(UAObject);


        // ->
        done();
    });

    it("ServerEngine#ServerStatus should expose currentTime", function (done) {

        var currentTimeId = makeNodeId(VariableIds.Server_ServerStatus_CurrentTime); // ns=0;i=2258
        currentTimeId.value.should.eql(2258);

        var addressSpace = engine.addressSpace;
        var currentTimeNode = addressSpace.findNode(currentTimeId);
        var d1 = currentTimeNode.readValue();

        test.clock.tick(1000);
        var d2 = currentTimeNode.readValue();
        d2.value.value.getTime().should.be.greaterThan(d1.value.value.getTime() + 900);

        test.clock.tick(1000);
        var d3 = currentTimeNode.readValue();
        d3.value.value.getTime().should.be.greaterThan(d2.value.value.getTime() + 900);

        test.clock.tick(1000);
        var d4 = currentTimeNode.readValue();
        d4.value.value.getTime().should.be.greaterThan(d3.value.value.getTime() + 900);

        done();
    });

});