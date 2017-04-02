/**
 *
 * @param options
 * @constructor
 */
function SessionContext(options) {
    options = options || {};
    this.session = options.session;
    this.object = options.object;
    this.server = options.server;
}
exports.SessionContext = SessionContext;
SessionContext.defaultContext = new SessionContext();
