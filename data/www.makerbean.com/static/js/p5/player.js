var p5functions = [ 'preload', 'setup','draw','keyPressed','keyReleased','keyTyped','mouseMoved','mouseDragged','mousePressed','mouseReleased','mouseClicked','touchStarted','touchMoved','touchEnded'];

var editor;
var activeSketch;

// adapted from p5js.org, originally by Lauren McCarthy
// https://github.com/processing/p5.js-website/blob/master/js/render.js
var playCode = function(code) {
  var runnable = code;
  var _p5 = p5;

  var s = function( p ) {
        
    if (runnable.indexOf('setup()') === -1 && runnable.indexOf('draw()') === -1){
      p.setup = function() {
        p.createCanvas(window.innerWidth, window.innerHeight);
        with (p) {
          // eval(runnable+myLibraries);
          eval(runnable);
        }
      }
    }
    else {
      with (p) {
        eval(runnable+myLibraries);
        // eval(runnable);
      }
      
      var fxns = p5functions;
      fxns.forEach(function(f) {
            
        if (runnable.indexOf("function "+f+"()") !== -1) {
          with (p) {
            p[f] = eval(f);
          }
        }
      });
      
      if (typeof p.setup === 'undefined') {
        console.log('no setup');
        p.setup = function() {
        p.createCanvas(window.innerWidth, window.innerHeight);
        }
      }
    }
  
  };
  
  
  //avoid duplicate canvases
  $( "#p5Canvas" ).empty();
  
  // //clear registered methods
  // for (var member in activeSketch._registeredMethods) delete activeSketch._registeredMethods[member];
  
  // activeSketch._registeredMethods = { pre: [], post: [], remove: [] };

  var myp5 = new _p5(s, p5Canvas);

  if(!activeSketch == undefined){
    activeSketch.remove();
  }
  
  activeSketch = myp5;
    
};

function playEditor() {
  playCode(editor.getValue());
};


function startMain() {        
  activeSketch = new p5("", p5Canvas);
};

