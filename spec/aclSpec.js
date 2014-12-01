var CACL = require("../index.js");
var debug = require('debug')('CACL-test');
var assert = require('assert');

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
});
