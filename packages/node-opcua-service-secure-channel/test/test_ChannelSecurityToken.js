const service = require("..");
require("should");
const { ChannelSecurityToken, hasTokenExpired } = require("..");

describe("SecureChannel Service - ChannelSecurityToken", function () {
    it("should instantiate a ChannelSecurityToken and have a valid default revisedLifetime", function () {
        const channelSecurityToken = new service.ChannelSecurityToken({});
        channelSecurityToken.revisedLifetime.should.eql(30000);
    });

    it("should ChannelSecurityToken have a valid createdAt date ", function () {
        const now = Date.now();
        const channelSecurityToken = new service.ChannelSecurityToken({});
        channelSecurityToken.revisedLifetime.should.eql(30000);
        channelSecurityToken.createdAt.getTime().should.be.aboveOrEqual(now);
    });

    it("testing hasTokenExpired", function () {
        const channelSecurityToken = new ChannelSecurityToken({});

        channelSecurityToken.revisedLifetime.should.equal(30000);
        channelSecurityToken.createdAt.getTime().should.be.lessThan(new Date().getTime() + 1);
        hasTokenExpired(channelSecurityToken).should.equal(false);
    });
    it("a ChannelSecurityToken should expired after the revisedLifetime", function (done) {
        const channelSecurityToken = new ChannelSecurityToken({
            revisedLifetime: 50
        });
        hasTokenExpired(channelSecurityToken).should.equal(false);
        setTimeout(function () {
            hasTokenExpired(channelSecurityToken).should.equal(true);
            done();
        }, 100);
    });
});
