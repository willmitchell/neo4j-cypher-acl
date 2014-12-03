"use strict";

//class UpdateConnCommand {
//  constructor(uid1, uid2, note) {
//    this.uid1 = uid1;
//    this.uid2 = uid2;
//    this.note = note;
//  }
//}
//class makeRsvpUpdateConnCommand extends UpdateConnCommand {
//  constructor(uid1, uid2, note, confim_bool) {
//    super(uid1, uid2, note);
//    this.confirm = confirm;
//  }
//}
//class makeTerminateConnCommand extends UpdateConnCommand {
//  constructor(uid1, uid2, note) {
//    super(uid1, uid2, note);
//    this.terminate = true;
//  }
//}

var makeBaseUpdateConnCommand = (uid1,uid2,note) =>{
  return {
    uid1,
    uid2,
    note
  };
};

module.exports.makeRsvpUpdateConnCommand = (uid1,uid2,note,confirm) =>{
  let x = makeBaseUpdateConnCommand(uid1,uid2,note);
  x.confirm = confirm;
  return x;
};

module.exports.makeTerminateConnCommand = (uid1,uid2,note) =>{
  let x = makeBaseUpdateConnCommand(uid1,uid2,note);
  x.terminate = true;
  return x;
};

