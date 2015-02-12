var Rtorrent = require('./index.js');

var rtorrent = new Rtorrent();

// mode multicall
rtorrent.get('d.multicall', ['default', 'd.name='], function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(data);
});

// mode manuel
rtorrent.get('download_list', [], function (err, hashes) {
    if (err) return console.log('err: ', err);

    console.log(hashes);

    if (hashes.length)
    {
        rtorrent.get('d.name', [hashes[0]], function (err, data) {
            if (err) return console.log('err: ', err);

            console.log(data);
        });
    }
});
