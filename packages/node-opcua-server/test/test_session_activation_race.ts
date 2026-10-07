import { OPCUAClient } from "node-opcua-client";
import { nodesets } from "node-opcua-nodesets";
import type { ServerSecureChannelLayer } from "node-opcua-secure-channel";
import type { StatusCode } from "node-opcua-status-code";
import type { UserIdentityToken } from "node-opcua-types";
import should from "should";
import { OPCUAServer, type ServerSession } from "../dist/index.js";

const port = 5834;

/** a server whose first user check waits until the test lets it go, the others answering at once */
class SlowFirstActivation extends OPCUAServer {
    public held: (() => void) | null = null;
    public firstCheckStarted: Promise<void>;
    #started: () => void = () => undefined;
    #holding = true;

    constructor(options: ConstructorParameters<typeof OPCUAServer>[0]) {
        super(options);
        this.firstCheckStarted = new Promise<void>((resolve) => {
            this.#started = resolve;
        });
    }

    protected override isUserAuthorized(
        channel: ServerSecureChannelLayer,
        session: ServerSession,
        userIdentityToken: UserIdentityToken,
        callback: (err: Error | null, isAuthorized?: boolean, statusCode?: StatusCode) => void
    ): void {
        if (!this.#holding) {
            super.isUserAuthorized(channel, session, userIdentityToken, callback);
            return;
        }
        this.#holding = false;
        this.held = () => super.isUserAuthorized(channel, session, userIdentityToken, callback);
        this.#started();
    }
}

describe("ActivateSession of a Session closed while its user is checked", function () {
    this.timeout(60000);
    let server: SlowFirstActivation;
    const clients: OPCUAClient[] = [];

    before(async () => {
        server = new SlowFirstActivation({
            port,
            nodeset_filename: [nodesets.standard],
            serverCapabilities: { maxSessions: 1 }
        });
        await server.initialize();
        await server.start();
    });
    after(async () => {
        for (const client of clients) await client.disconnect();
        await server.shutdown();
    });

    async function connect(): Promise<OPCUAClient> {
        const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await client.connect(server.getEndpointUrl());
        clients.push(client);
        return client;
    }

    it("refuses the activation: the server, full, gave the slot to the next client", async () => {
        const first = await connect();
        const second = await connect();
        // the first Session is created; its activation waits in the user check
        const firstSession = first.createSession();
        await server.firstCheckStarted;
        // the server is full: the second CreateSession closes the first Session, not activated yet
        const secondSession = await second.createSession();
        // the first activation resumes on a closed Session
        server.held?.();
        await should(firstSession).be.rejectedWith(/BadSessionClosed/);
        should(server.engine.currentSessionCount).eql(1);
        await secondSession.close();
    });
});
