/**
 * End-to-end test for the `role-set-admin` CLI: spawn it as a real subprocess
 * against the sample server and verify it administers Roles/Users over OPC UA.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import "should";
import { type SampleServerHandle, startSampleServer } from "../bin/sample_server_with_role_set.js";

const execFileAsync = promisify(execFile);
// the shipped CLI now lives in its own package; drive its source via tsx
const CLI = path.join(__dirname, "..", "..", "node-opcua-role-set-admin", "source", "cli.ts");

describe("role-set-admin CLI (e2e against the sample server)", function () {
    this.timeout(120000);

    let handle: SampleServerHandle;
    let endpoint: string;

    before(async () => {
        handle = await startSampleServer({ port: 48559 });
        endpoint = handle.endpointUrl;
    });
    after(async () => {
        await handle?.shutdown();
    });

    /** Run the CLI as admin (via `node --import tsx`) and return stdout. */
    async function admin(...args: string[]): Promise<string> {
        const { stdout } = await execFileAsync(
            process.execPath,
            ["--import", "tsx", CLI, "-e", endpoint, "-u", "admin", "-p", "admin-pw1", ...args],
            { cwd: path.join(__dirname, ".."), timeout: 60000 }
        );
        return stdout;
    }

    it("list-roles shows the well-known Roles and their seeded identities", async () => {
        const out = await admin("list-roles");
        out.should.match(/SecurityAdmin/);
        out.should.match(/Operator/);
        // admin is seeded into SecurityAdmin -> appears in the identities column
        out.should.match(/SecurityAdmin.*identities:.*admin/s);
    });

    it("add-identity then list-roles reflects the new mapping", async () => {
        (await admin("add-identity", "Operator", "joe")).should.match(/✓ AddIdentity joe -> Operator: Good/);
        (await admin("show-role", "Operator")).should.match(/joe/);
    });

    it("add-user grants a Role, list-users shows it, remove-user cleans up", async () => {
        const added = await admin("add-user", "alice", "Alice-pw1", "-r", "Operator");
        added.should.match(/✓ AddUser 'alice': Good/);
        added.should.match(/identity alice -> Operator: Good/);

        (await admin("list-users")).should.match(/alice/);
        (await admin("remove-user", "alice")).should.match(/✓ RemoveUser 'alice': Good/);
    });
});
