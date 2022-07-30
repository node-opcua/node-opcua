/***
 * @module node-opcua-chunkmanager
 */
import { decodeUInt32, encodeUInt32, UInt32 } from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    initialize_field,
    parameters,
    IStructuredTypeSchema
} from "node-opcua-factory";

const schemaSequenceHeader: IStructuredTypeSchema = buildStructuredType({
    baseType: "BaseUAObject",
    fields: [
        // A monotonically increasing sequence number assigned by the sender to each
        // MessageChunk sent over the ClientSecureChannelLayer.
        { name: "sequenceNumber", fieldType: "UInt32" },
        // An identifier assigned by the client to OPC UA request Message. All MessageChunks for
        // the request and the associated response use the same identifier.
        { name: "requestId", fieldType: "UInt32" }
    ],
    name: "SequenceHeader"
});

export interface SequenceHeaderOptions {
    sequenceNumber?: UInt32;
    requestId?: UInt32;
}
export class SequenceHeader extends BaseUAObject {
    public static possibleFields: string[] = ["sequenceNumber", "requestId"];
    public static schema = schemaSequenceHeader;
    public sequenceNumber: UInt32;
    public requestId: UInt32;

    constructor(options?: SequenceHeaderOptions) {
        options = options || {};
        super();
        const schema = schemaSequenceHeader;
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            check_options_correctness_against_schema(this, schema, options);
        }
        this.sequenceNumber = initialize_field(schema.fields[0], options.sequenceNumber);
        this.requestId = initialize_field(schema.fields[1], options.requestId);
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeUInt32(this.sequenceNumber, stream);
        encodeUInt32(this.requestId, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        this.sequenceNumber = decodeUInt32(stream);
        this.requestId = decodeUInt32(stream);
    }
}

SequenceHeader.prototype.schema = SequenceHeader.schema;
