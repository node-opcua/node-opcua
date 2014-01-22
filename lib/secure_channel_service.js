// A SecureChannel is a long-running logical connection between a single Client and a single Server.
// This channel maintains a set of keys known only to the Client and Server, which are used to
// authenticate and encrypt Messages sent across the network. The SecureChannel Services allow
// the Client and Server to securely negotiate the keys to use.


function SecureChannel()
{

}

exports.SecureChannel = SecureChannel();
