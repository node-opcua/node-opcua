
var coerceNodeId = require("..").coerceNodeId;
var resolveNodeId = require("..").resolveNodeId;
var makeNodeId = require("..").makeNodeId;
var NodeIdType = require("..").NodeIdType;
var NodeId = require("..").NodeId;
var sameNodeId = require("..").sameNodeId;

var should = require("should");
var assert = require("node-opcua-assert");
var Benchmarker = require("node-opcua-benchmarker").Benchmarker;

describe("testing NodeIds", function () {

    it("should create a NUMERIC nodeID", function () {
        var nodeId = new NodeId(NodeIdType.NUMERIC, 23, 2);
        nodeId.value.should.equal(23);
        nodeId.namespace.should.equal(2);
        nodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        nodeId.toString().should.eql("ns=2;i=23");

    });

    it("should create a NUMERIC nodeID with the largest possible values", function () {
        var nodeId = new NodeId(NodeIdType.NUMERIC, 0xFFFFFFFF, 0xFFFF);
        nodeId.value.should.equal(0xFFFFFFFF);
        nodeId.namespace.should.equal(0xFFFF);
        nodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        nodeId.toString().should.eql("ns=65535;i=4294967295");
    });

    it("should raise an error for  NUMERIC nodeID with invalid  values", function () {

        should(function() {
            var nodeId = new NodeId(NodeIdType.NUMERIC, -1, -1);
        }).throwError();
    });

    it("should create a STRING nodeID", function () {
        var nodeId = new NodeId(NodeIdType.STRING, "TemperatureSensor", 4);
        nodeId.value.should.equal("TemperatureSensor");
        nodeId.namespace.should.equal(4);
        nodeId.identifierType.should.eql(NodeIdType.STRING);
        nodeId.toString().should.eql("ns=4;s=TemperatureSensor");
    });

    it("should create a OPAQUE nodeID", function () {

        var buffer = new Buffer(4);
        buffer.writeUInt32BE(0xDEADBEEF, 0);

        var nodeId = new NodeId(NodeIdType.BYTESTRING, buffer, 4);
        nodeId.value.toString("hex").should.equal("deadbeef");
        nodeId.namespace.should.equal(4);
        nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        nodeId.toString().should.eql("ns=4;b=deadbeef");
    });

});

describe("testing coerceNodeId", function () {

    it("should coerce a string of a form 'i=1234'", function () {
        coerceNodeId("i=1234").should.eql(makeNodeId(1234));
    });

    it("should coerce a string of a form 'ns=2;i=1234'", function () {
        coerceNodeId("ns=2;i=1234").should.eql(makeNodeId(1234, 2));
    });

    it("should coerce a string of a form 's=TemperatureSensor' ", function () {
        var ref_nodeId = new NodeId(NodeIdType.STRING, "TemperatureSensor", 0);
        coerceNodeId("s=TemperatureSensor").should.eql(ref_nodeId);
    });

    it("should coerce a string of a form 'ns=2;s=TemperatureSensor' ", function () {
        var ref_nodeId = new NodeId(NodeIdType.STRING, "TemperatureSensor", 2);
        coerceNodeId("ns=2;s=TemperatureSensor").should.eql(ref_nodeId);
    });

    it("should coerce a string of a form 'ns=4;s=Test32;datatype=Int32'  (Mika)", function () {
        var ref_nodeId = new NodeId(NodeIdType.STRING, "Test32;datatype=Int32", 4);
        coerceNodeId("ns=4;s=Test32;datatype=Int32").should.eql(ref_nodeId);
        try {
            makeNodeId("ns=4;s=Test32;datatype=Int32").should.eql(ref_nodeId);
        }
        catch(err){
            should.exist(err);
        }


    });


    it("should coerce a integer", function () {
        coerceNodeId(1234).should.eql(makeNodeId(1234));
    });

    it("should coerce a OPAQUE buffer as a BYTESTRING", function () {
        var buffer = new Buffer(8);
        buffer.writeUInt32BE(0xB1DEDADA, 0);
        buffer.writeUInt32BE(0xB0B0ABBA, 4);
        var nodeId = coerceNodeId(buffer);
        nodeId.toString().should.eql("ns=0;b=b1dedadab0b0abba");
        nodeId.value.toString("hex").should.eql("b1dedadab0b0abba");
    });

    it("should coerce a OPAQUE buffer in a string ( with namespace ) ", function () {

        var nodeId = coerceNodeId("ns=0;b=b1dedadab0b0abba");
        nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        nodeId.toString().should.eql("ns=0;b=b1dedadab0b0abba");
        nodeId.value.toString("hex").should.eql("b1dedadab0b0abba");

    });
    it("should coerce a OPAQUE buffer in a string ( without namespace ) ", function () {

        var nodeId = coerceNodeId("b=b1dedadab0b0abba");
        nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        nodeId.toString().should.eql("ns=0;b=b1dedadab0b0abba");
        nodeId.value.toString("hex").should.eql("b1dedadab0b0abba");

    });
    it("should coerce a GUID node id (without namespace)", function () {

        var nodeId = coerceNodeId("g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.identifierType.should.eql(NodeIdType.GUID);
        nodeId.toString().should.eql("ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.value.should.eql("1E14849E-3744-470d-8C7B-5F9110C2FA32");
    });
    it("should coerce a GUID node id (with namespace)", function () {

        var nodeId = coerceNodeId("ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.identifierType.should.eql(NodeIdType.GUID);
        nodeId.toString().should.eql("ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.value.should.eql("1E14849E-3744-470d-8C7B-5F9110C2FA32");
    });

    it("should not coerce a malformed string to a nodeid", function () {

        var nodeId;

        (function () {
            nodeId = coerceNodeId("ThisIsNotANodeId");
        }).should.throw();

        (function () {
            nodeId = coerceNodeId("HierarchicalReferences");
        }).should.throw();

        (function () {
            nodeId = coerceNodeId("ns=0;s=HierarchicalReferences");
            assert(nodeId !== null);
        }).should.not.throw();

    });

    it("should detect empty Numeric NodeIds", function () {

        var empty_nodeId = makeNodeId(0, 0);
        empty_nodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        empty_nodeId.isEmpty().should.be.eql(true);

        var non_empty_nodeId = makeNodeId(1, 0);
        non_empty_nodeId.isEmpty().should.be.eql(false);
    });
    it("should detect empty String NodeIds", function () {
        // empty string nodeId
        var empty_nodeId = coerceNodeId("ns=0;s=");
        empty_nodeId.identifierType.should.eql(NodeIdType.STRING);
        empty_nodeId.isEmpty().should.be.eql(true);

        var non_empty_nodeId =coerceNodeId("ns=0;s=A");
        non_empty_nodeId.identifierType.should.eql(NodeIdType.STRING);
        non_empty_nodeId.isEmpty().should.be.eql(false);
    });
    it("should detect empty Opaque NodeIds", function () {

        // empty opaque nodeId
        var empty_nodeId = coerceNodeId(new Buffer(0));
        empty_nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        empty_nodeId.isEmpty().should.be.eql(true);

        var non_empty_nodeId =coerceNodeId(new Buffer(1));
        empty_nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        non_empty_nodeId.isEmpty().should.be.eql(false);
    });
    it("should detect empty GUID NodeIds", function () {
        // empty GUID nodeId
        var empty_nodeId = coerceNodeId("g=00000000-0000-0000-0000-000000000000");
        empty_nodeId.identifierType.should.eql(NodeIdType.GUID);
        empty_nodeId.isEmpty().should.be.eql(true);

        var non_empty_nodeId = coerceNodeId("g=00000000-0000-0000-0000-000000000001");
        empty_nodeId.identifierType.should.eql(NodeIdType.GUID);
        non_empty_nodeId.isEmpty().should.be.eql(false);
    });

    it("should convert an empty NodeId to  <empty nodeid> string", function () {
        var empty_nodeId = makeNodeId(0, 0);
        empty_nodeId.toString().should.eql("ns=0;i=0");
    });


    it("should coerce a string nodeid containing special characters", function () {
        // see issue#
        var nodeId = coerceNodeId("ns=3;s={360273AA-F2B9-4A7F-A5E3-37B7074E2529}.MechanicalDomain");

    });
});


describe("#sameNodeId", function () {

    var nodeIds = [
        makeNodeId(2,3),
        makeNodeId(2,4),
        makeNodeId(4,3),
        makeNodeId(4,300),
        new NodeId(NodeIdType.NUMERIC, 23, 2),
        new NodeId(NodeIdType.STRING, "TemperatureSensor", 4),
        new NodeId(NodeIdType.STRING, "A very long string very very long string", 4),
        new NodeId(NodeIdType.BYTESTRING, new Buffer("AZERTY"), 4),
    ];
    for (var i= 0;i<nodeIds.length;i++) {
        var nodeId1 = nodeIds[i];
        for (var j= 0;j<nodeIds.length;j++) {
            var nodeId2 = nodeIds[j];

            if ( i==j) {
                it("should be true  : #sameNodeId('" + nodeId1.toString()+ "','" + nodeId2.toString()+"');",function() {
                    sameNodeId(nodeId1,nodeId2).should.eql(true);
                });
            } else {
                it("should be false : #sameNodeId('" + nodeId1.toString()+ "','" + nodeId2.toString()+"');",function() {
                    sameNodeId(nodeId1,nodeId2).should.eql(true);
                });
            }
        }
    }

    function sameNodeIdOld(n1,n2) {
        return n1.toString() === n2.toString();
    }
    it("should implement a efficient sameNodeId ",function(done) {

        var bench = new Benchmarker();

        bench
            .add('sameNodeIdOld', function () {
                for (var i= 0;i<nodeIds.length;i++) {
                    var nodeId1 = nodeIds[i];
                    for (var j = 0; j < nodeIds.length; j++) {
                        var nodeId2 = nodeIds[j];
                        sameNodeIdOld(nodeId1,nodeId2).should.eql((i===j));
                    }
                }
            })
            .add('sameNodeId', function () {
                for (var i= 0;i<nodeIds.length;i++) {
                    var nodeId1 = nodeIds[i];
                    for (var j = 0; j < nodeIds.length; j++) {
                        var nodeId2 = nodeIds[j];
                        sameNodeId(nodeId1,nodeId2).should.eql((i===j));
                    }
                }
            })
            .on('cycle', function (message) {
                console.log(message);
            })

            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);

                // the following line is commented out as test may fail due to gc taking place randomly
                // this.fastest.name.should.eql("sameNodeId");
                done();
            })

            .run({max_time: 0.1});
    });
});





describe("testing resolveNodeId", function () {

    // some objects
    it("should resolve RootFolder to 'ns=0;i=84' ", function () {
        var ref_nodeId = new NodeId(NodeIdType.NUMERIC, 84, 0);
        resolveNodeId("RootFolder").should.eql(ref_nodeId);
        resolveNodeId("RootFolder").toString().should.equal("ns=0;i=84");
    });

    it("should resolve ObjectsFolder to 'ns=0;i=85' ", function () {
        var ref_nodeId = new NodeId(NodeIdType.NUMERIC, 85, 0);
        resolveNodeId("ObjectsFolder").should.eql(ref_nodeId);
        resolveNodeId("ObjectsFolder").toString().should.equal("ns=0;i=85");
    });

    // Variable
    it("should resolve ServerType_NamespaceArray to 'ns=0;i=2006' ", function () {
        resolveNodeId("ServerType_NamespaceArray").toString().should.equal("ns=0;i=2006");
    });

    // ObjectType
    it("should resolve FolderType to 'ns=0;i=61' ", function () {
        resolveNodeId("FolderType").toString().should.equal("ns=0;i=61");
    });

    // VariableType
    it("should resolve AnalogItemType to 'ns=0;i=2368' ", function () {
        resolveNodeId("AnalogItemType").toString().should.equal("ns=0;i=2368");
    });

    //ReferenceType
    it("should resolve HierarchicalReferences to 'ns=0;i=33' ", function () {
        resolveNodeId("HierarchicalReferences").toString().should.equal("ns=0;i=33");
    });
});

describe("testing NodeId coercing bug ", function () {

    it("should handle strange string nodeId ", function () {
        coerceNodeId("ns=2;s=S7_Connection_1.db1.0,x0").should.eql(makeNodeId("S7_Connection_1.db1.0,x0", 2));
    });

});


describe("testing NodeId.displayText", function () {

    it("should provide a richer display text when nodeid is known", function () {
        var ref_nodeId = new NodeId(NodeIdType.NUMERIC, 85, 0);
        ref_nodeId.displayText().should.equal("ObjectsFolder (ns=0;i=85)");
    });

});

describe("issue#372 coercing & making nodeid string containing semi-column", function () {

    it("should coerce a nodeid string containing a semi-column", function () {

        var nodeId = coerceNodeId("ns=0;s=my;nodeid;with;semicolum");
        nodeId.identifierType.should.eql(NodeIdType.STRING);
        nodeId.value.should.be.eql("my;nodeid;with;semicolum");

    });

    it("should make a nodeid as a string containing semi-column",function() {

        var nodeId = makeNodeId("my;nodeid;with;semicolum");
        nodeId.identifierType.should.eql(NodeIdType.STRING);
        nodeId.value.should.be.eql("my;nodeid;with;semicolum");

    });

});



