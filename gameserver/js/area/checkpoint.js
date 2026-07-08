//import Utils from '../utils.js';
import Area from './area.js';

class Checkpoint extends Area {
    constructor(map, id, x, y, width, height) {
        super(map, id, x, y, width, height);
    }

    isValidPosition(x, y) {
        return this.map && this.map.isValidPosition(x, y);
    }
}

export default Checkpoint;
