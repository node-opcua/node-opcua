
var AccessLevelFlag = require("../../lib/datamodel/access_level").AccessLevelFlag;
var makeAccessLevel = require("../../lib/datamodel/access_level").makeAccessLevel;
var should = require("should");
var factories = require("../../lib/misc/factories");
var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
var _ = require("underscore");

var ObjWithIntegerId_Schema = {

    id: factories.next_available_id(),
    name: "ObjWithIntegerId",
    fields: [
        { name: "title" ,        fieldType: "UAString" },
        {
            name: "requestHandle"  , fieldType: "IntegerId"
        }
    ]
};

var ObjWithIntegerId  = factories.registerObject(ObjWithIntegerId_Schema);


describe("Testing IntegerId",function() {

    it("should persist a IntegerId === 0",function(){

        var o = new ObjWithIntegerId({
            requestHandle: 0
        });
        o.requestHandle.should.eql(0);


        process.env.DEBUG= true;
        var obj_reloaded = encode_decode_round_trip_test(o);
        obj_reloaded.requestHandle.should.eql(0);

    });
    it("should persist a IntegerId != 0",function(){

        var o = new ObjWithIntegerId({
            requestHandle: 1
        });
        o.requestHandle.should.eql(1);


        var obj_reloaded = encode_decode_round_trip_test(o);

        obj_reloaded.requestHandle.should.eql(1);


    });
});