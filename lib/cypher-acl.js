"use strict";

var assert = require('assert');
var debug = require('debug')('CACL');
var request = require('superagent');
var status = require('http-status');
var Enum = require('enum');
var QueryTemplate = require('./query-template');

/**
 * Creates an instance of Cypher ACL.
 *
 * Examples:
 *   var acl = new graphACL(config);
 *
 * @constructor
 * @this {ACL}
 * @param config - A config to a graph database of your choice
 */
var ACL = function (config) {
  this.config = config;
};

/**
 * Process a query.  You must pass in an object with the following fields:
 *
 * @param query The query, in Cypher.
 * @param params a map of parameters for the query
 * @param name used to enhance logging output.  keep it short, perhaps < 12 chars is best.
 * @param unpack a tightly focused function that unpacks an Object during unmarshaling
 * @param cb will be called with the response that must be unpacked by the caller.
 *
 * @param t your JS object
 * @returns {*}
 */
ACL.prototype.q = function (t) {
  t.config = this.config;
  return new QueryTemplate(t).go();
};

/**
 * Just count the nodes in the DB.
 * @param cb
 */
ACL.prototype.count_all_nodes = function (cb) {
  var query = 'MATCH (n) RETURN count(n) as count;';
  return this.q({
    query,
    params:{},
    name:"COUNT_ALL",
    cb: cb,
    unpack: function (res) {
      return {
        count: res.data[0][0]
      };
    }
  });
};


/**
 * A utility method that we use to clear the database before running tests.
 *
 * @param cb
 */
ACL.prototype.warning_delete_all_nodes_and_edges = function (cb) {

  let query = 'MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r return count(n) as count';
  return this.q({
    query,
    params:{},
    name:"DELETE_ALL",
    cb: cb,
    unpack: function (res) {
      return {
        count: res.data[0][0]
      };
    }
  });
};

/**
 * Create a user and return its Neo4J-node-id.  Note that the User is not currently populated with any interesting fields.
 * This is because the current usage model for this package is to complement existing MEAN stack implementations, where
 * MongoDB or some other backend handles Users and their metadata.
 *
 * @param uid Some UID provided by an external system.  The only constraint is that it should be indexable by Neo.
 * @param cb
 */
ACL.prototype.create_user = function (uid, cb) {

  var query = 'create (u:User { uid: {uid} }), (g:Group {name: "/"}), (u)-[:OWNS]->(g) return id(u) as unid, id(g) as gnid';
  var params = {uid: uid};
  var name = "CREATE_USER";

  return this.q({
    query: query,
    params: params,
    name: name,
    cb: cb,
    unpack: function (res) {
      return {
        uid: uid,
        user_node_id: res.data[0][0],
        group_node_id: res.data[0][1]
      };
    }
  });
};

/**
 * Get a User and their top level Groups.
 * @param uid a user id
 * @param cb
 */
ACL.prototype.get_user = function (uid, cb) {
  var query = 'match (u:User {uid: {uid}}) optional match (g:Group), (u)-[:OWNS]-(g) return u.uid as uid';
  var params = {uid: uid};
  return this.q({
    query: query,
    params: params,
    name: "GET_USER",
    cb: cb,
    unpack: function (res) {
      debug("unpacking user data");
      var rval = {
        uid: res.data[0][0]
      };
      debug("returning:" + JSON.stringify(rval));
      return rval;
    }
  });
};

/**
 * Create a Group.  Groups can be used to aggregate sets of Assets and User Relationships.
 * @param uid the UID of a User node in Neo.
 * @param name the name of the group to create.
 * @param cb
 */
ACL.prototype.create_group = function (uid, name, cb) {
  return this.q({
    query: 'match (u:User {uid: {uid} }) merge (g:Group {name: {name}}) merge (u)-[:OWNS]->(g) return id(g) as gid',
    params: {name: name},
    name: "CREATE_GROUP",
    cb: cb,
    unpack: function (res) {
      return {
        gnid: res.data[0][0]
      };
    }
  });
};

/**
 * Create an Asset.  Put the method in the specified group, which must belong to the specified User/uid.
 *
 * @param uid the UID of a User node in Neo.
 * @param aid an external id for an asset.
 * @param cb
 */
ACL.prototype.create_asset = function (uid, aid, group_name, cb) {
  if (group_name === undefined) {
    debug("Warning: no group name specified in call to add_asset, assuming root.");
    group_name = "/";
  }
  return this.q({
    query: 'match (u:User {uid: {uid}}), (g:Group {name: {name}}), (u)-[:OWNS]->(g) merge (a:Asset {aid: {aid}}) merge (g)-[:OWNS]->(a) return id(a) as aid, id(g) as gid',
    params: {
      uid: uid,
      aid: aid,
      name: group_name
    },
    name: "CREATE_ASSET",
    cb: cb,
    unpack: function (res) {
      return {
        aid: aid,
        uid: uid,
        group_name: group_name,
        asset_node_id: res.data[0][0],
        group_node_id: res.data[0][1]
      };
    }
  });
};

ACL.prototype.create_grant = function (uid, name, cb) {
  return this.q({
    query: 'match (u:User {uid: {uid}}) merge (g:Group {name: {name}}) merge (u)-[:OWNS]->(g) return id(g) as gid',
    params: {name: name},
    name: "CREATE_GRANT",
    cb: cb,
    unpack: function (res) {
      return {
        gnid: res.data[0][0]
      };
    }
  });
};


ACL.prototype.delete_user = function (uid, cb) {
  var query = 'match (u:User {uid: {uid} }) optional match (u)-[r:OWNS]->(x) delete r,u return id(u) as unid, id(x) as xnid';
  var params = {uid: uid};
  return this.q({
    query,
    params,
    name: "DELETE_USER",
    cb: cb,
    unpack: function (res) {
      return {
        user_node_id: res.data[0][0],
        x_node_id: res.data[0][1]
      };
    }
  });
};

var gen_conn_key = ACL.prototype.gen_conn_key = function (uid1, uid2) {
  return [uid1, uid2].sort().join(':');
};

/**
 * Created to escape callback hell.  Not intended for the public API
 *
 * @param uid1
 * @param uid2
 * @param key
 * @param cb
 * @private
 */
ACL.prototype.create_user_user_conn2 = function (uid1, uid2, key, cb) {
  var query = 'match (u1:User {uid: {uid1}}), (u2:User {uid: {uid2}}), (c:Connection {key:{key}}) create unique (u1)-[:CONN]->(c)<-[:CONN]-(u2)  return id(c) as cnid';

  var params = {
    uid1: uid1,
    uid2: uid2,
    key: key
  };

  return this.q({
    query,
    params,
    name: "CREATE_UU_CONN2",
    cb: cb,
    unpack: function (res) {
      return {
        cnid: res.data[0][0]
      };
    }
  });
};

var CONN_STATES = new Enum(['initial', 'confirmed', 'rejected', 'terminated']);

/**
 * When a User wishes to connect with another User, they send an invitation.  The invitation is essentially a
 * Connection object in an initial state.
 *
 * @param uid1 the uid of the initiator
 * @param uid2 the uid of the recipient of the invitation
 * @param note a possibly blank message saying hello, etc.
 * @param cb
 */
ACL.prototype.create_user_user_connection = function (uid1, uid2, note, cb) {
  var key = gen_conn_key(uid1, uid2);
  var self = this;

  var query = 'merge (c:Connection {key: {key}}) on create set c.inv_note={note},c.createdAt=timestamp(),c.state={state} return id(c) as cnid';
  var params = {
    key: key,
    note: note,
    state: CONN_STATES.initial
  };

  return this.q({
    query,
    params,
    name: "CREATE_UU_CONN",
    cb: function (err, res) {
      self.create_user_user_conn2(uid1, uid2, key, cb);
    }
  });
};

ACL.prototype.update_connection = function (uid1, uid2, confirm_bool, note, cb) {
  var key = gen_conn_key(uid1, uid2);

  var state = CONN_STATES.rejected;
  if (confirm_bool) {
    state = CONN_STATES.confirmed;
  }

  this.q({
    query: "match (c:Connection {key: {key}}) where (c.state={initial_state}) set c.state={state}, c.rsvp_note={note},c.rsvp_at=timestamp() return id(c) as cnid, c.rsvp_at",
    params: {
      key: key,
      note: note,
      initial_state: CONN_STATES.initial,
      state: state
    },
    name: "UPDATE_CONN",
    unpack: function (res) {
      return {
        cnid: res.data[0][0],
        rsvp_at: res.data[0][1]
      };
    },
    cb: cb
  });
};

ACL.prototype.terminate_connection = function (uid1, uid2, note, cb) {
  var key = gen_conn_key(uid1, uid2);

  // Apparently Cypher has no "in" operator that would make this a little more convenient.
  var ss = `(c.state='${CONN_STATES.initial}' or c.state='${CONN_STATES.confirmed}')`;

  var query = "match (c:Connection {key: {key}}) where " + ss +
    " set c.state={new_state},c.term_note={note},c.term_at=timestamp()" +
    " return c.state,c.term_note,c.term_at";
  var params = {
    key,
    //current_states: [CONN_STATES.initial, CONN_STATES.confirmed],
    new_state: CONN_STATES.terminated,
    note
  };

  return this.q({
    query: query,
    params: params,
    name: "TERM_CONN",
    unpack: function (res) {
      return {
        state: res.data[0][0],
        term_note: res.data[0][1],
        term_at: res.data[0][2]
      };
    },
    cb: cb
  });
};

ACL.prototype.list_connections = function (uid, cb) {
  var query = "match (u:User {uid: {uid}})-[:CONN]->(c:Connection)<-[:CONN]-(u2:User) return c as cdata, u2";
  var params = {uid: uid, state: CONN_STATES.terminated};

  return this.q({
    query,
    params,
    name: "LIST_CONNS",
    cb: cb,
    unpack: function (res) {
      return {
        cdata: [for (x of res.data) x[0].data],
        u2data: [for (x of res.data) x[1].data]
      };
    }
  });
};

module.exports = ACL;
