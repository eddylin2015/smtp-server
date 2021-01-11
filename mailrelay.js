'use strict'
const limitcnt=35;

let sql="SELECT body_ , from_ as mailfrm , to_ , hc FROM mail WHERE dele_ < 5 ";
let parasflag=false;
let paras="and to_ in (''";
process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
  if(index>1){  paras+=",'"+val+"'";  parasflag=true;  }
});
paras+=");";
if(parasflag) sql+=paras;
sql+=" limit "+limitcnt+";";

const net = require('net');
const config = require('./config');
const mc = require('./mailrelaydata.js');
const mail_proc = ["MAIL FROM", "RCPT TO", "DATA", "QUIT", "--"];
var fs = require('fs');
function Msg_Proc(err,rows,mdflag,mdele){
    if(err) {console.log("ERROR! no 19");return;}
    console.log(rows.length);
    try {
        let maxnum=rows.length > limitcnt ? limitcnt : rows.length;
        for (let i = 0; i < maxnum; i++) {
            let mailfrom = rows[i].mailfrm.toString();
            let mailto = rows[i].to_.toString();
            let mailhc = rows[i].hc.toString();
            console.log(i,mailfrom , mailto);
            mc.relaymail(mc.smtp_port,
                mc.smtp_host,
                mailfrom,
                mailto,
                rows[i].body_,
                mailhc,
                mdflag,
                mdele);
        }
    } catch (err) {
        console.log(err);
        mc.mlogg(err);
    }
}
/*********
 * mysql
 */
const mysql = require('mysql');
const options = config.get('MYSQL_OPTIONS');
const pool = mysql.createPool(options);
var myApp = {
    vIntervalTimer:null,
    cnt : 0
}
myApp.list = function (cb) {
    pool.getConnection(function (err, connection) {
        if(err){
            cb(err);
            return;
        }
        // Use the connection
        connection.query(
            sql, [],
            (err, results) => {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, results,myApp.msg_deleteflag,myApp.msg_delete);
                connection.release();
            }
        );
    });
}
myApp.msg_delete= function (toaddr,hc,step, cb) {
    pool.getConnection(function (err, connection) {
        if(err){cb(err);return;}
        connection.query("delete from mail where to_=? and hc =?;", [toaddr, hc], cb);
        connection.release();
    });
}
myApp.msg_deleteflag= function (toaddr,hc, step,cb) {
    pool.getConnection(function (err, connection) {
        if(err){cb(err);return;}
        connection.query("update mail set dele_ = dele_ + ? where hc =?;", [step, hc], cb);
        connection.release();
    });
}
//myApp.vIntervalTimer;
//myApp.cnt = 0;
//myApp.list(myApp.Msg_Proc);
myApp.Msg_Push = function () {
    myApp.cnt++;
    //mc.mlogg(App.cnt);
    console.log(myApp.cnt);
    myApp.list(Msg_Proc);    
    return; // if (cnt >= li.length) { clearInterval(vIntervalTimer);  }    
}
myApp.run=function() { myApp.vIntervalTimer = setInterval(myApp.Msg_Push, 60000); }
myApp.Msg_Push();
myApp.run();
mc.mlog("-start-");

/*************
 * sqlite3 
 * 
 */
var sqlite3 = require('sqlite3').verbose();
const gsmail_db_path = config.get("gsmail_db_path");
var App = { vIntervalTimer:null,cnt : 0}
App.msg_dflag = function (toaddr, hc, step) {
    mc.mlogg("Flag Msg:" + hc + "|" + step);
    var db = new sqlite3.Database(gsmail_db_path);
    db.run("update mail set dele_ = dele_ + ? where hc =?;", [step, hc]);
    db.close();
}
App.msg_dele = function (toaddr, hc, step) {
    mc.mlogg("Clean Msg:" + hc);
    var db = new sqlite3.Database(gsmail_db_path);
    db.run("delete from mail where to_=? and hc =?;", [toaddr, hc]);
    db.close();
}
App.Msg_Proc=function (err,rows){
    try {
        let maxnum=rows.length > limitcnt ? limitcnt : rows.length;
        for (let i = 0; i < maxnum; i++) {
            let mailfrom = rows[i].mailfrm.toString();
            let mailto = rows[i].to_.toString();
            let mailhc = rows[i].hc.toString();
            console.log(i,mailfrom , mailto);
            mc.relaymail(mc.smtp_port,
                mc.smtp_host,
                mailfrom,
                mailto,
                rows[i].body_,
                mailhc,
                App.msg_dflag,
                App.msg_dele);
        }
    } catch (err) {
        console.log(err);
        mc.mlogg(err);
    }
}
App.Msg_Push = function () {
    App.cnt++;
    mc.mlogg(App.cnt);
    console.log(App.cnt);
    var db = new sqlite3.Database(gsmail_db_path);
	console.log(sql);
    db.all(sql, [], function (err, rows) {
        console.log(rows.length);
        try {
			let maxnum=rows.length > limitcnt ? limitcnt : rows.length;
            for (let i = 0; i < maxnum; i++) {
                let mailfrom = rows[i].mailfrm.toString();
                let mailto = rows[i].to_.toString();
                let mailhc = rows[i].hc.toString();
                console.log(i,mailfrom , mailto);
                mc.relaymail(mc.smtp_port,
                    mc.smtp_host,
                    mailfrom,
                    mailto,
                    rows[i].body_,
                    mailhc,
                    App.msg_dflag,
                    App.msg_dele);
            }
        } catch (err) {
            console.log(err);
            mc.mlogg(err);
        }
    });
    db.close();
    return; // if (cnt >= li.length) { clearInterval(vIntervalTimer);  }    
}
/*
App.run=function() { App.vIntervalTimer = setInterval(App.Msg_Push, 60000); }
App.Msg_Push();
App.run();
*/