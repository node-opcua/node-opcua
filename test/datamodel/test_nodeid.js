
var coerceNodeId = require("../../lib/datamodel/nodeid").coerceNodeId;
var resolveNodeId = require("../../lib/datamodel/nodeid").resolveNodeId;

var makeNodeId = require("../../lib/datamodel/nodeid").makeNodeId;
var NodeIdType = require("../../lib/datamodel/nodeid").NodeIdType;
var NodeId = require("../../lib/datamodel/nodeid").NodeId;

var should = require("should");
var assert = require("assert");

describe("testing NodeIds",function(){

    it("should create a NUMERIC nodeID",function(){
        var nodeId = new NodeId(NodeIdType.NUMERIC,23,2);
        nodeId.value.should.equal(23);
        nodeId.namespace.should.equal(2);
        nodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        nodeId.toString().should.eql("ns=2;i=23");

    });

    it("should create a STRING nodeID",function() {
        var nodeId = new NodeId(NodeIdType.STRING,"TemperatureSensor",4);
        nodeId.value.should.equal("TemperatureSensor");
        nodeId.namespace.should.equal(4);
        nodeId.identifierType.should.eql(NodeIdType.STRING);
        nodeId.toString().should.eql("ns=4;s=TemperatureSensor");
    });

    it("should create a OPAQUE nodeID",function() {

        var buffer = new Buffer(4);
        buffer.writeUInt32BE(0xDEADBEEF,0);

        var nodeId = new NodeId(NodeIdType.BYTESTRING, buffer,4 );
        nodeId.value.toString("hex").should.equal("deadbeef");
        nodeId.namespace.should.equal(4);
        nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        nodeId.toString().should.eql("ns=4;b=deadbeef");
    });

});

describe("testing coerceNodeId",function(){

    it("should coerce a string of a form 'i=1234'",function(){
       coerceNodeId("i=1234").should.eql(makeNodeId(1234));
    });

    it("should coerce a string of a form 'ns=2;i=1234'",function(){
        coerceNodeId("ns=2;i=1234").should.eql(makeNodeId(1234,2));
    });

    it("should coerce a string of a form 's=TemperatureSensor' ",function(){
        var ref_nodeId = new NodeId(NodeIdType.STRING,"TemperatureSensor",0);
        coerceNodeId("s=TemperatureSensor").should.eql(ref_nodeId);
    });

    it("should coerce a string of a form 'ns=2;s=TemperatureSensor' ",function(){
        var ref_nodeId = new NodeId(NodeIdType.STRING,"TemperatureSensor",2);
        coerceNodeId("ns=2;s=TemperatureSensor").should.eql(ref_nodeId);
    });

    it("should coerce a integer",function(){
        coerceNodeId(1234).should.eql(makeNodeId(1234));
    });

    it("should coerce a OPAQUE buffer as a BYTESTRING",function(){
        var buffer = new Buffer(8);
        buffer.writeUInt32BE(0xB1DEDADA,0);
        buffer.writeUInt32BE(0xB0B0ABBA,4);
        var nodeId = coerceNodeId(buffer);
        nodeId.toString().should.eql("ns=0;b=b1dedadab0b0abba");
        nodeId.value.toString("hex").should.eql("b1dedadab0b0abba");
    });

    it("should coerce a OPAQUE buffer in a string ( with namespace ) ",function(){

        var nodeId = coerceNodeId("ns=0;b=b1dedadab0b0abba");
        nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        nodeId.toString().should.eql("ns=0;b=b1dedadab0b0abba");
        nodeId.value.toString("hex").should.eql("b1dedadab0b0abba");

    });
    it("should coerce a OPAQUE buffer in a string ( without namespace ) ",function(){

        var nodeId = coerceNodeId("b=b1dedadab0b0abba");
        nodeId.identifierType.should.eql(NodeIdType.BYTESTRING);
        nodeId.toString().should.eql("ns=0;b=b1dedadab0b0abba");
        nodeId.value.toString("hex").should.eql("b1dedadab0b0abba");

    });
    it("should coerce a GUID node id (without namespace)",function(){

        var nodeId = coerceNodeId("g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.identifierType.should.eql(NodeIdType.GUID);
        nodeId.toString().should.eql("ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.value.should.eql("1E14849E-3744-470d-8C7B-5F9110C2FA32");
    });
    it("should coerce a GUID node id (with namespace)",function(){

        var nodeId = coerceNodeId("ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.identifierType.should.eql(NodeIdType.GUID);
        nodeId.toString().should.eql("ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32");
        nodeId.value.should.eql("1E14849E-3744-470d-8C7B-5F9110C2FA32");
    });

    it("should not coerce a malformed string to a nodeid",function() {

        var nodeId;

        (function() {
            nodeId = coerceNodeId("ThisIsNotANodeId");
        }).should.throw();

        (function() {
            nodeId = coerceNodeId("HierarchicalReferences");
        }).should.throw();

        (function() {
            nodeId = coerceNodeId("ns=0;s=HierarchicalReferences");
            assert(nodeId !== null);
        }).should.not.throw();

    });

    it("should detect empty NodeIds",function(){

        var empty_nodeId = makeNodeId(0,0);
        empty_nodeId.isEmpty().should.be.eql(true);

        var empty_nodeId = makeNodeId(1,0);
        empty_nodeId.isEmpty().should.be.eql(false);

    });

    it("should convert an empty NodeId to  <empty nodeid> string",function() {
        var empty_nodeId = makeNodeId(0,0);
        empty_nodeId.toString().should.eql("ns=0;i=0");
    });

});

describe("Type coercion at construction time",function(){

    var bs = require("./../../lib/services/read_service");
    it( "should coerce a nodeId at construction ",function(){
        var readValue = new bs.ReadValueId({ nodeId : "i=2255", attributeId: 13 });
        readValue.nodeId.should.eql(makeNodeId(2255));
    });

});


describe("testing resolveNodeId",function(){

    // some objects
    it("should resolve RootFolder to 'ns=0;i=84' ",function(){
        var ref_nodeId = new NodeId(NodeIdType.NUMERIC,84,0);
        resolveNodeId("RootFolder").should.eql(ref_nodeId);
        resolveNodeId("RootFolder").toString().should.equal("ns=0;i=84");
    });

    it("should resolve ObjectsFolder to 'ns=0;i=85' ",function(){
        var ref_nodeId = new NodeId(NodeIdType.NUMERIC,85,0);
        resolveNodeId("ObjectsFolder").should.eql(ref_nodeId);
        resolveNodeId("ObjectsFolder").toString().should.equal("ns=0;i=85");
    });

    // Variable
    it("should resolve ServerType_NamespaceArray to 'ns=0;i=2006' ",function(){
        resolveNodeId("ServerType_NamespaceArray").toString().should.equal("ns=0;i=2006");
    });

    // ObjectType
    it("should resolve FolderType to 'ns=0;i=61' ",function(){
        resolveNodeId("FolderType").toString().should.equal("ns=0;i=61");
    });

    // VariableType
    it("should resolve AnalogItemType to 'ns=0;i=2368' ",function(){
        resolveNodeId("AnalogItemType").toString().should.equal("ns=0;i=2368");
    });

    //ReferenceType
    it("should resolve HierarchicalReferences to 'ns=0;i=33' ",function(){
        resolveNodeId("HierarchicalReferences").toString().should.equal("ns=0;i=33");
    });
});

describe("testing NodeId coercing bug ",function(){


    it("should handle strange string nodeId ",function(){

        // coerceNodeId("ns=S7:;s=S7_Connection_1.db1.0,x0").should.eql(makeNodeId(1234,2));
        coerceNodeId("ns=2;s=S7_Connection_1.db1.0,x0").should.eql(makeNodeId("S7_Connection_1.db1.0,x0",2));

    });

});


describe("testing NodeId.displayText",function(){

    it("should provide a richer display text when nodeid is known",function(){
        var ref_nodeId = new NodeId(NodeIdType.NUMERIC,85,0);
        ref_nodeId.displayText().should.equal("ObjectsFolder (ns=0;i=85)");
    });

});




