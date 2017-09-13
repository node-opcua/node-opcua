"use strict";
/* global describe,it,require,before*/
require("should");


var address_space = require("..");
var AddressSpace = address_space.AddressSpace;
var nodeid = require("node-opcua-nodeid");
var NodeId = require("node-opcua-nodeid").NodeId;

var AttributeIds = require("node-opcua-data-model").AttributeIds;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var BrowseDirection = require("node-opcua-data-model").BrowseDirection;


var _ = require("underscore");
var redirectToFile = require("node-opcua-debug").redirectToFile;
var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;


var context = require("..").SessionContext.defaultContext;
var BaseNode = require("..").BaseNode;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing ReferenceType", function () {
    var addressSpace;
    var rootFolder;
    before(function (done) {
        get_mini_address_space(function (err, data) {

            if (err) {
                return done(err);
            }

            addressSpace = data;
            addressSpace.should.be.instanceOf(AddressSpace);

            rootFolder = addressSpace.rootFolder;
            rootFolder.browseName.toString().should.equal("Root");

            done();
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        rootFolder = null;
        done();
    });

    it("should find 'HierarchicalReferences'", function () {

        var hr = addressSpace.findReferenceType("HierarchicalReferences");
        hr.browseName.toString().should.equal("HierarchicalReferences");
        hr.nodeId.toString().should.eql(nodeid.makeNodeId(33).toString());

    });

    it("HierarchicalReferences should have an Abstract attribute set to true ", function () {

        var hr = addressSpace.findReferenceType("HierarchicalReferences");
        var v = hr.readAttribute(context, AttributeIds.IsAbstract);
        v.statusCode.should.eql(StatusCodes.Good);
        v.value.dataType.should.eql(DataType.Boolean);
        v.value.value.should.eql(true);

    });

    it("Organizes should have an Abstract attribute set to true ", function () {

        var hr = addressSpace.findReferenceType("Organizes");
        var v = hr.readAttribute(context, AttributeIds.IsAbstract);
        v.statusCode.should.eql(StatusCodes.Good);
        v.value.dataType.should.eql(DataType.Boolean);
        v.value.value.should.eql(false);
    });

    it("should find 'Organizes'", function () {
        var organizes_refId = addressSpace.findReferenceType("Organizes");
        organizes_refId.browseName.toString().should.equal("Organizes");
        organizes_refId.nodeId.toString().should.eql(nodeid.makeNodeId(35).toString());
    });

    it("'Organizes' should be a super type of 'HierarchicalReferences'", function () {

        var hr = addressSpace.findReferenceType("HierarchicalReferences");
        var organizes_refId = addressSpace.findReferenceType("Organizes");

        organizes_refId.isSupertypeOf(hr).should.eql(true);
        hr.isSupertypeOf(organizes_refId).should.eql(false);

    });

    it("'HasTypeDefinition' should *not* be a super-type of 'HierarchicalReferences'", function () {

        var hr = addressSpace.findReferenceType("HierarchicalReferences");
        var hasTypeDefinition_refId = addressSpace.findReferenceType("HasTypeDefinition");

        hasTypeDefinition_refId.isSupertypeOf(hr).should.eql(false);
        hr.isSupertypeOf(hasTypeDefinition_refId).should.eql(false);

    });

    it("'HasTypeDefinition' should  be a super-type of 'NonHierarchicalReferences'", function () {

        var nhr = addressSpace.findReferenceType("NonHierarchicalReferences");
        var hasTypeDefinition_refId = addressSpace.findReferenceType("HasTypeDefinition");

        hasTypeDefinition_refId.isSupertypeOf(nhr).should.eql(true);
        nhr.isSupertypeOf(hasTypeDefinition_refId).should.eql(false);

    });


    it("should return 4 refs for browseNode on RootFolder ,  referenceTypeId=null,!includeSubtypes  ", function () {

        var references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: null,
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.be.greaterThan(2);

        var names = references.map(function (ref) {
            return addressSpace.findNode(ref.nodeId).browseName.toString();
        });
        var expectedNames = ["FolderType", "Objects", "Types", "Views"];
        _.intersection(names, expectedNames).length.should.eql(expectedNames.length);
    });

    it("should return 1 refs for browseNode on RootFolder ,  NonHierarchicalReferences, includeSubtypes  ", function () {

        var references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "NonHierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.equal(1);
    });

    it("should return 3 refs for browseNode on RootFolder , Organizes ,!includeSubtypes  ", function () {

        var references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "Organizes",
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.be.greaterThan(2);

        var names = references.map(function (ref) {
            return addressSpace.findNode(ref.nodeId).browseName.toString();
        });
        var expectedNames = ["Objects", "Types", "Views"];
        _.intersection(names, expectedNames).length.should.eql(expectedNames.length);
    });

    it("should return 0 refs for browseNode on RootFolder , HierarchicalReferences ,!includeSubtypes  ", function () {

        var references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        browseNames.length.should.be.equal(0);

        references.length.should.equal(0);
    });


    it("should return 3 refs for browseNode on RootFolder , HierarchicalReferences , includeSubtypes  ", function () {

        var serverStatus = rootFolder.objects.server.serverStatus;
        serverStatus.browseName.toString().should.equal("ServerStatus");

        var references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        references.length.should.be.greaterThan(2);
    });

    it("should return 6 refs for browseNode on ServerStatus (BrowseDirection.Forward)", function () {

        var serverStatus = rootFolder.objects.server.serverStatus;
        serverStatus.browseName.toString().should.equal("ServerStatus");

        var references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        //xx console.log("              " + browseNames.join(" , "));

        references.length.should.equal(6);

        var expectedBrowseNames = ['StartTime', 'CurrentTime', 'State', 'BuildInfo', 'SecondsTillShutdown', 'ShutdownReason'];

        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

    });

    it("ServerStatus parent shall be Server", function (done) {

        var server = rootFolder.objects.server;
        server.browseName.toString().should.equal("Server");
        server.nodeId.toString().should.equal("ns=0;i=2253");

        var serverStatus = server.serverStatus;
        serverStatus.browseName.toString().should.equal("ServerStatus");
        serverStatus.nodeId.toString().should.equal("ns=0;i=2256");

        serverStatus.parent.nodeId.should.equal(server.nodeId);
        done();
    });


    it("should return 1 refs for browseNode on ServerStatus (BrowseDirection.Reverse)", function (done) {

        var serverStatus = rootFolder.objects.server.serverStatus;

        var references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Inverse,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });

        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        console.log("             browseNames :  " + browseNames.join(" , "));

        //xx references.length.should.equal(7);
        var expectedBrowseNames = ['Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

        redirectToFile("ReferenceDescription1.log", function () {
            _.isArray(references).should.eql(true);
            var dump = require("../src/base_node").dumpReferenceDescriptions;
            dump(addressSpace, references);
        }, done);
    });


    it("should return 7 refs for browseNode on ServerStatus (BrowseDirection.Both)", function (done) {

        var serverStatus = rootFolder.objects.server.serverStatus;

        var references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });

        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });

        //xx console.log("              " + browseNames.join(" , "));

        var expectedBrowseNames = ['StartTime', 'CurrentTime', 'State', 'BuildInfo', 'SecondsTillShutdown', 'ShutdownReason', 'Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

        redirectToFile("ReferenceDescription2.log", function () {
            _.isArray(references).should.eql(true);
            var dump = require("../src/base_node").dumpReferenceDescriptions;
            dump(addressSpace, references);
        }, done);

    });

    it("should return 1 refs for browseNode on ServerStatus (BrowseDirection.Reverse)", function () {

        var serverStatus = rootFolder.objects.server.serverStatus;

        var references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Inverse,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });

        references.length.should.equal(1);
        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });
        var expectedBrowseNames = ['Server'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);
    });

    it("should return 1 refs for browseNode on Server (BrowseDirection.Forward) and NodeClass set to Method", function () {

        var makeNodeClassMask = require("node-opcua-data-model").makeNodeClassMask;
        var BrowseDirection = require("node-opcua-data-model").BrowseDirection;
        var mask = makeNodeClassMask("Method");

        var server = rootFolder.objects.server;
        server.browseName.toString().should.equal("Server");

        var references = server.browseNode({
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: mask, // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            resultMask: 0x3F
        });

        var browseNames = references.map(function (r) {
            return r.browseName.name;
        });

        references.length.should.equal(1);

        var expectedBrowseNames = ['GetMonitoredItems'];
        _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);

    });

    it("ReferenceType should have a toString (HierarchicalReferences)", function () {
        var hr = addressSpace.findReferenceType("HierarchicalReferences");

        hr.toString().should.eql("A  HierarchicalReferences/HierarchicalReferences ns=0;i=33");
    });

    it("ReferenceType should have a toString (Organizes)", function () {
        var hr = addressSpace.findReferenceType("Organizes");

        hr.toString().should.eql("   Organizes/OrganizedBy ns=0;i=35");
    });

    /**
     *
     */
    it("ReferenceType#getAllSubtypes should extract all possible referenceType ", function () {


        var hr = addressSpace.findReferenceType("HierarchicalReferences");
        var derivedTypes = hr.getAllSubtypes();

        var s = derivedTypes.map(function (r) {
            return r.browseName.toString();
        }).join(" ");
        s.should.eql("HierarchicalReferences HasChild Aggregates HasProperty HasComponent HasOrderedComponent HasHistoricalConfiguration HasSubtype Organizes HasEventSource HasNotifier");
        //xx console.log(s);

        var aggregates = addressSpace.findReferenceType("Aggregates");
        derivedTypes = aggregates.getAllSubtypes();
        s = derivedTypes.map(function (r) {
            return r.browseName.toString();
        }).join(" ");
        s.should.eql("Aggregates HasProperty HasComponent HasOrderedComponent HasHistoricalConfiguration");
        //xx console.log(s);

    });


    function _is_valid_BrowseDirection(browseDirection) {
        return browseDirection === BrowseDirection.Forward ||
          browseDirection === BrowseDirection.Inverse ||
          browseDirection === BrowseDirection.Both
          ;
    }

    /**
     * find all references that have the provided referenceType or are subType of this referenceType
     * @method findReferencesEx
     * @param strReference {String} the referenceType as a string.
     * @param  [browseDirection=BrowseDirection.Forward] {BrowseDirection}
     * @return {Array<ReferenceDescription>}
     */
    BaseNode.prototype.findReferencesEx_deprecated = function (strReference, browseDirection) {

        browseDirection = browseDirection || BrowseDirection.Forward;
        _is_valid_BrowseDirection(browseDirection).should.eql(true);

        var addressSpace = this.addressSpace;

        var referenceType = addressSpace.findReferenceType(strReference);
        if (!referenceType) {
            // note: when loading nodeset2.xml files, reference type may not exit yet
            // throw new Error("expecting valid reference name " + strReference);
            return [];
        }
        referenceType.nodeId.should.be.instanceOf(NodeId);

        var browseResults = this.browseNode({
            browseDirection: browseDirection,
            referenceTypeId: referenceType.nodeId,
            includeSubtypes: true,
            nodeClassMask: 0,
            resultMask: 0x3F
        });
        return browseResults;
    };

    it("BaseNode#findReferencesEx should be fast ", function (done) {

        var Benchmarker = require("node-opcua-benchmarker").Benchmarker;

        this.timeout(Math.max(this._timeout, 100000));

        var bench = new Benchmarker();

        var server = addressSpace.findNode("i=63");//rootFolder.objects.server;

        //xx console.log("referenceTypes",referenceTypes.map(function(e){return e.browseName;}));
        bench.add("findReferencesEx slow", function () {


            var a = server.findReferencesEx_deprecated("HasChild", BrowseDirection.Forward);
            var a = server.findReferencesEx_deprecated("HasChild", BrowseDirection.Inverse);

        })
        .add("findReferencesEx fast", function () {

            var a = server.findReferencesEx("HasChild", BrowseDirection.Forward);
            var a = server.findReferencesEx("HasChild", BrowseDirection.Inverse);

        })
        .on("cycle", function (message) {
            console.log(message);
        })
        .on("complete", function () {

            console.log(' Fastest is ' + this.fastest.name);
            console.log(' Speed Up : x', this.speedUp);
            this.fastest.name.should.eql("findReferencesEx fast");

            //xx this.speedUp.should.be.greaterThan(5); // at least 5 time faster

            done();
        })
        .run({
            max_time: 0.2, // Sec
            min_count: 300
        });
    });

});


describe(" improving performance of isSupertypeOf", function () {


    var NodeClass = require("node-opcua-data-model").NodeClass;
    //  References i=31
    //  +->(hasSubtype) NoHierarchicalReferences
    //                  +->(hasSubtype) HasTypeDefinition
    //  +->(hasSubtype) HierarchicalReferences
    //                  +->(hasSubtype) HasChild/ChildOf
    //                                  +->(hasSubtype) Aggregates/AggregatedBy
    //                                                  +-> HasProperty/PropertyOf
    //                                                  +-> HasComponent/ComponentOf
    //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
    //                                 +->(hasSubtype) HasSubtype/HasSupertype
    //                  +->(hasSubtype) Organizes/OrganizedBy
    //                  +->(hasSubtype) HasEventSource/EventSourceOf
    var Benchmarker = require("node-opcua-benchmarker").Benchmarker;

    var referenceTypeNames = Object.keys(require("node-opcua-constants").ReferenceTypeIds);

    var referenceTypes = [];

    var addressSpace;
    before(function (done) {
        get_mini_address_space(function (err, data) {

            if (err) {
                return done(err);
            }

            addressSpace = data;

            referenceTypes = referenceTypeNames.map(function (referenceTypeName) {
                return addressSpace.findReferenceType(referenceTypeName);
            });
            referenceTypes = referenceTypes.filter(function (e) {
                return e !== undefined;
            });

            referenceTypes[0].nodeClass.should.eql(NodeClass.ReferenceType);
            done();
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });


    it("should ensure that optimized version of isSupertypeOf produce same result as brute force version", function (done) {

        referenceTypes.forEach(function (referenceType) {
            var flags1 = referenceTypes.map(function (refType) {
                return referenceType.isSupertypeOf(refType);
            });
            var flags2 = referenceTypes.map(function (refType) {
                return referenceType._slow_isSupertypeOf(refType);
            });

            //xx console.log( referenceType.browseName,flags1.map(function(f){return f ? 1 :0;}).join(" - "));
            //xx console.log( referenceType.browseName,flags2.map(function(f){return f ? 1 :0;}).join(" - "));
            flags1.should.eql(flags2);

        });
        done();
    });

    it("should ensure that optimized version of isSupertypeOf is really faster that brute force version", function (done) {

        this.timeout(Math.max(this._timeout, 100000));

        var bench = new Benchmarker();

        //xx console.log("referenceTypes",referenceTypes.map(function(e){return e.browseName;}));
        bench.add("isSupertypeOf slow", function () {

            referenceTypes.forEach(function (referenceType) {
                referenceTypes.map(function (refType) {
                    return referenceType._slow_isSupertypeOf(refType);
                });
            });

        })
        .add("isSupertypeOf fast", function () {

            referenceTypes.forEach(function (referenceType) {
                referenceTypes.map(function (refType) {
                    return referenceType.isSupertypeOf(refType);
                });

            });
        })
        .on("cycle", function (message) {
            console.log(message);
        })
        .on("complete", function () {

            console.log(' Fastest is ' + this.fastest.name);
            console.log(' Speed Up : x', this.speedUp);
            this.fastest.name.should.eql("isSupertypeOf fast");

            this.speedUp.should.be.greaterThan(3); // at least 3 time faster

            done();
        })
        .run({
            max_time: 0.2, // Sec
            min_count: 300,
        });
    });

    it("ZZ should ensure that fast version isSupertypeOf shall update its cache when new References are added ", function () {

        function allSubTypes(n) {
            return n.getAllSubtypes().map(function (c) {
                return c.browseName.toString()
            }).join(",");
        }

        var nhr = addressSpace.findReferenceType("NonHierarchicalReferences");
        nhr.browseName.toString().should.eql("NonHierarchicalReferences");

        //xx console.log(allSubTypes(nhr));

        allSubTypes(nhr).indexOf("NonHierarchicalReferences").should.be.aboveOrEqual(0);

        var hasTypeDefinition = addressSpace.findReferenceType("HasTypeDefinition");

        hasTypeDefinition.isSupertypeOf(nhr).should.eql(true);
        nhr.isSupertypeOf(hasTypeDefinition).should.eql(false);

        var flowTo = addressSpace.addReferenceType({
            browseName: "FlowTo",
            inverseName: "FlowFrom",
            isAbstract: false,
            subtypeOf: "NonHierarchicalReferences"
        });

        flowTo.isSupertypeOf(nhr).should.eql(true);

        //xx console.log(allSubTypes(nhr));
        allSubTypes(nhr).indexOf("FlowTo").should.be.aboveOrEqual(0);

    });
});
