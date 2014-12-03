"use strict";

var assert = require('assert');
var debug = require('debug')('CACL');
var request = require('superagent');
var status = require('http-status');
var Enum = require('enum');

// General config namespace that is copied from ACL config later.
var CACL_CONFIG = CACL_CONFIG || {};

/**
 * Creates an instance of ACL.
 *
 * Examples:
 *   var acl = new graphACL(config);
 *
 * @constructor
 * @this {ACL}
 * @param config - A config to a graph database of your choice
 */
var ACL = function (config) {
  CACL_CONFIG = this.config = config;
};

/**
 * My first real ES6 class, so you might want to stand back, unless you want to lose an eye.
 */
class QueryTemplate {

  constructor(cb, query, params = {}, name = "_") {
    this.query = query;
    this.params = params;
    this.name = name;
    this.cb = cb;
  }

  payload() {
    var p = JSON.stringify({
      query: this.query,
      params: this.params
    });
    this.msg("sending payload: " + p);
    return p;
  }

  msg(s) {
    debug("[" + this.name + "]: " + s);
  }

  go() {
    return this.marshal();
  }

  marshal() {
    let url = CACL_CONFIG.neo4j.root_url + CACL_CONFIG.neo4j.path;

    let cb = (err, res)=> {
      this.unmarshal(err, res);
    };

    return request.post(url)
      .send(this.payload())
      .set("Accept", "application/json; charset=UTF-8")
      .set("Content-Type", "application/json")
      .end(cb);
  }

  unmarshal(err, res) {
    //this.msg("calling client.");
    if (err) {
      return this.handle(err);
    }
    if (res.statusCode !== status.OK) {
      this.msg("warning: bad response code: " + res.statusCode);
    }

    //this.msg("NEO response:" + res.text);
    var obj = JSON.parse(res.text);
    //this.msg("NEO JSON:" + obj);
    this.handle(null, obj);
  }

  /**
   * Clients should probably override this to unpack results.
   * @param err
   * @param res
   */
  handle(err, res = {}) {
    //this.msg("calling client.");
    this.cb(err, res);
  }
}


/**
 * Create a query and submit it.  You must pass in valid Cypher, params, and a callback.
 *
 * @param query The query, in Cypher.
 * @param params a map of parameters for the query
 * @param cb will be called with the response that must be unpacked by the caller.
 * @returns {Request}
 */
ACL.prototype.cypher = function (query, params, cb, name = "_") {
  return new QueryTemplate(cb, query, params, name).go();
};


ACL.prototype.count_all_nodes = (cb) => {
  this.cypher('MATCH (n) RETURN count(n) as count;', {}, function (err, res) {
    cb(null, res.data[0][0]);
  }, "COUNT_ALL");
};


/**
 * A utility method that we use to clear the database before running tests.
 *
 * @param cb
 */
ACL.prototype.warning_delete_all_nodes_and_edges = function (cb) {

  let qt = new QueryTemplate(cb, 'MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r return count(n) as count', {}, "DELETE_ALL");
  qt.handle = function (err, res) {
    var count;
    try {
      count = res.data[0][0];
    } catch (e) {
    }
    this.msg("Deleted node count: " + count);
    if (!count) {
      cb("no count returned", null);
    }
    {
      cb(null, count);
    }
  };

  qt.go();
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

  var cb2 = function (err, res) {
    this.msg("db response: " + JSON.stringify(res));

    var rval = {success: false};

    try {
      rval = {
        success: true,
        uid: uid,
        user_node_id: res.data[0][0],
        group_node_id: res.data[0][1]
      };
    } catch (e) {
      // nop
    }
    this.msg("Unpacked: " + JSON.stringify(rval));

    cb(null, rval);
  };
  this.cypher('create (u:User { uid: {uid} }), (g:Group {name: "/"}), (u)-[:OWNS]->(g) return id(u) as uid, id(g) as gid', {uid: uid}, cb2, "CREATE_USER");
};

/**
 * Get a User and their top level Groups.
 * @param uid a user id
 * @param cb
 */
ACL.prototype.get_user = function (uid, cb) {
  this.cypher('match (u:User {uid: {uid}}) optional match (g:Group), (u)-[:OWNS]-(g) return u.uid as uid', {uid: uid}, function (err, res) {
    if (err) {
      return cb(err);
    }
    debug("get_user returned: " + JSON.stringify(res));

    var rval = {uid: false};
    try {
      var uid = res.data[0][0];
      rval = {uid: uid};
    } catch (Exception) {
      // NOP
    }
    debug("get_user unpacked object: " + JSON.stringify(rval));

    cb(null, rval);
  });
};

/**
 * Create a Group.  Groups can be used to aggregate sets of Assets and User Relationships.
 * @param uid the UID of a User node in Neo.
 * @param name the name of the group to create.
 * @param cb
 */
ACL.prototype.create_group = function (uid, name, cb) {
  this.cypher('match (u:User {uid: {uid} }) merge (g:Group {name: {name}}) merge (u)-[:OWNS]->(g) return id(g) as gid', {name: name}, function (err, res) {
    if (err) {
      return cb(err);
    }
    debug("CREATING group returned: " + JSON.stringify(res));

    var nodeid = res.data[0];
    cb(null, nodeid);
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
  this.cypher('match (u:User {uid: {uid}}), (g:Group {name: {name}}), (u)-[:OWNS]->(g) merge (a:Asset {aid: {aid}}) merge (g)-[:OWNS]->(a) return id(a) as aid, id(g) as gid', {
      uid: uid,
      aid: aid,
      name: group_name
    }, function (err, res) {
      if (err) {
        return cb(err);
      }
      var rval = {
        success: false
      };

      try {
        rval = {
          success: true,
          aid: aid,
          uid: uid,
          group_name: group_name,
          asset_node_id: res.data[0][0],
          group_node_id: res.data[0][1]
        };
      } catch (Exception) {
        console.log(Exception);
        // NOP
      }

      debug("CREATING Asset returned: " + res);

      cb(null, rval);
    }
  )
  ;
}
;

ACL.prototype.create_grant = function (uid, name, cb) {
  this.cypher('match (u:User {uid: {uid}}) merge (g:Group {name: {name}}) merge (u)-[:OWNS]->(g) return id(g) as gid', {name: name}, function (err, res) {
    if (err) {
      return cb(err);
    }
    debug("CREATING group returned: " + JSON.stringify(res));

    var nodeid = res.data[0];
    cb(null, nodeid);
  });
};


ACL.prototype.put_asset_in_group = function (uid, aid, name, cb) {
  this.cypher('match (u:User {uid: {uid} }) create (g:Group {name: {name}})', {name: name}, function (err, res) {
    if (err) {
      return cb(err);
    }
    debug("CREATING group returned: " + JSON.stringify(res));

    var nodeid = res.data[0];
    cb(null, nodeid);
  });
};

ACL.prototype.delete_user = function (uid, cb) {
  this.cypher('match (u:User {uid: {uid} }) optional match (u)-[r:OWNS]->(x) delete r,u return id(u) as unid, id(x) as xnid', {uid: uid}, function (err, res) {
    if (err) {
      return cb(err);
    }
    debug("DELETE user returned: " + res);

    var rval = {
      success: false
    };

    try {
      rval = {
        success: true,
        uid: uid,
        user_node_id: res.data[0][0],
        x_node_id: res.data[0][1]
      };
      debug("delete_user: orphaning object id: " + rval.x_node_id);
    } catch (Exception) {
      console.log(Exception);
      // NOP
    }
    cb(null, rval);
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
ACL.prototype._create_conn_node = function (uid1, uid2, key, cb) {
  this.cypher(
    'match (u1:User {uid: {uid1}}), (u2:User {uid: {uid2}}), (c:Connection {key:{key}}) ' +
    'create unique (u1)-[:CONN]->(c)<-[:CONN]-(u2)  return u1,u2,c', {
      uid1: uid1,
      uid2: uid2,
      key: key
    }, function (err, res) {
      if (err) {
        return cb(err);
      }
      debug("CREATING Connection returned: " + res);
      var conn = res.data[0];
      cb(null, conn);
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

  var query = 'merge (c:Connection {key: {key}}) on create set c.note={note},c.createdAt=timestamp(),c.state={state} return id(c) as cnid';
  var params = {
    key: key,
    note: note,
    state: CONN_STATES.initial
  };

  class QT extends QueryTemplate {
    handle(err, res) {
      var rval = {success: false};
      try {
        rval = {
          success: true,
          cnid: res.data[0][0]
        };
      } catch (e) {
      }
      assert.ok(rval.cnid, "must have good cnid");
      self._create_conn_node(uid1, uid2, key, cb);
    }
  }
  new QT(cb, query, params, "CREATE_CONN").go();
};


ACL.prototype.update_connection = function (uid1, uid2, confirm_bool, note, cb) {
  var key = gen_conn_key(uid1, uid2);

  var state = CONN_STATES.rejected;
  if (confirm_bool) {
    state = CONN_STATES.confirmed;
  }

  var query = "match (c:Connection {key: {key}}) where (c.state='initial') set c.state={state} return id(c) as cnid";
  var params = {
    key: key,
    state: state
  };

  class QT extends QueryTemplate {
    handle(err, res) {
      var rval = {success: false};
      debug("Updating Connection returned: " + res);

      try {
        rval = {
          success: true,
          cnid: res.data[0][0]
        };
      } catch (e) {
      }
      this.cb(null, rval);
    }
  }
  new QT(cb, query, params, "UPDATE_CONN").go();
};

ACL.prototype.terminate_connection = function (uid1, uid2, note, cb) {
  var key = gen_conn_key(uid1, uid2);

  var query = "match (c:Connection {key: {key}}) where (c.state='initial') set c.state={state} return id(c) as cnid, c.data";
  var params = {key: key, state: CONN_STATES.terminated};

  class QT extends QueryTemplate {
    handle(err, res) {
      var rval = {success: false};
      debug("Updating Connection returned: " + res);

      try {
        rval = {
          success: true,
          cnid: res.data[0][0],
          cdata: res.data[0][1]
        };
      } catch (e) {
      }
      this.cb(null, rval);
    }
  }
  new QT(cb, query, params, "TERM_CONN").go();
};

ACL.prototype.list_connections = function (uid, cb) {
  var query = "match (u:User {uid: {uid}})-[:CONN]->(c:Connection)<-[:CONN]-(u2:User) return c as cdata, u2";
  var params = {uid: uid, state: CONN_STATES.terminated};

  class QT extends QueryTemplate {
    handle(err, res) {
      var rval = {success: false};
      try {
        rval = {
          success: true,
          cdata: [for (x of res.data) x[0].data],
          u2data: [for (x of res.data) x[1].data]
        };
      } catch (e) {
        this.msg("EX: " + e);
      }
      this.cb(null, rval);
    }
  }
  new QT(cb, query, params, "LIST_CONN").go();
};

module.exports = ACL;
