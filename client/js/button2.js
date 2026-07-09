// Converted from AMD (define) + Class.extend to a native ES6 module/class.
function isUndefined(value) {
    return (typeof value) === 'undefined';
}

function isObject(value) {
    return (typeof value) === 'object';
}

function assign(target, source1, source2, items) {
    let index, item;
    for (index = 0; index < items.length; index++) {
        item = items[index];
        if (isObject(source1) && !isUndefined(source1[item])) {
            target[item] = source1[item];
        } else if (isObject(source2) && !isUndefined(source2[item])) {
            target[item] = source2[item];
        }
    }
}

function indexOf(array_, value, default_) {
    const result = array_.indexOf(value);
    return result >= 0 ? result : default_;
}

export default class Button2 {
    // kind - normal: 0, disabled: 1, downed: 2, overed: 3, blinked: 4
    constructor(id, configure) {
        this.id = id + "button";
        this.id2 = id + "text";
        this.background = {}
        assign(this.background, configure.background, Button2.configure.background, ['left', 'top', 'width']);
        this.kinds = isObject(configure.kinds) ? configure.kinds : (isObject(Button2.configure.kinds) ? Button2.configure.kinds : [0]);
        this.visible = isUndefined(configure.visible) ? true : configure.visible;
        this.enabled = isUndefined(configure.enabled) ? true : configure.enabled;
        this.downed = isUndefined(configure.downed) ? false : configure.downed;
        this.overed = false;
        this.blinked = false;
        this.blinkFlag = false;
        this.blinkHandle = null;
        this.body = $(this.id);
        this.bodytext = $(this.id2);
        /*this.body.css('display', this.visible ? 'inline-block' : 'none');*/
        this.kind = -1;
        this.clickHandler = null;

        this.refresh();

        this.body.bind('click', function(event) {
            if (this.enabled && this.clickHandler) {
                this.clickHandler(this, event);
            }
            //event.preventDefault();
            //event.stopPropagation();
            //return false;
        }.bind(this));
        this.bodytext.bind('click', function(event) {
            if (this.enabled && this.clickHandler) {
                this.clickHandler(this, event);
            }
            //event.preventDefault();
            //event.stopPropagation();
            //return false;
        }.bind(this));

        if (this.kinds.indexOf(3) >= 0) {
            this.body.unbind('mouseover').bind('mouseover', function(event) {
                this.overed = true;
                this.refresh();
            }.bind(this));
            this.body.unbind('mouseout').bind('mouseout', function(event) {
                this.overed = false;
                this.refresh();
            }.bind(this));
        }
    }

    /*setImage(image) {
    	if (this.body) {
    		this.body.css('background-image', 'url=("'+image+') !important');
    	}
    },*/

    setBackground(background) {
        this.background = background;
        this.kind = this.kind ? this.kind : 0;
        this.setBackgroundPosition(this.kind);
    }

    getBackgroundPosition(kind) {
        const left = isUndefined(this.background.left) ? 0 : this.background.left,
            top = isUndefined(this.background.top) ? 0 : this.background.top,
            width = isUndefined(this.background.width) ? 25 : this.background.width,
            index = indexOf(this.kinds, kind, 0);
        return '-' + (left + (width * index)) + 'px -' + (top) + 'px';
    }

    setBackgroundPosition(kind) {
        this.kind = kind;
        this.body.css('background-position', this.getBackgroundPosition(kind));
    }

    refresh() {
        if (this.visible) {
            this.setBackgroundPosition(this.enabled ? (this.overed ? 3 : (this.downed ? 2 : (this.blinked ? (this.blinkFlag ? 4 : 0) : 0))) : 1);
        }
    }

    show() {
        this.visible = true;
        this.body.show();
    }

    hide() {
        this.visible = false;
        this.body.hide();
    }

    enable() {
        this.enabled = true;
        this.refresh();
    }

    disable() {
        if (this.blinked) {
            this.blink(false);
        }

        this.enabled = false;
        this.refresh();
    }

    down() {
        this.downed = true;
        if (this.enabled) {
            this.refresh();
        }
    }

    up() {
        this.downed = false;
        if (this.enabled) {
            this.refresh();
        }
    }

    blink(flag) {
        if (this.enabled) {
            if (flag) {
                if ((this.kinds.indexOf(4) >= 0) && !this.blinked) {
                    this.blinkFlag = false;
                    this.blinkHandle = setInterval(function() {
                        this.blinkFlag = !this.blinkFlag;
                        this.refresh();
                    }.bind(this), 500);
                    this.blinked = true;
                }
            } else {
                if (this.blinked) {
                    clearInterval(this.blinkHandle);
                    this.blinkHandle = null;
                    this.blinked = false;
                    this.refresh();
                }
            }
        }
    }

    onClick(handler) {
        this.clickHandler = handler;
    }
}
Button2.configure = {};
