var BinaryStream = require("node-opcua-binary-stream").BinaryStream;


function compare_obj_by_encoding(obj1,obj2) {
    function encoded(obj) {
        var stream = new BinaryStream(obj.binaryStoreSize());
        obj.encode(stream);
        return stream._buffer.toString("hex");
    }
    encoded(obj1).should.eql(encoded(obj2));

}
exports.compare_obj_by_encoding =compare_obj_by_encoding;