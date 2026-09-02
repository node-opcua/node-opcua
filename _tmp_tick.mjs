/**
 * Tick acceptance criteria on the ESM board.
 *   node _tmp_tick.mjs "FEAT-7" AC-7.1.1 AC-7.1.2 ...
 * Ticks only lines whose AC id matches exactly; reports anything it could not find.
 */
import { execFileSync } from "node:child_process";
const gh = (a) => execFileSync("gh", a, { encoding: "utf8", maxBuffer: 1 << 26 });

const [titlePrefix, ...acs] = process.argv.slice(2);
if (!titlePrefix || !acs.length) {
    console.error('usage: node _tmp_tick.mjs "FEAT-7" AC-7.1.1 [AC-...]');
    process.exit(2);
}

const q = `query { organization(login: "node-opcua") { projectV2(number: 2) {
  items(first: 60) { nodes { id content { ... on DraftIssue { id title body } } } } } } }`;
const nodes = JSON.parse(gh(["api", "graphql", "-f", `query=${q}`])).data.organization.projectV2.items.nodes;
const item = nodes.find((n) => n.content?.title?.startsWith(titlePrefix));
if (!item) {
    console.error(`no board item starting with ${titlePrefix}`);
    process.exit(1);
}

const wanted = new Set(acs);
const seen = new Set();
const lines = item.content.body.split("\n").map((line) => {
    if (!line.includes("- [ ]")) return line;
    for (const ac of wanted) {
        // the id appears as **AC-7.1.1**; require the bold form so AC-7.1.1 never matches AC-7.1.10
        if (line.includes(`**${ac}**`)) {
            seen.add(ac);
            return line.replace("- [ ]", "- [x]");
        }
    }
    return line;
});

const missing = [...wanted].filter((a) => !seen.has(a));
if (missing.length) console.error(`WARNING not found or already ticked: ${missing.join(", ")}`);

const m = `mutation($id:ID!,$body:String!){ updateProjectV2DraftIssue(input:{draftIssueId:$id, body:$body}){ draftIssue { id } } }`;
gh(["api", "graphql", "-f", `query=${m}`, "-f", `id=${item.content.id}`, "-f", `body=${lines.join("\n")}`]);
console.log(`${item.content.title}: ticked ${seen.size} (${[...seen].join(", ")})`);
