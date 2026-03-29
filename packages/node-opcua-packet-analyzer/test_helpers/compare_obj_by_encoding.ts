import { BinaryStream } from "node-opcua-binary-stream";
import type { IBaseUAObject } from "node-opcua-factory";
import should from "should";

const _should = should; // keep should side-effect import alive

export function compare_obj_by_encoding(obj1: IBaseUAObject, obj2: IBaseUAObject): boolean {
    function encoded(obj: IBaseUAObject): string {
        const stream = new BinaryStream(obj.binaryStoreSize());
        obj.encode(stream);
        return stream.buffer.toString("hex");
    }
    encoded(obj1).should.eql(encoded(obj2));
    return true;
}
