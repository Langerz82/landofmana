// Converted from AMD (define) + Class.extend to a native ES6 module/class.
class TabButton {
    constructor(id, page) {
        var self = this;
        this.id = id;
        this.body = $(id);
        this.page = page;

        this.visibleChangeHandler = null;


        this.body.on('click', function(event) {
            if (self.page.parent.parent.showing)
              self.page.active();
        });
    }

    getVisible() {
        return this.body.attr('class') === 'active';
    }
    setVisible(value) {
        var self = this;
        if(value) {
            this.body.addClass('active');
        } else {
            this.body.removeClass('active');
        }
    }
}

export default class TabPage {
    constructor(parent, id, buttonId) {
        this.parent;
        this.id = id;
        this.body = $(id);
        this.button = buttonId ? new TabButton(buttonId, this) : null;

        this.activeHandler = null;
    }

    getParent() {
        return this.parent;
    }
    setParent(value) {
        this.parent = value;
    }
    getVisible() {
        return this.body.css('display') === 'block';
    }
    setVisible(value) {
        if(this.button) {
            this.button.setVisible(value);
        }
        this.body.css('display', value ? 'block' : 'none');

        if(this.visibleChangeHandler) {
            this.visibleChangeHandler(self, value);
        }
    }

    active() {
        if(this.parent) {
            this.parent.setActivePage(this);
        }
    }

    onVisibleChange(handler) {
        this.visibleChangeHandler = handler;
    }
}
