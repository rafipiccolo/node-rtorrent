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


rtorrent.getAll(function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(data);
});


/*
// manual mode
rtorrent.get('download_list', [], function (err, hashes) {
    if (err) return console.log('err: ', err);

    console.log(hashes);

    if (hashes.length)
    {
        // get the name of the first torrent
        rtorrent.get('d.name', [hashes[0]], function (err, data) {
            if (err) return console.log('err: ', err);

            console.log(data);
        });
    }
});


// multicall
rtorrent.getMulticall('d.multicall', ['main'], {name: 'd.name=', hash: 'd.get_hash'}, function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(data);
});


// everything in one shot
rtorrent.getAll(function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(data);
});


rtorrent.loadLink('magnet link or http torrent file', function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(JSON.stringify(data, null, 4));
});


rtorrent.loadFile('local torrent file', function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(JSON.stringify(data, null, 4));
});


// start a torrent which is already registered in rtorrent with its hash
rtorrent.start('XXXXXXXX', function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(data);
});

*/
