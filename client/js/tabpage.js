// Converted from AMD (define) + Class.extend to a native ES6 module/class.
class TabButton {
    constructor(id, page) {
        const self = this;
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
        const self = this;
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
            // FIX: referenced undeclared `self` (only TabButton.setVisible has a `self`
            // local; this is TabPage.setVisible) - would throw ReferenceError the moment
            // any caller registered a handler via onVisibleChange(). Use `this`.
            this.visibleChangeHandler(this, value);
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
