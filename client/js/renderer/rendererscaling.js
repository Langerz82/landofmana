// Mixin extracted from renderer.js: Zoom/scale/layout math: calcScreenSize, getGameZoom/getGuiZoom, rescale/centerStage/guiResize/resizeCanvases, camera<->screen offset helpers, tile grid scroll offsets.
// Applied onto Renderer.prototype via install*(...) call in renderer.js; not a standalone class.
/* global G_TILESIZE, log */

export function installRendererScaling(proto) {
    proto.calcScreenSize = function (zoomMod) {
        this.gameZoom = this.getGameZoom(zoomMod);
        this.gameWidth = window.innerWidth;
        this.gameHeight = window.innerHeight;
        this.innerWidth = ~~(this.gameWidth * this.gameZoom);
        this.innerHeight = ~~(this.gameHeight * this.gameZoom);
    };

    proto.getScaleFactor = function () {
        return 3;
    };

    proto.getUiScaleFactor = function () {
        return 3;
    };

    proto.getIconScaleFactor = function () {
        return 3;
    };

    proto.getGuiZoom = function () {
        const w = window.innerWidth,
            h = window.innerHeight;

        let zoom = 1;

        if (this.mobile) {
            zoom *= 0.75;
        } else if (this.tablet) {
            zoom *= 1;
        } else {
            if ((w < 500 && h < 1000) || (w < 1000 && h < 500)) zoom *= 0.75;
            else if (w <= 1500 || h <= 870) zoom *= 1;
            else zoom *= 1.25;
        }
        return zoom;
    };

    proto.getGameZoom = function (zoomMod) {
        zoomMod = zoomMod || 1;
        const w = window.innerWidth,
            h = window.innerHeight;

        let zoom = 1;

        if (this.mobile) {
            zoom *= 1.2;
        } else if (this.tablet) {
            zoom *= 0.9;
        } else {
            if ((w < 500 && h < 1000) || (w < 1000 && h < 500)) zoom *= 1.2;
            else if (w <= 1500 || h <= 870) zoom *= 0.9;
            else zoom *= 0.8;
        }
        return zoom * zoomMod;
    };

    proto.rescale = function () {
        this.scale = this.getScaleFactor();

        this.initFPS();

        if (this.game.ready && this.game.renderer) {
            this.game.inventory.scale = this.getUiScaleFactor();
        }

        this.renderer.resize(this.innerWidth, this.innerHeight);
        this.renderer.resolution = 1;
    };

    proto.centerStage = function () {
        const zoom = 1 / this.gameZoom;
        const rw = ~~this.renderer.width;
        const rh = ~~this.renderer.height;

        // FIX: width/height were passed as "Npx !important" through jQuery's .css(), which
        // sets them via elem.style[prop] = value - assigning a value containing "!important"
        // that way is invalid per CSSOM and the browser silently drops the whole declaration,
        // so #canvas's box was never actually resized to match the renderer's buffer size.
        // Also missing transform-origin: with the default "50% 50%", scaling a box whose
        // actual (stale) size didn't match rw/rh pushed the canvas off-center and partially
        // off-screen instead of scaling from the top-left corner where left/top:0 assumed it
        // would. #gui (styled in main.css) already sets transform-origin: top left for the
        // same reason - #canvas needs it too.
        this.canvas.css({
            left: '0px',
            top: '0px',
            width: rw + 'px',
            height: rh + 'px',
            transformOrigin: 'top left',
            transform: 'scale(' + zoom + ')'
        });
    };

    proto.guiResize = function () {
        const guizoom = this.getGuiZoom();

        const w = Math.round($(window).width() / guizoom);
        const h = Math.round($(window).height() / guizoom);

        this.gui.width = w;
        this.gui.height = h;
        this.gui.style.width = w + 'px';
        this.gui.style.height = h + 'px';
        log.debug('#gui set to ' + this.gui.width + ' x ' + this.gui.height);

        this.gui.style.transform = 'scale(' + guizoom + ')';
    };

    proto.resizeCanvases = function (zoomMod) {
        zoomMod = zoomMod || 1;

        this.calcScreenSize(zoomMod);

        this.guiResize();

        this.rescale();
        this.centerStage();

        this.camera.rescale();
        this.camera.setRealCoords();

        this.forceRedraw = true;
    };

    proto.getEntityOffset = function () {
        const cv = this.getCameraView();
        const c = game.camera;
        return [cv[0], cv[1]];
    };

    proto.getScreenOffset = function () {
        const c = this.camera;
        const gs = this.gameScale;
        const cv = this.getCameraView();

        return [cv[0] + c.wOffX, cv[1] + c.wOffY];
    };

    proto.getCameraView = function () {
        const c = this.camera;

        const x = -c.x;
        const y = -c.y;

        return [x, y];
    };

    proto.setGridOffset = function () {
        const c = this.camera;
        const fe = c.focusEntity;
        if (!fe) return;

        const gx = fe.x >> 4;
        const gy = fe.y >> 4;

        this.sox = fe.x % G_TILESIZE;
        this.soy = fe.y % G_TILESIZE;

        /*if (this.sox != this.sox2 || this.soy != this.soy2)
      {
        console.error("NOT EQUAL");
      }*/

        if (!c.scrollX) this.sox = 0;
        if (!c.scrollY) this.soy = 0;

        return [this.sox, this.soy];
    };

    proto.setTilesOffset = function (x, y) {
        const c = game.camera,
            gs = this.gameScale;

        x = -x;
        y = -y;

        const mx = Math.abs(c.rx - c.sx);
        const my = Math.abs(c.ry - c.sy);

        let offX = -c.wOffX;
        let offY = -c.wOffY;

        if (c.rx < c.sx) {
            offX = Math.min(offX + mx, 0);
        }
        if (c.ry < c.sy) {
            offY = Math.min(offY + my, 0);
        }
        if (c.rx > c.sx) {
            const max = -c.wOffX * 2;
            offX = Math.max(offX - mx, max);
        }
        if (c.ry > c.sy) {
            const max = -c.wOffY * 2;
            offY = Math.max(offY - my, max);
        }

        x += offX;
        y += offY;

        this.hOffX = x;
        this.hOffY = y;

        x *= gs;
        y *= gs;

        Container.BACKGROUND.x = x;
        Container.BACKGROUND.y = y;
        Container.FOREGROUND.x = x;
        Container.FOREGROUND.y = y;
    };
}
