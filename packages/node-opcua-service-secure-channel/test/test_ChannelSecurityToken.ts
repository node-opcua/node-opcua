import should from "should";
import * as service from "../dist/index.js";
import { ChannelSecurityToken, hasTokenExpired } from "../dist/index.js";

describe("SecureChannel Service - ChannelSecurityToken", () => {
    it("should instantiate a ChannelSecurityToken and have a valid default revisedLifetime", () => {
        const channelSecurityToken = new service.ChannelSecurityToken({});
        channelSecurityToken.revisedLifetime.should.eql(30000);
    });

    it("should ChannelSecurityToken have a valid createdAt date ", () => {
        const now = Date.now();
        const channelSecurityToken = new service.ChannelSecurityToken({});
        channelSecurityToken.revisedLifetime.should.eql(30000);
        should(channelSecurityToken.createdAt?.getTime()).be.aboveOrEqual(now);
    });

    it("testing hasTokenExpired", () => {
        const channelSecurityToken = new ChannelSecurityToken({});

        channelSecurityToken.revisedLifetime.should.equal(30000);
        should(channelSecurityToken.createdAt?.getTime()).be.lessThan(Date.now() + 1);
        hasTokenExpired(channelSecurityToken).should.equal(false);
    });
    it("a ChannelSecurityToken should expired after the revisedLifetime", (done) => {
        const channelSecurityToken = new ChannelSecurityToken({
            revisedLifetime: 50
        });
        hasTokenExpired(channelSecurityToken).should.equal(false);
        setTimeout(() => {
            hasTokenExpired(channelSecurityToken).should.equal(true);
            done();
        }, 100);
    });
});
