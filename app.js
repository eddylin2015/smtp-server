const config = require('./config');
const mysql = require('mysql');
const options = config.get('MYSQL_OPTIONS');
const whitelist = config.get('WHITELIST');
const whitelist_endsWith = config.get('WHITELIST_ENDSWITH');
const blacklist =config.get('BLACKLIST');
const blacklist_mail =config.get('BLACKLIST_MAIL');
const blacklist_endsWith = config.get('BLACKLIST_ENDSWITH');
const blacklist_IP_startsWith = config.get('BLACKLIST_IP_STARTSWITH');
const hostname=config.get('HOSTNAME');

const pool = mysql.createPool(options);
const { SMTPServer } = require('smtp-server');
const fs = require('fs');
const { exception } = require('console');
const SERVER_PORT = 25;
const SERVER_HOST = '0.0.0.0';
function VerifyConnSession(session) {
    for (let blackname of blacklist_IP_startsWith) {
        if (session.remoteAddress.startsWith(blackname)) {
            console.log(session.remoteAddress, blackname)
            return new Error('Not accepted, this server is no in Permited List.Error 01');
        }
    }
    if (session.remoteAddress == "127.0.0.1") return null;
    for (let whitename of whitelist) {
        if (session.clientHostname === whitename) return null;
    }
    for (let whitename of whitelist_endsWith) {
        if (session.clientHostname === whitename) return null;
    }
    for (let blackname of blacklist) {
        if (session.clientHostname === blackname) {
            return new Error('Not accepted, this server is no in PermitedList.Error 02');
        }
    }
    for (let blackname of blacklist_endsWith) {
        if (session.clientHostname.endsWith(blackname)) {
            return new Error('Not accepted, this server is no in Permited List.Error 03');
        }
    }
    console.log("connect session:", session.remoteAddress, session.clientHostname);
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9-]{2,})*(?:\.[a-zA-Z]{2,})+$/.test(session.clientHostname)) {
        console.log("check connect session:", session.remoteAddress, session.clientHostname);
    }
    else {
        console.log("pend connect session:", session.remoteAddress, session.clientHostname);
    }
    return null;
}
const server = new SMTPServer({
    banner: 'Welcome to My cool Server',
    name: hostname,
    size: 10 * 1024 * 1024,
    //lmtp: true,
    //secure: true,
    disabledCommands: ['AUTH'],//STARTTLS
    logger: true,
    onConnect(session, callback) {
        let err = VerifyConnSession(session);
        if (err) return callback(err);
        callback();
    },
    onMailFrom(address, session, callback) {
        if (address.address.toLowerCase().endsWith("@hotmail.com")) {
            if (session.remoteAddress.startsWith("40.")) {
            } else if (session.clientHostname.indexOf("protection.outlook.com") > -1) {
            } else {
                console.log(address.address, session.remoteAddress, session.clientHostname);
                return callback(new Error('Not accepted.Error 04'));
            }
        }
        if (/^deny/i.test(address.address)) {
            return callback(new Error('Not accepted'));
        }
        callback();
    },
    onRcptTo(address, session, callback) {
        let sess_err = VerifyConnSession(session);
        if (sess_err) return callback(sess_err);

        let err;
        if (!address.address.toLowerCase().endsWith("mbc.edu.mo")) {
            return callback(new Error('Not accepted..Error 05'));
        }
        for (const to_mail of blacklist_mail) {
            if (address.address.toLowerCase() === to_mail)
                return callback(new Error('Not accepted..Error 06'));
        }

        if (/^deny/i.test(address.address)) {
            return callback(new Error('Not accepted.'));
        }

        // Reject messages larger than 100 bytes to an over-quota user
        if (address.address.toLowerCase() === 'almost-full@example.com' && Number(session.envelope.mailFrom.args.SIZE) > 100) {
            err = new Error('Insufficient channel storage: ' + address.address);
            err.responseCode = 452;
            return callback(err);
        }
        callback();
    },
    onData(stream, session, callback) {
        //if debug: stream.pipe(process.stdout);
        //if mailparser.simpleParser: 
        //    parser(stream,{},(err,parsed)=>{
        //         if(err);stream.on("end",callback)
        //    });
        let data = "";
        stream.on('data', (chunk) => { data += chunk.toString(); })
        stream.on('end', () => {
            let err;
            if (stream.sizeExceeded) {
                err = new Error('Error: message exceeds fixed maximum message size 10 MB');
                err.responseCode = 552;
                return callback(err);
            }
            let hc = session.id
            let fromAddr = session.envelope.mailFrom.address
            let rcptAddr = session.envelope.rcptTo[0].address
            let rIpaddr = session.remoteAddress
            let rCliHost = session.clientHostname
            let datasize = session.envelope.mailFrom.args.SIZE
            let d = new Date();
            let reci_dt = d.toISOString();
            try {
                for (let rcptTo_ of session.envelope.rcptTo) {
                    rcptAddr = rcptTo_.address
                    if (rcptAddr.toLowerCase().endsWith("mbc.edu.mo")) {
                        if (rcptAddr == "mbc@mbc.edu.mo") rcptAddr = "webmaster@mail.mbc.edu.mo";
                        rcptAddr = rcptAddr.replace("@mbc.edu.mo", "@mail.mbc.edu.mo")
                        break;
                    }
                }
            } catch (exp) {
                console.log(exp)
            }
            data += "\r\n.\r\n"
            pool.getConnection(function (err, connection) {
                if (err) {
                    cb(err);
                    return;
                }
                connection.query(
                    "insert into mail( subject_ ,from_,to_,body_,hc,ipaddr,helo_domain,reci_dt,data_size ,dele_ )values(?,?,?,?,?,?,?,?,?,0);", ["..", fromAddr, rcptAddr, data, hc, rIpaddr, rCliHost, reci_dt, datasize],
                    (err, results) => {
                        if (err) {
                            console.log(err);
                            return;
                        }
                        connection.release();
                    }
                );
            });
            callback(null, true); // accept the message once the stream is ended
        });
    },
    onData_(stream, session, callback) {
        console.log(session)
        stream.pipe(process.stdout); // print message to console
        stream.on('end', callback);
    },
    key: fs.readFileSync(config.get('CA_PRIVKEY')),
    cert: fs.readFileSync(config.get('CA_FULLCHAIN'))
});
server.on('error', err => {
    console.log('Error occurred');
    console.log(err);
});
server.listen(SERVER_PORT, SERVER_HOST);