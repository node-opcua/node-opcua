import { type NodeIdLike, type OPCUAServer } from "node-opcua";
import { type ServerHandle } from "../../test_helpers/external_server_fixture.js";
/**
 * The context once beforeTest() has populated it.
 *
 * The fields are optional on UmbrellaTestContext because they genuinely are absent until
 * the before hook runs. Each u_test_* module, by contrast, declares only the fields its
 * suite needs and declares them required - which is also correct, because no it() body runs
 * before that hook. This names the boundary between the two once, instead of asserting it
 * at every one of the ~90 call sites.
 *
 * require() used to hide this: the module was `any`, so t(test) accepted anything.
 */
export type ReadyUmbrellaTestContext = UmbrellaTestContext & Required<Pick<UmbrellaTestContext, "endpointUrl" | "server" | "serverCertificate" | "temperatureVariableId">>;
export interface UmbrellaTestContext extends Mocha.Context {
    port: number | string | undefined;
    endpointUrl?: string;
    server?: OPCUAServer;
    serverCertificate?: Buffer;
    temperatureVariableId?: NodeIdLike | undefined;
    data?: ServerHandle;
    backgroundSessionCount?: number;
    backgroundSubscriptionCount?: number;
}
export declare function afterTest(test: UmbrellaTestContext): Promise<void>;
export declare function beforeTest(test: UmbrellaTestContext): Promise<void>;
export declare function beforeEachTest(test: UmbrellaTestContext): Promise<void>;
export declare function afterEachTest(test: UmbrellaTestContext): Promise<void>;
//# sourceMappingURL=_helper_umbrella.d.ts.map