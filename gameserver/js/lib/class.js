
// NOTE: this file is dead code -- nothing in the codebase imports it anymore
// (grep for "class.js" / "Class.extend" turns up only comments in other
// files noting where the old pattern used to be, e.g. entity/block.js,
// items/itemroom.js, packets/packethandler.js, ws.js). It has also been
// superseded by native ES6 classes throughout entity/, ws.js, etc.
// It's left in place only for historical reference; it is not safe to use
// as-is even if someone tries to revive it:
//   - `Class = function() {};` below assigns to an undeclared global. ES
//     modules are always strict mode, and strict mode throws a
//     ReferenceError on assignment to an undeclared identifier -- so simply
//     importing this file (`import './lib/class.js'`) would crash immediately.
//   - `Class.extend = arguments.callee` further down also throws in strict
//     mode (`arguments.callee` is disallowed).
// Recommend deleting this file outright once you've confirmed nothing
// external depends on it; kept here untouched for now since removing files
// wasn't requested.
/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
let initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;

// The base Class implementation (does nothing)
Class = function() {};

// Create a new Class that inherits from this class
Class.extend = function(prop) {
    const _super = this.prototype;
    
    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    const prototype = new this();
    initializing = false;
    
    // Copy the properties over onto the new prototype
    for (const name in prop) {
        // Check if we're overwriting an existing function
        prototype[name] = typeof prop[name] === "function" &&
            typeof _super[name] === "function" && fnTest.test(prop[name]) ?
            (function(name, fn){
                return function() {
                    const tmp = this._super;
                   
                    // Add a new ._super() method that is the same method
                    // but on the super-class
                    this._super = _super[name];
                   
                    // The method only need to be bound temporarily, so we
                    // remove it when we're done executing
                    const ret = fn.apply(this, arguments);
                    this._super = tmp;
                   
                    return ret;
                };
            })(name, prop[name]) :
            prop[name];
    }
    
    // The dummy class constructor
    Class = function () {
        // All construction is actually done in the init method
        if ( !initializing && this.init )
            this.init.apply(this, arguments);
    }
    
    // Populate our constructed prototype object
    Class.prototype = prototype;
    
    // Enforce the constructor to be what we expect
    Class.constructor = Class;
    
    // And make this class extendable
    Class.extend = arguments.callee;
    
    return Class;
};

if(!(typeof exports === 'undefined')) {
    exports.Class = Class;
}

