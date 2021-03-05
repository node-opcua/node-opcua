const https = require("https");
function fixVersion(s) {
    return s.replace(/v\./,"").replace("v","");
}
async function getReleases() {
    return await new Promise((resolve, reject) => {
        const options = {
            hostname: "api.github.com",
            method: "GET",
            path: "/repos/node-opcua/node-opcua/releases?page=1&per_page=2",
            headers: {
                "Content-Type": "application/vnd.github.v3+json",
                "Content-Length": 0,
                "User-Agent": "Etienne"
            }
        };

        https
            .get(options, (resp) => {
                let data = "";

                // A chunk of data has been received.
                resp.on("data", (chunk) => {
                    data += chunk;
                    console.log(".");
                });

                // The whole response has been received. Print out the result.
                resp.on("end", () => {
                    const o = JSON.parse(data);
                    const t = o.map((a) => ({ tag_name: fixVersion(a.tag_name), body: a.body }));
                     console.log(o);
                    resolve(t);
                });
            })
            .on("error", (err) => {
                console.log("Error: " + err.message);
                reject(err);
            });
    });
}
const semver = require("semver");

async function main() {

    const a = await getReleases();
    let b = a.sort((v1,v2)=> -semver.compare(v1.tag_name,v2.tag_name))
    console.log(b.map((x)=>x.tag_name));
}

main();
