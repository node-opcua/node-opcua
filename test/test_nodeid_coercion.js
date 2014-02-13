
var coerceNodeId = require("../lib/nodeid").coerceNodeId;
var makeNodeId = require("../lib/nodeid").makeNodeId;

var should = require("should");
var bs = require("./../lib/read_service");

describe("CoerceNodeId",function(){

    it("should coerce a string of a form 'i=1234'",function(){
       coerceNodeId("i=1234").should.eql(makeNodeId(1234));
    });
    it("should coerce a string of a form 'ns=2;i=1234'",function(){
        coerceNodeId("ns=2;i=1234").should.eql(makeNodeId(1234,2));
    });
    it("should coerce a integer",function(){
        coerceNodeId(1234).should.eql(makeNodeId(1234));
    });

});

describe("Type coercion at construction time",function(){

    it( "should coerce a nodeId at construction ",function(){
        var readValue = new bs.ReadValueId({ nodeId : "i=2255", attributeId: 13 });
        readValue.nodeId.should.eql(makeNodeId(2255));
    });

});