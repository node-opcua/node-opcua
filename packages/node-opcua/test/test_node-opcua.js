var opcua = require("..");
var should = require("should");
describe("OPCUA",function(){

    it("should not export null properties",function() {
        
        Object.keys(opcua).forEach(function(x){
            should.exist(opcua[x],x+" should be defined");
        });
    });
});
