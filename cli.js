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
    console.log('  node-rtorrent download_list');
    console.log('  node-rtorrent d.multicall main d.name= d.get_base_path=');
    console.log('  node-rtorrent t.multicall XXXXXXX t.id= t.url=');
    console.log('  node-rtorrent load_start "magnet:?xt=urn:xxxx"');
    console.log('  node-rtorrent load_start "http://xxx/xxx.torrent"');
    console.log('  node-rtorrent execute_capture bash -c "ls -la /"');
    process.exit();
}


var cmd = process.argv[2];
var params = process.argv.slice(3);
rtorrent.get(cmd, params, function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(JSON.stringify(data, null, 4));
});
