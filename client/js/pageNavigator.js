define([], function() {
  var PageNavigator = Class.extend({
    init: function(parent, scale, name) {
        this.parent = parent;
        this.name = name || "store";
        this.body = $('#'+this.name+'PageNav');
        this.movePreviousButton = $('#'+this.name+'PageNavPrev');
        this.numbers = [];
        for(var index = 0; index < 5; index++) {
            this.numbers.push($('#'+this.name+'PageNavNumber' + index));
        }
        this.moveNextButton = $('#'+this.name+'PageNavNext');

        this.changeHandler = null;

        this.rescale(scale);

        var self = this;

        this.movePreviousButton.click(function(event) {
            if (!self.parent.visible)
              return;

            if(self.index > 1) {
                self.setIndex(self.index - 1);
            }
        });
        this.moveNextButton.click(function(event) {
            if (!self.parent.visible)
              return;

            if(self.index < self.count) {
                self.setIndex(self.index + 1);
            }
        });
    },

    rescale: function(scale) {
      for(var index = 0; index < this.numbers.length; index++) {
        this.numbers[index].css({
            'position': 'absolute',
            'left': '' + ((12*scale) + (index * 12 * scale)) + 'px',
            'top': '0px'
        });
      }
    },

    getCount: function() {
        return this.count;
    },
    setCount: function(value) {
        this.count = value;

        this.numbers[3].html(~~(value / 10))
        this.numbers[4].html((value % 10));
    },
    getIndex: function() {
        return this.index;
    },
    setIndex: function(value) {
        this.pageChanged = (this.index != value);
        this.index = value;

        this.numbers[0].html(~~(value / 10))
        this.numbers[1].html((value % 10));

        this.movePreviousButton.attr('class', this.index > 1 ? 'enabled' : '');
        this.moveNextButton.attr('class', this.index < this.count ? 'enabled' : '');

        if(this.pageChanged && this.changeHandler) {
            this.changeHandler(this);
        }
    },
    getVisible: function() {
        return this.body.css('display') === 'block';
    },
    setVisible: function(value) {
        this.body.css('display', value ? 'block' : 'none');
    },

    onChange: function(handler) {
        this.changeHandler = handler;
    },

    open: function() {
      this.setIndex(1);
      (this.index < this.count) ? this.setVisible(1) : this.setVisible();

    }

  });

  return PageNavigator;
});
