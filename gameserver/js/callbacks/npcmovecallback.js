import Messages from '../message.js';

class NpcMoveCallback {
    constructor() {
    }

    setCallbacks(entity) {
        //const self = entity;
        //console.info("assigning callbacks to "+self.entity.id);

        entity.onStep(function (entity, x, y) {
            //console.info("onStep = " + x + "," + y);
            try {
                this.map.entities.entitygrid[this.y][this.x] = 0;
                this.map.entities.entitygrid[y][x] = 1;
            }
            catch (e)
            {
                console.info(e.stack);
                console.info(this.x + "," + this.y + "," + x + "," + y);
                console.info(this.id);
                console.info(this.path);
                console.info(this.step);
            }
        });

        entity.onRequestPath(function (x,y) {
            const path = this.map.entities.findPath(this, x, y);
            //console.info("path="+JSON.stringify(path));
            if (path && path.length > 0)
            {
                const msg = new Messages.MovePath(this, path);
                this.map.entities.sendNeighbours(this, msg);
                return path;
            }
            return null;
        });
    }
}

export default NpcMoveCallback;
