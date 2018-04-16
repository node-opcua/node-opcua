const async = require("async");
const assert = require("node-opcua-assert").assert;

const StatusCodes = require("node-opcua-status-code").StatusCodes;
const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);


//
// a new secure channel has be created, we need to reactivate the corresponding session,
// and reestablish the subscription and restart the publish engine.
//
//
// see OPC UA part 4 ( version 1.03 ) figure 34 page 106
// 6.5 Reestablishing subscription....
//
//
//
//                      +---------------------+
//                      | CreateSecureChannel |
//                      | CreateSession       |
//                      | ActivateSession     |
//                      +---------------------+
//                                |
//                                |
//                                v
//                      +---------------------+
//                      | CreateSubscription  |<-------------------------------------------------------------+
//                      +---------------------+                                                              |
//                                |                                                                         (1)
//                                |
//                                v
//                      +---------------------+
//     (2)------------->| StartPublishEngine  |
//                      +---------------------+
//                                |
//                                V
//                      +---------------------+
//             +------->| Monitor Connection  |
//             |        +---------------------+
//             |                    |
//             |                    v
//             |          Good    /   \
//             +-----------------/ SR? \______Broken_____+
//                               \     /                 |
//                                \   /                  |
//                                                       |
//                                                       v
//                                                 +---------------------+
//                                                 |                     |
//                                                 | CreateSecureChannel |<-----+
//                                                 |                     |      |
//                                                 +---------------------+      |
//                                                         |                    |
//                                                         v                    |
//                                                       /   \                  |
//                                                      / SR? \______Bad________+
//                                                      \     /
//                                                       \   /
//                                                         |
//                                                         |Good
//                                                         v
//                                                 +---------------------+
//                                                 |                     |
//                                                 | ActivateSession     |
//                                                 |                     |
//                                                 +---------------------+
//                                                         |
//                                                         v                    +-------------------+       +----------------------+
//                                                       /   \                  | CreateSession     |       |                      |
//                                                      / SR? \______Bad_______>| ActivateSession   |-----> | TransferSubscription |
//                                                      \     /                 |                   |       |                      |       (1)
//                                                       \   /                  +-------------------+       +----------------------+        ^
//                                                         | Good                                                      |                    |
//                                                         v   (for each subscription)                                   |                    |
//                                                 +--------------------+                                            /   \                  |
//                                                 |                    |                                     OK    / OK? \______Bad________+
//                                                 | RePublish          |<----------------------------------------- \     /
//                                             +-->|                    |                                            \   /
//                                             |   +--------------------+
//                                             |           |
//                                             |           v
//                                             | GOOD    /   \
//                                             +------  / SR? \______Bad SubscriptionInvalidId______>(1)
// (2)                                                  \     /
//  ^                                                    \   /
//  |                                                      |
//  |                                                      |
//  |                             BadMessageNotAvailable   |
//  +------------------------------------------------------+
//

function _ask_for_subscription_republish(session, callback) {

    debugLog("_ask_for_subscription_republish ".bgCyan.yellow.bold);
    //xx assert(session.getPublishEngine().nbPendingPublishRequests === 0, "at this time, publish request queue shall still be empty");
    session.getPublishEngine().republish(function (err) {
        debugLog("_ask_for_subscription_republish done ".bgCyan.bold.green, err ? err.message : "OKs");
        // xx assert(session.getPublishEngine().nbPendingPublishRequests === 0);
        session.resumePublishEngine();
        callback(err);
    });
}

function repair_client_session_by_recreating_a_new_session(client, session, callback) {

    if (session.hasBeenClosed()) {
        debugLog("Aborting reactivation of old session because user requested session to be closed".bgWhite.red);
        return callback(new Error("reconnection cancelled due to session termination"));
    }

    let new_session = null;

    const listenerCountBefore = session.listenerCount();

    async.series([
        function suspend_old_session_publish_engine(callback) {
            debugLog("    => suspend old session publish engine....".bgWhite.red);
            session.getPublishEngine().suspend(true);
            callback();
        },
        function create_new_session(callback) {

            debugLog("    => creating a new session ....".bgWhite.red);
            // create new session, based on old session,
            // so we can reuse subscriptions data
            client.__createSession_step2(session, function (err, _new_session) {
                debugLog("    => creating a new session (based on old session data).... Done".bgWhite.cyan);
                if (!err) {
                    new_session = _new_session;
                    assert(session === _new_session, "session should have been recycled");
                }
                callback(err);
            });
        },
        function activate_new_session(callback) {

            debugLog("    => activating a new session ....".bgWhite.red);

            client._activateSession(new_session, function (err) {
                debugLog("    =>  activating a new session .... Done".bgWhite.cyan);
                ///xx self._addSession(new_session);
                callback(err);
            });
        },
        function attempt_subscription_transfer(callback) {

            // get the old subscriptions id from the old session
            const subscriptionsIds = session.getPublishEngine().getSubscriptionIds();

            debugLog("  session subscriptionCount = ", new_session.getPublishEngine().subscriptionCount);
            if (subscriptionsIds.length === 0) {
                debugLog(" No subscriptions => skipping transfer subscriptions");
                return callback(); // no need to transfer subscriptions
            }
            debugLog("    => asking server to transfer subscriptions = [", subscriptionsIds.join(", "), "]");
            // Transfer subscriptions
            const subscriptionsToTransfer = {
                subscriptionIds: subscriptionsIds,
                sendInitialValues: false
            };

            assert(new_session.getPublishEngine().nbPendingPublishRequests === 0, "we should not be publishing here");
            new_session.transferSubscriptions(subscriptionsToTransfer, function (err, transferSubscriptionsResponse) {
                if (err) {
                    // when transfer subscription has failed, we have no other choice but
                    // recreate the subscriptions on the server side
                    return callback(err);
                }
                const results = transferSubscriptionsResponse.results;

                // istanbul ignore next
                if (doDebug) {
                    debugLog("    =>  transfer subscriptions  done".cyan, results.map(x => x.statusCode.toString()).join(" "));
                }


                const subscriptions_to_recreate = [];

                // some subscriptions may be marked as invalid on the server side ...
                // those one need to be recreated and repaired ....
                for (let i = 0; i < results.length; i++) {

                    const statusCode = results[i].statusCode;
                    if (statusCode === StatusCodes.BadSubscriptionIdInvalid) {
                        // repair subscription
                        debugLog("         WARNING SUBSCRIPTION  ".red, subscriptionsIds[i], " SHOULD BE RECREATED".red);
                        subscriptions_to_recreate.push(subscriptionsIds[i]);
                    } else {
                        const availableSequenceNumbers = results[i].availableSequenceNumbers;
                        debugLog("         SUBSCRIPTION ".green, subscriptionsIds[i], " CAN BE REPAIRED AND AVAILABLE ".green, availableSequenceNumbers);
                        // should be Good.
                    }
                }
                debugLog("  new session subscriptionCount = ", new_session.getPublishEngine().subscriptionCount);

                async.map(subscriptions_to_recreate,function recreate_subscription(subscriptionId,next){

                    const subscription = session.getPublishEngine().getSubscription(subscriptionId);
                    assert(subscription.constructor.name === "ClientSubscription");
                    debugLog("          => RECREATING SUBSCRIPTION  ".red, subscriptionId);
                    assert(subscription.session === new_session,"must have the session");

                    subscription.recreateSubscriptionAndMonitoredItem(function(err) {
                        if(err) {
                            console.log("_recreateSubscription failed !");
                        }
                        debugLog("          => RECREATING SUBSCRIPTION  AND MONITORED ITEM DONE ".cyan, subscriptionId);
                        next();
                    });

                },callback);

            });
        },
        function ask_for_subscription_republish(callback) {
            assert(new_session.getPublishEngine().nbPendingPublishRequests === 0, "we should not be publishing here");
            //      call Republish
            return _ask_for_subscription_republish(new_session, callback);
        },
        function start_publishing_as_normal(callback) {
            new_session.getPublishEngine().suspend(false);
            const listenerCountAfter = session.listenerCount();
            assert(new_session === session);
            debugLog("listenerCountBefore =",listenerCountBefore,"listenerCountAfter = ",listenerCountAfter );
          //  assert(listenerCountAfter >0 && listenerCountAfter === listenerCountBefore);
            callback();
        }
    ], callback);
}

function repair_client_session(client, session, callback) {

    const self = client;

    if (doDebug) {
        debugLog("TRYING TO REACTIVATE EXISTING SESSION ", session.sessionId.toString());
        debugLog("  SubscriptionIds :", session.getPublishEngine().getSubscriptionIds());
    }
    self._activateSession(session, function (err) {
        //
        // Note: current limitation :
        //  - The reconnection doesn't work yet, if connection break is caused by a server that crashes and restarts.
        //
        debugLog("ActivateSession : ", err ? err.message : " SUCCESS !!! ");
        if (err) {
            //  activate old session has failed => let's  recreate a new Channel and transfer the subscription
            return repair_client_session_by_recreating_a_new_session(client, session, callback);
        } else {
            // activate old session has succeeded => let's call Republish
            return _ask_for_subscription_republish(session, callback);
        }
    });
}

function repair_client_sessions(client, callback) {

    const self = client;
    debugLog(" Starting sessions reactivation".red.bgWhite);
    // repair session
    const sessions = self._sessions;
    async.map(sessions, function (session, next) {
        repair_client_session(client, session, next);
    }, function (err, results) {
        return callback(err);
    });
}
exports.repair_client_sessions = repair_client_sessions;
