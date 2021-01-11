'use strict'
const config = require('./config');
exports.smtp_host = config.get("smtp_host")
exports.smtp_port = config.get("smtp_port")
const mydomain = config.get("mydomain");
exports.mydomain=mydomain

exports.gsmail_db_path =config.get("gsmail_db_path");
exports.teacher_j =config.get("teacher_j");
exports.teacher_e =config.get("teacher_e");
exports.example_mail_data =config.get("example_mail_data");
var logpath =config.get("logpath");
exports.setLogPath = function (x) { logpath = x; }
exports.getLogPaht = function () { return logpath; }
var fs = require('fs');
var mlogg = function (txt) { fs.appendFileSync(logpath, txt); }
var mlog = function (txt) {
    fs.writeFileSync(logpath, txt); 
}
exports.mlogg = mlogg;
exports.mlog = mlog;
exports.msg_dflag = function (toaddr, hc, step) { console.log("mflag" + hc + step); }
exports.msg_dele = function (toaddr, hc, step) { console.log("dele" + hc + step); }
const net = require('net');
const mail_proc = ["MAIL FROM", "RCPT TO", "DATA", "QUIT", "--"];
exports.relaymail = function (
    smtp_port,
    smtp_host,
    fromaddr,
    toaddr,
    mbody,
    hc,
    msg_mark_dflag,
    msg_clean) {
    let mail_proc_ind = 0;
    let client = new net.Socket();
    client.connect(smtp_port, smtp_host, function () { console.log('Connected'); });
    client.on('data', function (data) {
        console.log('Received: ' + data);
        mlogg(data);
        let code = data.toString().substring(0, 3);
        switch (code) {
            case "220": 
               //client.write(`HELO ${mydomain}\r\n`);
               //client.write("HELO User\r\n");
               let helo_=`EHLO ${mydomain}\r\n`;
                client.write(helo_);
                console.log(helo_);
                break;
            case "250":
                if (mail_proc_ind < mail_proc.length) { console.log(mail_proc[mail_proc_ind]); mlogg(mail_proc[mail_proc_ind]); }
                switch (mail_proc_ind) {
                    case 0: client.write("MAIL FROM:<" + fromaddr + ">\r\n"); break;
                    case 1: client.write("RCPT TO:<" + toaddr + ">\r\n"); break;
                    case 2: client.write("DATA\r\n"); break;
                    case 3: client.write("QUIT\r\n"); break;
                    default:
                        console.log("error!");
                        client.destroy();
                }
                mail_proc_ind++;
                break;
            case "354": client.write(mbody); console.log("Mail_Body"); break;
            case "221": client.destroy();
                msg_clean(toaddr, hc, 5);
                break;
            case "550":
			    console.log("550 ",toaddr);
                mlogg(toaddr);
                msg_mark_dflag(toaddr, hc, 5);
                //550 NOT_SUCH_USER    
            case "552":
			    console.log("552 ",toaddr,fromaddr);
                mlogg(toaddr);				
               //msg_mark_dflag(toaddr, hc, 5);
               //Received: 552-5.7.0 This message was blocked because its content presents a potential
               //552-5.7.0 security issue. Please visit
               //552-5.7.0  https://support.google.com/mail/?p=BlockedMessage to review our
               //552 5.7.0 message content and attachment content guidelines. q14si885484pgg.433 - gsmtp
            case "421":
                mlogg(toaddr);
                //"421 4.7.0 IP not in whitelist for RCPT domain,closing connection.hash.-gsmtp"            
            default:
                mlogg(hc);
                mlogg(data);
                msg_mark_dflag(toaddr, hc, 1);
        }
    });
    client.on('close', function () { console.log('Connection closed'); });
}