module.exports = {

    UAProxyManager: require("./src/proxy").UAProxyManager,
    makeRefId: require("./src/proxy").makeRefId
};
require("./src/state_machine_proxy");
