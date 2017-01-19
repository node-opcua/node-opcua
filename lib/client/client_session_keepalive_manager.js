import assert from "better-assert";
import {EventEmitter} from "events";
import util from "util";
import {coerceNodeId} from "lib/datamodel/nodeid";
import {VariableIds} from "lib/opcua_node_ids";

const serverStatus_State_Id = coerceNodeId(VariableIds.Server_ServerStatus_State);
import {ServerState} from "schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServerState_enum";
import {StatusCodes} from "lib/datamodel/opcua_status_code";


class ClientSessionKeepAliveManager extends EventEmitter {
  constructor(session) {
    super()
    const self = this;
    self.session = session;
    self.timerId = 0;
  }

  /**
   * @method ping_server
   *
   * when a session is opened on a server, the client shall send request on a regular basis otherwise the server
   * session object might time out.
   * start_ping make sure that ping_server is called on a regular basis to prevent session to timeout.
   *
   * @param callback
   */
  ping_server(callback) {
    const self = this;
    callback = callback || (() => { });
    const the_session = this.session;
    if (!the_session) {
      return callback();
    }

    const now = Date.now();

    const timeSinceLastServerContact = now - the_session.lastResponseReceivedTime;
    if (timeSinceLastServerContact < self.pingTimeout) {
          // no need to send a ping yet
          // xx console.log("Skipping ",timeSinceLastServerContact,self.session.timeout);
      return callback();
    }
      // xx console.log("readVariableValue ",timeSinceLastServerContact,self.session.timeout);

    const nodes = [serverStatus_State_Id]; // Server_ServerStatus_State
    the_session.readVariableValue(nodes, (err, dataValues) => {
      if (err) {
        console.log(" warning : ClientSessionKeepAliveManager#ping_server ".cyan, err.message.yellow);
        self.stop();

              /**
               * @event failure
               * raised when the server is not responding or is responding with en error to
               * the keep alive read Variable value transaction
               */
        self.emit("failure");
      } else {
        if (dataValues[0].statusCode === StatusCodes.Good) {
          const newState = ServerState.get(dataValues[0].value.value);
                  // istanbul ignore next
          if (newState !== self.lastKnownState) {
                      // console.log(" Server State = ", newState.toString());
          }
          self.lastKnownState = newState;
        }

        self.emit("keepalive",self.lastKnownState);
      }
      callback();
    });
  }

  start() {
    const self = this;
    assert(!self.timerId);
    assert(self.session.timeout > 100);

    self.pingTimeout   =  self.session.timeout * 2 / 3;
    self.checkInterval =  self.pingTimeout  / 3;
    self.timerId = setInterval(self.ping_server.bind(self),self.checkInterval);
  }

  stop() {
    const self = this;
    if (self.timerId) {
      clearInterval(self.timerId);
      self.timerId = 0;
    }
  }
}

export {ClientSessionKeepAliveManager};
