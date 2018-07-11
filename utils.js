const request = require('request-promise').defaults({
    encoding: null
});
const Jimp = require('jimp');
const format = require('date-format');
const mathjs = require('mathjs');

function tileUrl(x, y, z, date, layer = 'VIIRS_SNPP_CorrectedReflectance_TrueColor') {
    return 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/' + layer + '/default/' + date + '/250m/' + z + '/' + y + '/' + x + '.jpg';
}

async function loadTile(x, y, z, date) {

    const url = tileUrl(x, y, z, date);
    const buffer = await request.get(url); //, function (err, res, buffer) {
    const image = await Jimp.read(buffer);

    console.log(url, 'loaded');

    return {
        image,
        date,
        x,
        y,
        z
    }
}

function extractLightness(x, o, stabilize = true) {

    const f = stabilize ?
        (x - o) * (1 - Math.pow(o, 3)) / (1 - o) :
        (x - o);

    return Math.max(0, f);
}

function extractClouds(clouds, cloudless) {

    const canva = clouds.clone();

    eachPixel([clouds, cloudless], (pixels, x, y) => {

        let color1 = Jimp.intToRGBA(pixels[0]);
        let color2 = Jimp.intToRGBA(pixels[1]);

        let r = extractLightness(color1.r / 255, color2.r / 255);
        let g = extractLightness(color1.g / 255, color2.g / 255);
        let b = extractLightness(color1.b / 255, color2.b / 255);

        let hexColor = Jimp.rgbaToInt(Math.ceil(r * 255), Math.ceil(g * 255), Math.ceil(b * 255), 255);

        canva.setPixelColor(hexColor, x, y);
    });

    return canva.greyscale().contrast(0.3);
}

function eachPixel(images, proc) {

    if (images.length == 0) {
        console.log("eachPixel(): Empty images array");
        return
    }

    const w = images[0].bitmap.width;
    const h = images[0].bitmap.height;

    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            let pixels = images.reduce((arr, image) => {
                arr.push(image.getPixelColor(x, y));
                return arr;
            }, []);
            proc(pixels, x, y);
        }
}

function isCorrectTile(image) {

    let blackPixelsCount = 0;

    eachPixel([image], pixels => {
        let color = Jimp.intToRGBA(pixels[0]);
        if (color.r + color.g + color.b < 10)
            blackPixelsCount++;
    });

    return blackPixelsCount < 512 * 512 * 0.01;
}

async function noCloudTile(x, y, z, days) {
    let tile = new Jimp(512, 512, 0x000000ff);
    let daysInterval = days.split('-');
    let nearDay = daysInterval[0];
    let farDay = daysInterval[1];

    let imagePromises = new Array(farDay - nearDay).fill(null).map((_, i) => {
        let date = new Date();
        date.setDate(date.getDate() - i - nearDay);
        let formatedDate = format.asString('yyyy-MM-dd', date);

        return loadTile(x, y, z, formatedDate)
    });

    const images = await Promise.all(imagePromises);
    const correctData = images.filter(a => isCorrectTile(a.image));
    
    console.log("noCloudTile(): Correct ", correctData.length, " tiles out of ", images.length);

    eachPixel(correctData.map(a => a.image), (pixels, x, y) => {

        let colors = pixels.map(p => {
            let color = Jimp.intToRGBA(p);
            return [color.r, color.g, color.b];
        });

        let avg = mathjs.min(colors, 0);
        tile.setPixelColor(Jimp.rgbaToInt(avg[0], avg[1], avg[2], 255), x, y);
    });

    return tile;
}

module.exports = {
    loadTile,
    extractClouds,
    noCloudTile
};