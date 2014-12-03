var CACL = require("../lib/index.js");
var debug = require('debug')('CACL-test');
var assert = require('assert');
var asyncModule = require('async');

var config = {
  neo4j: {
    root_url: process.env.NEO4J_ROOT_URL || process.env.GRAPHENEDB_URL || "http://localhost:7474",
    path: "/db/data/cypher"
  }
};
var cacl = new CACL(config);

describe('Recreate test database', function () {
  it('should count nodes before deleting', function (done) {
    cacl.count_all_nodes(function (err, res) {
      if (err) {
        debug("failed to count nodes");
        return;
      }
      debug("count returned: " + res);
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
    cacl.count_all_nodes(function (err, res) {
      if (err) {
        debug("failed to count nodes");
        return;
      }
      debug("count returned: " + res);
      assert.equal(res,0);
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
        return ;
      }
      debug("create_asset returned: " + res);

      assert.equal(res.aid, aid);
      done();
    });
  });
  aid = "910";
  it('should create another asset and associate it with the root group', function (done) {
    cacl.create_asset(uid, aid, "/", function (err, res) {
      if (err) {
        debug("problem creating an asset");
        return;
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
        return cb("failed to generate user within U-U conn lifecycle");
      }
      cb(null, res);
    });
  };

  it('should create a bunch of users', function (done) {
    asyncModule.parallel([
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


  var cids = [];

  it('should create connections between users', function (done) {
    asyncModule.parallel([
      function (cb) {
        cacl.create_user_user_connection("uid1", "uid2", "hello", cb);
      },
      function (cb) {
        cacl.create_user_user_connection("uid1", "uid3", "hello", cb);
      },
      function (cb) {
        cacl.create_user_user_connection("uid1", "uid4", "hello", cb);
      },
      function (cb) {
        cacl.create_user_user_connection("uid2", "uid3", "hello", cb);
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

  it('should confirm several invitations', function (done) {

    asyncModule.parallel([
      function (cb) {
        cacl.update_connection("uid1", "uid2", true, "hi", cb);
      },
      function (cb) {
        cacl.update_connection("uid1", "uid3", true, "hi", cb);
      },
      function (cb) {
        cacl.update_connection("uid1", "uid4", false, "no", cb);
      },
      function (cb) {
        cacl.update_connection("uid2", "uid3", false, "no", cb);
      },
    ], function (err, res) {
      if (err) {
        debug('error: ' + err);
        throw err;
      }

      cids = res;
      debug("relationships updated: " + cids);
      done();
    });
  });

  it('should verify connection status', function (done) {
    cacl.list_connections(uid1, function (err, res) {
      if (err) {
        debug('error: ' + err);
        throw err;
      }

      debug("connections for uid1: " + JSON.stringify(res));
      assert.ok(res, "must have some results");
      assert.equal(res.cdata.length,3);
      assert.equal(res.u2data.length,3);
      done();
    });
  });

});
