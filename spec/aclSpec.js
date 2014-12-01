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

  it('should return node count', function (done) {
    cacl.cypher('MATCH (n) RETURN "Hello Graph with "+count(*)+" Nodes!" as welcome;', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("count returned: " + res);
      debug("welcome msg: " + res.columns);
      assert.equal(res.columns, 'welcome', "response must include welcome");
      done();
    });
  });
});

describe('Neo4J User CRUD', function () {
  it('should create a User', function (done) {
    cacl.cypher('create (u:User {name:"CRUD"}) return u.name as name', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("CREATE returned: " + res);
      assert.equal(res.data[0], 'CRUD', "response must include name of CRUD");
      done();
    });
  });
  it('should find User named CRUD', function (done) {
    cacl.cypher('match (u:User {name:"CRUD"}) return u.name as name limit 1', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("MATCH returned: " + res);
      assert.equal(res.data[0], 'CRUD', "response must include name of CRUD");
      done();
    });
  });
  it('should update User named CRUD to FUD', function (done) {
    cacl.cypher('match (u:User {name:"CRUD"}) set u.name="FUD" return u.name as name limit 1', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("UPDATE returned: " + res);
      assert.equal(res.data[0], 'FUD', "response must include name of FUD");
      done();
    });
  });
  it('should delete User named FUD', function (done) {
    cacl.cypher('match (u:User) where u.name in ["CRUD","FUD"] delete u return true', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("DELETE returned: " + res + "or: [" + res.data[0] + ']');
      assert.notStrictEqual(res.data[0], true, "response must include a single data value === true");
      done();
    });
  });
  it('should not find any User named FUD or CRUD', function (done) {
    cacl.cypher('match (u:User) where u.name="FUD" or u.name="CRUD" return u.name as name limit 1', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("MATCH returned: " + res);
      assert.equal(res.data[0], undefined, "response for FUD must have an undefined name");
      done();
    });
  });

});

describe('Neo4J User/Account CRUD', function () {
  it('should create a User and an Account', function (done) {
    cacl.cypher('create (u:User {name:"CRUD"}), (a:Account {name:"A"}), u-[:OWNS]->a return id(u) as uid, id(a) as aid', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("CREATE User-Account returned: " + res);
      //assert.equal(res.data[0], 'CRUD', "response must include name of CRUD");
      done();
    });
  });
  it('should delete the User / Account account Ownership relation', function (done) {
    cacl.cypher('match (u:User {name:"CRUD"}),(a:Account {name:"A"}) match (u)-[r]->(a) delete r return true', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("DELETE returned: " + res + "or: [" + res.data[0] + ']');
      //assert.notStrictEqual(res.data[0], true, "response must include a single data value === true");
      done();
    });
  });
  it('should delete the User and the Account', function (done) {
    cacl.cypher('match (u:User {name:"CRUD"}),(a:Account {name:"A"}) delete u,a return true', {}, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("DELETE returned: " + res + "or: [" + res.data[0] + ']');
      //assert.notStrictEqual(res.data[0], true, "response must include a single data value === true");
      done();
    });
  });
});

var uid = 77;

describe('Neo4J DAO Ops', function () {
  it('should create a User', function (done) {
    cacl.create_user(uid, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("DAO Ops CREATE returned nodeid: " + res);
      assert.notEqual(res, undefined, "response must include a single defined value (not undefined)");
      done();
    });
  });
  it('should delete User by uid', function (done) {
    cacl.delete_user(uid, function (err, res) {
      if (err) {
        debug("fail within neo_dao_spec.js");
        return;
      }
      debug("DELETE returned: " + res);
      assert.notStrictEqual(res, true, "response must be true  ");
      done();
    });
  });
});


describe('Neo4J U-U Connection', function () {
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
