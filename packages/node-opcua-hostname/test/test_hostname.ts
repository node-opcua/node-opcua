import os from "node:os";
import should from "should";
import { extractFullyQualifiedDomainName, getFullyQualifiedDomainName, resolveFullyQualifiedDomainName } from "../dist/index.js";

describe("hostname", () => {
    it("should replace %FQDN% with fqdn (resolveFullyQualifiedDomainName)", async () => {
        // we need at least one async operation to make sure that the fqdn package
        // has completed the fqdn extraction
        await new Promise((resolve) => setTimeout(resolve, 10));

        resolveFullyQualifiedDomainName("Hello%FQDN%").should.not.match(/%FQDN%/);
    });
    it("asks the system for the hostname only when the string holds {hostname}", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const hostname = os.hostname;
        let calls = 0;
        os.hostname = () => {
            calls++;
            return hostname();
        };
        try {
            should(resolveFullyQualifiedDomainName("opc.tcp://localhost:4840")).eql("opc.tcp://localhost:4840");
            should(calls).eql(0);
            should(resolveFullyQualifiedDomainName("opc.tcp://{hostname}:4840")).eql(`opc.tcp://${hostname()}:4840`);
            should(calls).eql(1);
        } finally {
            os.hostname = hostname;
        }
    });
    it("It should retrieve the fully qualified domain name", () => {
        const fqdn = getFullyQualifiedDomainName();
        fqdn.should.not.eql("%FQDN%");
        console.log("fqdn =", fqdn);
    });
    it("It should retrieve the fully qualified domain name", async () => {
        const fqdn = await extractFullyQualifiedDomainName();
        console.log("fqdn =", fqdn);
    });
    it("fqdn should not contains .localdomain at the end if computer doesn't belong to a domain", async () => {
        const fqdn = await extractFullyQualifiedDomainName();
        fqdn.should.not.match(/\.localdomain$/);
    });
});
