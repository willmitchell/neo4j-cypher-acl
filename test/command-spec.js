var CC = require("../lib/commands.js");
var debug = require('debug')('CACL-test');
var assert = require('assert');

describe('Test command pattern', function () {
  it('should create an update conn command', function (done) {
    let rucc = CC.makeRsvpUpdateConnCommand("uid1", "uid2", "sure lets be connected", true);
    assert.equal(rucc.confirm, true);
    done();
  });
  it('should create an conn termination command', function (done) {
    let rucc = CC.makeTerminateConnCommand("uid1", "uid2", "i do not actually know this person");
    assert.equal(rucc.terminate, true);
    done();
  });
});
