#! /usr/bin/env node

var Rtorrent = require('./index.js');


var config = require('./config.json');


var rtorrent = new Rtorrent({
    mode: config.mode,
    host: config.host,
    port: config.port,
    path: config.path,
    user: config.user,
    pass: config.pass
});


if (process.argv.length <= 2) {
    console.log('USAGE: node-rtorrent cmd ...');
    console.log('');
    console.log('Exemples:');
    console.log('  node-rtorrent get download_list');
    console.log('  node-rtorrent get d.multicall main d.name= d.get_base_path=');
    console.log('  node-rtorrent get t.multicall XXXXXXX t.id= t.url=');
    console.log('  node-rtorrent get load_start "magnet:?xt=urn:xxxx"');
    console.log('  node-rtorrent get load_start "http://xxx/xxx.torrent"');
    console.log('  node-rtorrent get execute_capture bash -c "ls -la /"');
    console.log('  node-rtorrent execute "ls -la /"');
    console.log('  node-rtorrent getAll');
    process.exit();
}


var method = process.argv[2];
var cmd = process.argv[3];
var params = process.argv.slice(4);

if (rtorrent[method].length == 1)
    rtorrent[method](callback);
else if (rtorrent[method].length == 2)
    rtorrent[method](cmd, callback);
else
    rtorrent[method](cmd, params, callback);

function callback(err, data) {
    if (err) return console.log('err: ', err);

    console.log(JSON.stringify(data, null, 4));
}