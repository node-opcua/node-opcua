import { BaseUAObject, type IStructuredTypeSchema } from "node-opcua-factory";
import { RequestHeader } from "node-opcua-service-secure-channel";
export declare class ServerSideUnimplementedRequest extends BaseUAObject {
    static schema: IStructuredTypeSchema;
    requestHeader: RequestHeader;
    constructor(_options: Record<string, never>);
    get schema(): IStructuredTypeSchema;
}
//# sourceMappingURL=unimplementedRequest.d.ts.map