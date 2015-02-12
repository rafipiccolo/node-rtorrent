var Rtorrent = require('./index.js');

var rtorrent = new Rtorrent();

/*
// multicall
rtorrent.get('d.multicall', ['default', 'd.name='], function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(data);
});


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
*/

rtorrent.getAll(function (err, data) {
    if (err) return console.log('err: ', err);

    console.log(data);
});