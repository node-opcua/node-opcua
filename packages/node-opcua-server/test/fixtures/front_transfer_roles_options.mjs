// the server options of a front thread in test_front_transfer_item_context.ts: one user, "operator",
// whose sessions have the Operator Role only when the client is named "HIGH". It stands for an
// identity mapping (OPC 10000-18) that gives one user other Roles in another session.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SessionContext } from "node-opcua-address-space";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { resolveNodeId } from "node-opcua-nodeid";

const OPERATOR = resolveNodeId("ns=0;i=15680");

function rolesBySessionName() {
    const proto = SessionContext.prototype;
    if (proto.__rolesBySessionName) return;
    const original = proto.getCurrentUserRoles;
    proto.getCurrentUserRoles = function () {
        const roles = original.call(this);
        return this.session?.sessionName?.startsWith("HIGH") ? [...roles, OPERATOR] : roles;
    };
    proto.__rolesBySessionName = true;
}

export default async function frontServerOptions(data, { front, sessionWorker }) {
    rolesBySessionName();
    const thread = sessionWorker === undefined ? `${front}` : `sw${sessionWorker}`;
    const rootFolder = path.join(os.tmpdir(), "node-opcua-tmp", `front-transfer-${data.port}-${thread}`);
    fs.mkdirSync(rootFolder, { recursive: true });
    const serverCertificateManager = new OPCUACertificateManager({ automaticallyAcceptUnknownCertificate: true, rootFolder });
    await serverCertificateManager.initialize();
    return {
        port: data.port,
        serverCertificateManager,
        allowAnonymous: false,
        serverCapabilities: { minSupportedSampleRate: 0 },
        userManager: {
            isValidUser: (userName, password) => userName === "operator" && password === "operator-pw",
            getUserRoles: () => []
        }
    };
}
