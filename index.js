const Jimp = require('jimp');
const express = require('express');
const bodyParser = require('body-parser');
const utils = require('./utils');


const app = express();

app.use("/tiles", express.static(__dirname + '/tiles'));

app.use(bodyParser.urlencoded({
    extended: false
}))
app.use(bodyParser.json());

app.get('/onlycloud/:x/:y/:z/:date', async (req, res) => {

    const { x, y, z, date } = req.params;
    
    const data = await utils.loadTile(x, y, z, date);
    const clouds = data.image;

    try {
        const image = await Jimp.read('nocloud/'+x+'_'+y+'_'+z+'.png');
        const canva = utils.extractClouds(clouds,image);

        await canva.write('tmp.png');
        res.sendFile('tmp.png', {
                root: __dirname
        });
    } catch (e) {
        res.send('First generate nocloud tile by URL: nocloud/'+x+'/'+y+'/'+z+'/1-10');
    }
});
	
	
app.get('/nocloud/:x/:y/:z/:days', async (req, res) => {

    const { x, y, z, days } = req.params;

    const image = await utils.noCloudTile(x,y,z,days);
    const url = 'nocloud/'+x+'_'+y+'_'+z+'.png';
   
    image.write(url, ()=>{
        res.sendFile(url, {
            root: __dirname
        })
    });
});

app.listen(8888, function () {
    console.log('Example app listening on port 8888!');
});


