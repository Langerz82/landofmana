// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class LoadData {
    constructor() {
        const self = this;

        this.loaded = false;
        this.tilesets = [];

        const loader = new PIXI.Loader();

        loader.add('ts-1-1', 'img/common/ts-1-1.png');
        loader.add('ts-1-2', 'img/common/ts-1-2.png');

        loader.load(function(loader, resources) {
            self.tilesets = [
                resources['ts-1-1'].texture,
                resources['ts-1-2'].texture,
            ];
        });
        loader.onComplete.add(() => { self.loaded = true; })
    }
}
