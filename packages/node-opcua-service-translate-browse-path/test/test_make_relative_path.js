"use strict";
var should = require("should");


var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var QualifiedName = require("node-opcua-data-model").QualifiedName;

var tbp_service = require("..");

var makeRelativePath = tbp_service.makeRelativePath;
var RelativePath = tbp_service.RelativePath;
var RelativePathElement = tbp_service.RelativePathElement;

describe("makeRelativePath", function () {


    var hierarchicalReferenceTypeNodeId = resolveNodeId("HierarchicalReferences");
    var aggregatesReferenceTypeNodeId = resolveNodeId("Aggregates");
    var sinon = require("sinon");

    it("T1 should construct simple RelativePath for '/' ", function () {
        var relativePath = makeRelativePath("/");
        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({})
        }));
    });

    it("T2 should construct simple RelativePath for '.' ", function () {
        var relativePath = makeRelativePath(".");
        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({})
        }));
    });

    it("T3 should construct simple RelativePath for '<HasChild>' ", function () {
        var relativePath = makeRelativePath("<HasChild>");
        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("HasChild"),
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({})
        }));
    });

    it("T4 should construct simple RelativePath for '<#HasChild>' ", function () {
        var relativePath = makeRelativePath("<#HasChild>");
        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("HasChild"),
            isInverse: false,
            includeSubtypes: false,
            targetName: new QualifiedName({})
        }));
    });

    it("T5 should construct simple RelativePath for '<!HasChild>' ", function () {
        var relativePath = makeRelativePath("<!HasChild>");
        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("HasChild"),
            isInverse: true,
            includeSubtypes: true,
            targetName: new QualifiedName({})
        }));
    });
    it("T6 should construct simple RelativePath for '<#!HasChild>' ", function () {
        var relativePath = makeRelativePath("<#!HasChild>");
        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("HasChild"),
            isInverse: true,
            includeSubtypes: false,
            targetName: new QualifiedName({})
        }));
    });
    it("T7 should construct simple RelativePath for '/3:Truck'", function () {

        var relativePath = makeRelativePath("/3:Truck");
        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 3, name: "Truck"})
        }));

    });

    // “/3:Truck.0:NodeVersion”
    //   Follows any forward hierarchical Reference with target BrowseName = “3:Truck” and from there a forward
    // Aggregates Reference to a target with BrowseName “0:NodeVersion”.
    it("T8 should construct simple RelativePath for '/3:Truck.0:NodeVersion' ", function () {

        var relativePath = makeRelativePath("/3:Truck.0:NodeVersion");
        relativePath.elements.length.should.eql(2);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 3, name: "Truck"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "NodeVersion"})
        }));

    });

    /// “/2:Block&.Output”  Follows any forward hierarchical Reference with target BrowseName = “2:Block.Output”.
    it("T9 should construct simple RelativePath for '/2:Block&.Output'", function () {
        var relativePath = makeRelativePath("/2:Block&.Output");

        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 2, name: "Block.Output"})
        }));
    });


    // “<1:ConnectedTo>1:Boiler/1:HeatSensor”
    // Follows any forward Reference with a BrowseName = ‘1:ConnectedTo’ and
    //  finds targets with BrowseName = ‘1:Boiler’. From there follows any hierarchical
    // Reference and find targets with BrowseName = ‘1:HeatSensor’.
    it("TA should construct simple RelativePath for '<1:ConnectedTo>1:Boiler/1:HeatSensor'", function () {

        var sinon = require("sinon");
        var addressSpace = {
            findReferenceType: sinon.stub().returns(makeNodeId(555, 1))
        };
        var relativePath = makeRelativePath("<1:ConnectedTo>1:Boiler/1:HeatSensor", addressSpace);

        relativePath.elements.length.should.eql(2);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: makeNodeId(555, 1),
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 1, name: "Boiler"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 1, name: "HeatSensor"})
        }));

    });


    // “<1:ConnectedTo>1:Boiler/”
    //  Follows any forward Reference with a BrowseName = ‘1:ConnectedTo’ and finds targets
    // with BrowseName = ‘1:Boiler’. From there it finds all targets of hierarchical References.
    it("TB should construct simple RelativePath for '<1:ConnectedTo>1:Boiler/'", function () {

        var sinon = require("sinon");
        var addressSpace = {
            findReferenceType: sinon.stub().returns(makeNodeId(555, 1))
        };
        var relativePath = makeRelativePath("<1:ConnectedTo>1:Boiler/", addressSpace);

        addressSpace.findReferenceType.getCall(0).args[0].should.eql("ConnectedTo");
        addressSpace.findReferenceType.getCall(0).args[1].should.eql(1);

        relativePath.elements.length.should.eql(2);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: makeNodeId(555, 1),
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 1, name: "Boiler"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({})
        }));

    });

    // “<0:HasChild>2:Wheel”
    //  Follows any forward Reference with a BrowseName = ‘HasChild’ and qualified
    // with the default OPC UA namespace. Then find targets with BrowseName =
    //     ‘Wheel’ qualified with namespace index ‘2’.
    it("TC should construct simple RelativePath for '<0:HasChild>2:Wheel'", function () {
        var addressSpace = {
            findReferenceType: sinon.stub().returns(makeNodeId(555, 1))
        };
        var relativePath = makeRelativePath("<0:HasChild>2:Wheel", addressSpace);

        addressSpace.findReferenceType.getCall(0).args[0].should.eql("HasChild");
        addressSpace.findReferenceType.getCall(0).args[1].should.eql(0);

        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: makeNodeId(555, 1),
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 2, name: "Wheel"})
        }));
    });

    // “<!HasChild>Truck”
    //  Follows any inverse Reference with a BrowseName = ‘HasChild’. Then find targets with BrowseName = ‘Truck’.
    // In both cases, the namespace component of the BrowseName is assumed to be 0.
    it("TD should construct simple RelativePath for '<!HasChild>2:Wheel'", function () {
        var addressSpace = {
            findReferenceType: sinon.stub().returns(makeNodeId(555, 1))
        };
        var relativePath = makeRelativePath("<!HasChild>2:Wheel", addressSpace);

        addressSpace.findReferenceType.callCount.should.eql(0);

        relativePath.elements.length.should.eql(1);
        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("HasChild"),
            isInverse: true,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 2, name: "Wheel"})
        }));
    });
    // “<0:HasChild>”
    // Finds all targets of forward References with a BrowseName = ‘HasChild’
    // and qualified with the default OPC UA namespace.
    it("TE should construct simple RelativePath for '<0:HasChild>'", function () {

        var addressSpace = {
            findReferenceType: sinon.stub().returns(resolveNodeId("HasChild"))
        };

        var relativePath = makeRelativePath("<0:HasChild>", addressSpace);

        addressSpace.findReferenceType.callCount.should.eql(1);

        relativePath.elements.length.should.eql(1);

        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("HasChild"),
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({})
        }));
    });

    it("TF should construct simple RelativePath for '<Organizes>Server.ServerStatus.CurrentTime'", function () {

        var relativePath = makeRelativePath("<Organizes>Server.ServerStatus.CurrentTime", null);

        relativePath.elements.length.should.eql(3);

        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("Organizes"),
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "Server"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "ServerStatus"})
        }));
        relativePath.elements[2].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "CurrentTime"})
        }));
    });

    it("TG should construct simple RelativePath for '<Organizes>Server2.ServerStatus.1.2'", function () {

        var relativePath = makeRelativePath("<Organizes>Server2.ServerStatus.100.200", null);

        relativePath.elements.length.should.eql(4);

        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: resolveNodeId("Organizes"),
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "Server2"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "ServerStatus"})
        }));
        relativePath.elements[2].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "100"})
        }));

    });
    it("TH should construct simple RelativePath for '/3:TOTO/1:Channel#1/2:TOTO'", function () {

        // note : # is a reserved char and must be prepended with &
        var relativePath = makeRelativePath("/3:Tag1/1:Channel&#1/2:Tag2", null);

        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 3, name: "Tag1"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 1, name: "Channel#1"})
        }));
        relativePath.elements[2].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 2, name: "Tag2"})
        }));

    });
    it("TI (issue#344) should construct simple RelativePath for '/0:Objects/2:test-path'", function () {
        // note : # is a reserved char and must be prepended with &
        var relativePath = makeRelativePath("/0:Objects/2:test-path", null);

        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "Objects"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: hierarchicalReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 2, name: "test-path"})
        }));

    });
    it("TJ should construct simple RelativePath for SessionDiagnostics.TotalRequestsCount.TotalCount", function () {

        var relativePath = makeRelativePath(".SessionDiagnostics.TotalRequestsCount.TotalCount", null);

        relativePath.elements[0].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "SessionDiagnostics"})
        }));
        relativePath.elements[1].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "TotalRequestsCount"})
        }));
        relativePath.elements[2].should.eql(new RelativePathElement({
            referenceTypeId: aggregatesReferenceTypeNodeId,
            isInverse: false,
            includeSubtypes: true,
            targetName: new QualifiedName({namespaceIndex: 0, name: "TotalCount"})
        }));

    });
});
