var CACL = require("../index.js");
var debug = require('debug')('CACL-test');
var assert = require('assert');
var async = require('async');

var config = {
  neo4j: {
    root_url: process.env.NEO4J_ROOT_URL || process.env.GRAPHENEDB_URL || "http://localhost:7474",
    path: "/db/data/cypher"
  }
};
var cacl = new CACL(config);

describe('Recreate test database', function () {
  it('should count nodes before deleting', function (done) {
    cacl.cypher('MATCH (n) RETURN count(*) as count;', {}, function (err, res) {
      if (err) {
        debug("failed to count nodes");
        return;
      }
      debug("count returned: " + JSON.stringify(res));
      done();
    });
  });


  it('should clear the db', function (done) {
    cacl.warning_delete_all_nodes_and_edges(function (err, res) {
      if (err) {
        debug("fail to clear nodes");
        return;
      }
      debug("db cleared node count: " + res);
      done();
    });
  });

  it('should ensure that the db is clear', function (done) {
    cacl.cypher('MATCH (n) RETURN count(n) as count;', {}, function (err, res) {
      if (err) {
        debug("failed to count nodes");
        return;
      }
      debug("count returned: " + JSON.stringify(res));
      assert.equal(res.data[0][0], 0, "count has to be 0");
      done();
    });
  });
});

var uid = 77;

describe('Neo4J User/Group Ops', function () {
  it('should create a User', function (done) {
    cacl.create_user(uid, function (err, res) {
      if (err) {
        debug("problem creating user");
        return;
      }
      debug("DAO Ops CREATE returned nodeid: " + res);
      assert.notEqual(res, undefined, "response must include a single defined value (not undefined)");
      done();
    });
  });
  it('should verify that the User exists', function (done) {
    cacl.get_user(uid, function (err, res) {
      if (err) {
        debug("problem searching for user");
        return;
      }
      debug("get_user returned: " + res);
      assert.equal(res.uid, uid, "response must be equal to the uid");
      done();
    });
  });

  var aid = "909";
  it('should create an asset and associate it with the root group', function (done) {
    cacl.create_asset(uid, aid, "/", function (err, res) {
      if (err) {
        debug("problem creating an asset");
        return cb(err);
      }
      debug("create_asset returned: " + res);

      assert.equal(res.aid, aid);
      done();
    });
  });

  it('should delete User by uid', function (done) {
    cacl.delete_user(uid, function (err, res) {
      if (err) {
        debug("problem deleting user");
        return;
      }
      debug("DELETE returned: " + JSON.stringify(res));

      assert.equal(res.success, true, "res.success must be true");
      done();
    });
  });
  it('should verify that the User is gone', function (done) {
    cacl.get_user(uid, function (err, res) {
      if (err) {
        debug("problem searching for user");
        return;
      }
      debug("get_user returned: " + res);
      assert.equal(res.uid, false, "response success must be false");
      done();
    });
  });
});


describe('Neo4J U-U Connection lifecycle', function () {
  var uid1 = "uid1";
  var uid2 = "uid2";

  var user_node_ids = [];

  var gen_user = function (uid, cb) {
    cacl.create_user(uid, function (err, res) {
      if (err) {
        return cb("fail within neo_dao_spec.js");
      }
      cb(null, res);
    });
  };

  it('should create a bunch of users', function (done) {
    async.parallel([
      function (cb) {
        gen_user("uid1", cb);
      },
      function (cb) {
        gen_user("uid2", cb);
      },
      function (cb) {
        gen_user("uid3", cb);
      },
      function (cb) {
        gen_user("uid4", cb);
      },
    ], function (err, res) {
      if (err) {
        debug('error: ' + err);
        throw err;
      }
      user_node_ids = res;
      debug("resulting list of uids: " + user_node_ids);
      done();
    });
  });

  it('should create connections between users', function (done) {
    var cids = [];
    async.parallel([
      function (cb) {
        cacl.initiate_user_user_connection("uid1", "uid2", "hello", cb);
      },
      function (cb) {
        cacl.initiate_user_user_connection("uid1", "uid3", "hello", cb);
      },
      function (cb) {
        cacl.initiate_user_user_connection("uid1", "uid4", "hello", cb);
      },
      function (cb) {
        cacl.initiate_user_user_connection("uid2", "uid3", "hello", cb);
      },
    ], function (err, res) {
      if (err) {
        debug('error: ' + err);
        throw err;
      }

      cids = res;
      debug("relationships created: " + cids);
      done();
    });
  });

  it('should verify the Unique connection', function (done) {
    cacl.list_connections_for_user(uid1, function (err, res) {
      if (err) {
        debug('error: ' + err);
        throw err;
      }

      debug("connections for uid1: " + JSON.stringify(res));
      assert.ok(res, "must have some results");
      done();
    });

  });

});
