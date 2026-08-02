// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class PageNavigator {
    constructor(parent, scale, name) {
        this.parent = parent;
        this.name = name || 'store';
        this.jqBody = $('#' + this.name + 'PageNav');
        this.jqMovePreviousButton = $('#' + this.name + 'PageNavPrev');
        this.jqNumbers = [];
        for (let index = 0; index < 5; index++) {
            this.jqNumbers.push($('#' + this.name + 'PageNavNumber' + index));
        }
        this.jqMoveNextButton = $('#' + this.name + 'PageNavNext');

        this.changeHandler = null;

        this.rescale(scale);

        const self = this;

        this.jqMovePreviousButton.click(function (event) {
            if (!self.parent.visible) return;

            if (self.index > 1) {
                self.setIndex(self.index - 1);
            }
        });
        this.jqMoveNextButton.click(function (event) {
            if (!self.parent.visible) return;

            if (self.index < self.count) {
                self.setIndex(self.index + 1);
            }
        });
    }

    rescale(scale) {}

    getCount() {
        return this.count;
    }
    setCount(value) {
        this.count = value;

        this.jqNumbers[3].html(~~(value / 10));
        this.jqNumbers[4].html(value % 10);
    }
    getIndex() {
        return this.index;
    }
    setIndex(value) {
        this.pageChanged = this.index !== value;
        this.index = value;

        this.jqNumbers[0].html(~~(value / 10));
        this.jqNumbers[1].html(value % 10);

        this.jqMovePreviousButton.attr(
            'class',
            this.index > 1 ? 'enabled' : ''
        );
        this.jqMoveNextButton.attr(
            'class',
            this.index < this.count ? 'enabled' : ''
        );

        if (this.pageChanged && this.changeHandler) {
            this.changeHandler(this);
        }
    }
    getVisible() {
        return this.jqBody.css('display') === 'block';
    }
    setVisible(value) {
        this.jqBody.css('display', value ? 'block' : 'none');
    }

    onChange(handler) {
        this.changeHandler = handler;
    }

    open() {
        this.setIndex(1);
        this.setVisible(this.index < this.count);
    }
}
