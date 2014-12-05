var CACL = require("../lib/cypher-acl");
var Commands = require("../lib/commands");
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
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      done();
    });
  });

  it('should clear the db', function (done) {
    this.timeout(5000);
    cacl.warning_delete_all_nodes_and_edges(function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      done();
    });
  });

  it('should ensure that the db is clear', function (done) {
    cacl.count_all_nodes(function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      assert.equal(res.count, 0);
      done();
    });
  });

  it('should apply constraints and create indices', function (done) {
    cacl.apply_global_constraints(function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      done();
    });
  });

  it('should create the friend role', function (done) {
    cacl.create_role(function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      done();
    }, "friend");
  });

  it('should create the manager role', function (done) {
    cacl.create_role(function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      done();
    }, "manager","friend");
  });

});

var uid = 77;
var uidb = 78;

describe('Neo4J User/Group Ops', function () {
  it('should create a user a', function (done) {
    cacl.create_user(uid, function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      assert.ok(res.user_node_id);
      done();
    });
  });
  it('should create a user b', function (done) {
    cacl.create_user(uidb, function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      assert.ok(res.user_node_id);
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
      if (err) {
        throw err;
      }
      assert.ok(res.success);

      assert.equal(res.aid, aid);
      done();
    });
  });

  it('should create a second group and associate it with the root group', function (done) {
    cacl.create_group(uid, "second", function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);

      assert.ok(res.gnid);
      done();
    });
  });

  it('should verify that we now have a tree of assets with 1 asset', function (done) {
    let cmd = cacl.make_list_assets_cmd(uid);
    cmd.cb = function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      //assert.ok(res.groups);
      assert.ok(res.assets);
      //assert.equal(res.groups.length,1);
      assert.equal(res.assets.length,1);
      done();
    };
    cacl.list_assets(cmd);
  });

  var aid2 = "910";
  it('should create another asset and associate it with the second group', function (done) {
    cacl.create_asset(uid, aid2, "second", function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);

      assert.equal(res.aid, aid2);
      done();
    });
  });

  it('should verify that we now have a tree of assets with 2 assets', function (done) {
    let cmd = cacl.make_list_assets_cmd(uid);
    cmd.cb = function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      //assert.ok(res.groups);
      assert.ok(res.assets);
      //assert.equal(res.groups.length,2);
      assert.equal(res.assets.length,2);
      done();
    };
    cacl.list_assets(cmd);
  });



  //it('should delete User by uid', function (done) {
  //  cacl.delete_user(uid, function (err, res) {
  //    if (err) {
  //      throw err;
  //    }
  //    assert.ok(res.success);
  //
  //    assert.equal(res.success, true, "res.success must be true");
  //    done();
  //  });
  //});
  //it('should verify that the User is gone', function (done) {
  //  cacl.get_user(uid, function (err, res) {
  //    if (err) {
  //      throw err;
  //    }
  //    assert.equal(res.success, false, "response success must be false");
  //    done();
  //  });
  //});
});


describe('Neo4J U-U Connection lifecycle', function () {

  var user_node_ids = [];

  var gen_user = function (uid, cb) {
    cacl.create_user(uid, function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      cacl.create_asset(uid, "a1", "/", function (err, res) {
        if(err){throw err;}
        assert.ok(res.success);
        cb(null, res);
      });
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
    cacl.list_connections("uid1", function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);

      assert.equal(res.cdata.length, 2);
      assert.equal(res.u2data.length, 2);
      done();
    });
  });

  it('should grant a friend access', function(done) {
    cacl.create_grant("uid1","uid2","/","friend", function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      assert.ok(res.grant_node_id);
      done();
    });
  });

  it('should prove that the friend can see the assets', function (done) {
    let cmd = cacl.make_list_assets_cmd("uid2");
    cmd.cb = function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);
      //assert.ok(res.groups);
      assert.ok(res.assets);
      //assert.equal(res.groups.length,2);
      assert.equal(res.assets.length,2);
      done();
    };
    cacl.list_assets(cmd);
  });


  it('should terminate a connection', function (done) {
    cacl.terminate_connection("uid1", "uid3", "sorry but I cannot know you", function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);

      assert.equal(res.state, "terminated");
      assert.ok(res.term_note);
      assert.ok(res.term_at);
      done();
    });
  });

  it('should verify that a connection has been terminated', function (done) {
    cacl.list_connections("uid1", function (err, res) {
      if (err) {
        throw err;
      }
      assert.ok(res.success);

      assert.equal(res.cdata.length, 1);
      assert.equal(res.u2data.length, 1);
      done();
    });

  });

});
