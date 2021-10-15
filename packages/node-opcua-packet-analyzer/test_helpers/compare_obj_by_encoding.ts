import { BinaryStream } from "node-opcua-binary-stream";
import { BaseUAObject } from "node-opcua-factory";
import * as should from "should";
const persist = should;

export function compare_obj_by_encoding(obj1: BaseUAObject, obj2: BaseUAObject): boolean {
    function encoded(obj: BaseUAObject) {
        const stream = new BinaryStream(obj.binaryStoreSize());
        obj.encode(stream);
        return stream.buffer.toString("hex");
    }
    encoded(obj1).should.eql(encoded(obj2));
    return true;
}
