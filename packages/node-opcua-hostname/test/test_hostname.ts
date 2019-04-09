import { get_fully_qualified_domain_name} from "..";
// tslint:disable:no-console
describe("hostname", () => {

    it("It should retrieve the fully qualified domain name", () => {

        const fqdn = get_fully_qualified_domain_name();
        console.log("fqdn =", fqdn);

    });
});
