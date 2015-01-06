var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
var BinaryStream = require("../../lib/misc/binaryStream").BinaryStream;

var opcua = require("../../");
var BaseDataType = opcua.method_service.BaseDataType;
var DataType = opcua.DataType;

var redirectToFile = require("../../lib/misc/utils").redirectToFile;


describe("testing Method Service",function() {

    it("should create a BaseDataType (scalar)",function() {

        var obj = new BaseDataType({ dataType: DataType.UInt32, value:100 });
        obj.value.should.eql(100);

        var size = obj.binaryStoreSize();

        var stream  = new BinaryStream(size);
        obj.encode(stream);


        var obj_reloaded= new BaseDataType({ dataType: DataType.UInt32});
        stream.rewind();
        obj_reloaded.decode(stream);

        obj_reloaded.value.should.eql(100);

    });

    it("should create a BaseDataType (array)",function() {

        var obj = new BaseDataType({ dataType: DataType.UInt32, value:[100,200,300] });

        obj.isArray.should.eql(true);
        obj.value[0].should.eql(100);
        obj.value[1].should.eql(200);
        obj.value[2].should.eql(300);

        var size = obj.binaryStoreSize();

        var stream  = new BinaryStream(size);
        obj.encode(stream);


        var obj_reloaded= new BaseDataType({ dataType: DataType.UInt32,isArray:true});
        stream.rewind();
        obj_reloaded.decode(stream);

        obj_reloaded.value[0].should.eql(100);
        obj_reloaded.value[1].should.eql(200);
        obj_reloaded.value[2].should.eql(300);



    });
    it("should create a method call request",function(done){

        var callRequest = new opcua.method_service.CallRequest({

            methodsToCall: [{

                objectId: opcua.makeNodeId(100,0),
                methodId: opcua.makeNodeId(101,0),
                inputArguments: [
                    new BaseDataType({ dataType: DataType.UInt32, isArray:true, value:[100,10,20]})
                ]
            }]
        });

        var size = callRequest.binaryStoreSize();
        var stream  = new BinaryStream(size);
        callRequest.encode(stream);


        done();

    });
});

