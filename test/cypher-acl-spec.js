var CACL = require("../lib/index.js");
var debug = require('debug')('CACL-test');
var assert = require('assert');
var asyncModule = require('async');

var config = {
  neo4j: {
    root_url: process.env.NEO4J_ROOT_URL || process.env.GRAPHENEDB_URL || "http://localhost:7474",
    path: "/db/data/cypher",
    loud_logging: false
  }
};
var cacl = new CACL(config);

describe('Recreate test database', function () {
  it('should count nodes before deleting', function (done) {
    this.timeout(5000);
    cacl.count_all_nodes(function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);
      done();
    });
  });

  it('should clear the db', function (done) {
    this.timeout(5000);
    cacl.warning_delete_all_nodes_and_edges(function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);
      done();
    });
  });

  it('should ensure that the db is clear', function (done) {
    cacl.count_all_nodes(function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);

      assert.equal(res.count,0);
      done();
    });
  });
});

var uid = 77;

describe('Neo4J User/Group Ops', function () {
  it('should create a User', function (done) {
    cacl.create_user(uid, function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);
      assert.ok(res.unid);
      done();
    });
  });
  it('should verify that the User exists', function (done) {
    cacl.get_user(uid, function (err, res) {
      if (err) {
        debug("problem searching for user");
        return;
      }
      assert.ok(res.success);
      assert.ok(res.user);
      done();
    });
  });

  var aid = "909";
  it('should create an asset and associate it with the root group', function (done) {
    cacl.create_asset(uid, aid, "/", function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);

      assert.equal(res.aid, aid);
      done();
    });
  });
  aid = "910";
  it('should create another asset and associate it with the root group', function (done) {
    cacl.create_asset(uid, aid, "/", function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);

      assert.equal(res.aid, aid);
      done();
    });
  });
  it('should delete User by uid', function (done) {
    cacl.delete_user(uid, function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);

      assert.equal(res.success, true, "res.success must be true");
      done();
    });
  });
  it('should verify that the User is gone', function (done) {
    cacl.get_user(uid, function (err, res) {
      if (err) { throw err; }
      assert.equal(res.success, false, "response success must be false");
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
      if (err) { throw err; }
      assert.ok(res.success);
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
      if (err) { throw err; }

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
      if (err) { throw err; }
      assert.ok(res.success);

      assert.equal(res.cdata.length,3);
      assert.equal(res.u2data.length,3);
      done();
    });
  });

  it('should terminate a connection', function(done) {
    cacl.terminate_connection("uid1","uid2","sorry but I cannot know you", function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);

      assert.equal(res.state,"terminated");
      assert.ok(res.term_note);
      assert.ok(res.term_at);
      done();
    });
  });

  it('should verify that a connection has been terminated', function (done) {
    cacl.list_connections(uid1, function (err, res) {
      if (err) { throw err; }
      assert.ok(res.success);

      assert.equal(res.cdata.length,2);
      assert.equal(res.u2data.length,2);
      done();
    });


});
