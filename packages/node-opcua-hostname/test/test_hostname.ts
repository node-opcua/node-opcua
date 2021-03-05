import {
    extractFullyQualifiedDomainName,
    getFullyQualifiedDomainName,
    resolveFullyQualifiedDomainName
} from "..";
import * as should  from "should";

// tslint:disable:no-console
describe("hostname", () => {

    it("should replace %FQDN% with fqdn (resolveFullyQualifiedDomainName)", async () => {

        // we need at least one async operation to make sure that the fqdn package
        // has completed the fqdn extraction
        await new Promise((resolve) => setTimeout(resolve, 10));

        resolveFullyQualifiedDomainName("Hello%FQDN%").should.not.match(/%FQDN%/);
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
