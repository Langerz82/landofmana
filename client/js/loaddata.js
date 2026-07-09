// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class LoadData {
    constructor() {
        const self = this;

        this.loaded = false;
        this.tilesets = [];

        // Manifest Example
        const manifest = {
            bundles: [
                {
                    name: 'tilesets',
                    assets: [
                        {
                            name: 'ts-1-0',
                            srcs: 'img/common/tilesets/ts-1-0.png',
                        },
                        {
                            name: 'ts-1-1',
                            srcs: 'img/common/tilesets/ts-1-1.png',
                        },
                        {
                            name: 'ts-1-2',
                            srcs: 'img/common/tilesets/ts-1-2.png',
                        },
                        {
                            name: 'ts-1-3',
                            srcs: 'img/common/tilesets/ts-1-3.png',
                        },
                        {
                            name: 'ts-1-4',
                            srcs: 'img/common/tilesets/ts-1-4.png',
                        },
                        {
                            name: 'ts-1-5',
                            srcs: 'img/common/tilesets/ts-1-5.png',
                        },
                        {
                            name: 'ts-1-6',
                            srcs: 'img/common/tilesets/ts-1-6.png',
                        },
                        {
                            name: 'ts-1-7',
                            srcs: 'img/common/tilesets/ts-1-7.png',
                        },
                        {
                            name: 'ts-1-8',
                            srcs: 'img/common/tilesets/ts-1-8.png',
                        }
                    ],
                },
            ]
        };

        const loader = new PIXI.Loader();

        //const init = async function () { await Asset.init({ manifest }); };

        // Load a bundle...
        //const fnTilesets = async function() { await Assets.loadBundle('tilesets'); };

        //init();
        //fnTilesets();

        /*loader.add('ts-1-0', 'img/common/tilesets/ts-1-0.png');
        loader.add('ts-1-1', 'img/common/tilesets/ts-1-1.png');
        loader.add('ts-1-2', 'img/common/tilesets/ts-1-2.png');
        loader.add('ts-1-3', 'img/common/tilesets/ts-1-3.png');
        loader.add('ts-1-4', 'img/common/tilesets/ts-1-4.png');
        loader.add('ts-1-5', 'img/common/tilesets/ts-1-5.png');
        loader.add('ts-1-6', 'img/common/tilesets/ts-1-6.png');
        loader.add('ts-1-7', 'img/common/tilesets/ts-1-7.png');
        loader.add('ts-1-8', 'img/common/tilesets/ts-1-8.png');*/

        loader.add('ts-1-1', 'img/common/ts-1-1.png');
        loader.add('ts-1-2', 'img/common/ts-1-2.png');
        //loader.add('ts-1-3', 'img/common/ts-1-3.png');
        //loader.add('ts-1-4', 'img/common/ts-1-4.png');


        //loader.add('KomikaHand', 'fonts/KOMIKAH.TTF');
        loader.load(function(loader, resources) {
            self.tilesets = [
                //resources['ts-1-0'].texture,
                resources['ts-1-1'].texture,
                resources['ts-1-2'].texture,
                //resources['ts-1-3'].texture,
                //resources['ts-1-4'].texture,
                /*resources['ts-1-5'].texture,
                resources['ts-1-6'].texture,
                resources['ts-1-7'].texture,
                resources['ts-1-8'].texture*/
            ];
        });
        loader.onComplete.add(() => { self.loaded = true; })
    }
}
