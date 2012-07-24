/* Tipster.js
 * Michael Walker
 * https://github.com/lazerwalker/tipster-js
 * Licensed under the MIT License
 *
 * Yet another jQuery tooltip plugin.
 * To use: $(elem).tooltip(options);
 * See comments directly below and in the defaults declaration for information
 * on available options.
 *
 * ## Repositioning Elements
 * One design choices of this library is that tooltips are attached to the
 * document body, rather than than the element they are called on. As such, if a
 * DOM element is repositioned while it has a related tooltip, the tooltip won't
 * automatically move along with the element.
 *
 * All tooltips are set to automatically reposition themselves when the browser
 * window is resized. If you manually reposition elements that have
 * tooltips attached, you will want to trigger an 'updateTooltips' event on the
 * window after movement is complete:
 *
 *    $(window).trigger('updateTooltips');
 *
 * This will cause all tooltips to update their positions based on their
 * 'parent' elements.
 *
 *
 * ## Tooltip Types ##
 * There are four different types of tooltips you can create. They differ
 * only in how they are dismissed.
 *
 * 'standard': Dismissed by clicking anywhere or pressing any key.
 *
 * 'hover': Dismissed by a mouseleave event on the parent. You probably
 * want these to be created in response to a mouseover/mouseenter event.
 * If the 'canMouseIn' option is set to true, the user can move their mouse
 * from the parent into the tooltip
 *
 * 'important': Only dismissed when $.tooltip.closeImportant() is called.
 *
 * 'touch': Designed for touch devices. Dismissed when the user taps anywhere
 * on the screen, or triggers a second tooltip. Rather than manually
 * specifying this type,  you can set the 'touch' option to true. This way,
 * if your app supports both desktop and mobile interfaces, you can simply
 * define your tooltips for the desktop and pass in the touch flag as
 * appropriate to make all your tooltips touch-friendly sitewide.
 *
 *
 * ## Force Inside Bounds ##
 * When a tooltip is created, jquery.tooltip.js checks that it's within the
 * bounds of a wrapper element and shifts accordingly if not.
 * - To set this element, pass in a jQuery selector string as 'boundingElem'
 * - To use your own function, pass it in as the 'forceInsideBounts' option.
 *   Your function will be called after the tooltip has been rendered, with the
 *   tooltip's jQuery object passed in as the first argument.
 * - To skip entirely, set 'forceInsideBounds' to false.
*/

;(function($, window, undefined) {
  $.fn.tooltip = function(options)
  {
    var defaults = {
      // You can load your content either via an HTML attribute on the parent
      // element, or a raw HTML string.

      // If you want to load in content as pure HTML, pass it in here.
      // Accepts either an HTML string or function that returns an HTML string
      content: '',

      // If you want to load in content as an HTML attribute, set this to a
      // string containing the name of the attribute you want to read.
      // Any valid HTML attribute will work (e.g. 'title', 'data-tooltip')
      attribute: undefined,

      // Which side of the parent the tooltip appears on
      // 'top', 'bottom', 'left', or 'right'
      side: 'top',

      // Width and height of the tooltip, in px. Can also be 'auto'
      width: 'auto',      // In px, or 'auto'
      height: 'auto',     // In px, or 'auto'

      // How far away, in px, it will be from the parent element
      margin: 10,

      // See above
      type: 'standard',

      // If true, dismissing tooltips will be based on touch events rather than
      // hover/click events.
      touch: false,

      // If type is 'hover', this will allow the user to move their mouse
      // inside the tooltip without causing it to disappear
      canMouseIn: false,

      // Function to use to determine whether a tooltip needs to be manually
      // adjusted if its positioning doesn't meet certain criteria (see above)
      forceInsideBounds: forceInsideBounds,

      // jQuery selector for the bounding element to use, if you're using the
      // default forceInsideBounds function
      boundingElem: "body",

      // Callback functions
      onDestroy: function() {},
      onCreate: function() {}
    };

    var SIDES = {
      top: 0,
      right: 1,
      bottom: 2,
      left: 3
    };

    var TYPES = {
      standard: 0,
      hover: 1,
      important: 2,
      touch: 3
    }

    var opts = $.extend(defaults,options);

    opts.typeName = opts.type;
    opts.type = TYPES[opts.type];
    opts.sideName = opts.side;
    opts.side = SIDES[opts.side];

    if (opts.touch) {
      opts.type = TYPES.touch;
    }

    if (opts.height === 'auto' || !opts.height) {
      opts.autoHeight = true;
    }

    if (opts.width === 'auto' || !opts.width) {
      opts.autoWidth = true;
    }

    validateOptions(opts)

    var $parent,
      $elem,
      closeFn;

    function validateOptions(options) {
      function testForNumber(key) {
        if(Object.prototype.toString.call(options[key]) == '[object String]') {
          val = +options[key].replace(/px$/, '');
          if(val !== val) {
            throw "'" + options[key] + "' is not a valid " + key;
          }

          options[key] = val;
        }
      }

      if (options.type === undefined) {
        throw "Invalid tooltip type: " + options.typeName;
      } else if (options.side === undefined) {
        throw "Invalid side: " + options.sideName;
      }

      if (!opts.autoHeight) {
        testForNumber('height');
      }

      if (!opts.autoWidth) {
        testForNumber('width');
      }

      testForNumber('margin');

      return options;
    }

    function sharedCloseBehavior() {
        if (typeof opts.onDestroy === 'function') {
          opts.onDestroy();
        }

        $(window).off('resize updateTooltips', updatePosition);
    }

    function closeStandardTooltips() {
      $(".tooltip:not(.important, .hover)").remove();
      $(".hasTooltip:not(.hasImportantTooltip)")
        .removeClass("hasTooltip");

      if ($("div.tooltip:not(.important,.hover)").size() === 0) {
        $("body").off("click keyup",closeStandardTooltips);
      }

      sharedCloseBehavior()
    }

    function closeTouchTooltips() {
      $(".tooltip").remove();
      $(".hasTooltip").removeClass("hasTooltip");
      $("body").off("touchend", closeTouchTooltips);
      sharedCloseBehavior();
    }

    function closeHoverTooltips() {
      var _removeInactiveHoverTips = function() {
        $('div.tooltip.hover:not(.activeHover)').remove();
        $('.hasTooltip.hasHoverTooltip')
          .removeClass('hasTooltip hasHoverTooltip');

       sharedCloseBehavior();
      };

      /* The mouseout event for the parent fires before the mouseover
       * event for the tooltip. A brief timer ensures we don't kill
       * the tooltip while mousing between the parent and the tooltip. */
      setTimeout(_removeInactiveHoverTips, 100);
      $(this).off('mouseleave', closeHoverTooltips);
    }

    function setCloseFunction(e) {
      closeFn = closeStandardTooltips;
      switch(opts.type) {
        case TYPES.touch:
          /* On touch events, we remove all tooltips on every tap, so
           * we need to check for an existing tooltip before that */
          if ($parent.hasClass('hasTooltip')) {
            closeTouchTooltips();
            e.stopPropagation();
          }

          closeFn = closeTouchTooltips;
          closeTouchTooltips();
          break;
        case TYPES.hover:
          closeFn = closeHoverTooltips;
          break;
        case TYPES.important:
          closeFn = $.tooltip.closeImportant;
          break;
      }
      return closeFn;
    }

    /** Calculates tooltip positioning and returns a CSS object */
    function getPosition() {
      // TODO: This is a bad magic number that should be grabbed from CSS.
      var TAIL_SIZE = 12;

      var p = $.extend($parent.offset(), {
          height  : $parent.innerHeight(),
          width   : $parent.width()
        });

      var css = { width: opts.width };
      if (!opts.autoHeight) { css.height = opts.height; }
      if (!opts.autoWidth) { css.width = opts.width; }

      // Move the tooltip next to its parent
      switch(opts.side) {
        case SIDES.top:
          css.top  = p.top - (opts.height + TAIL_SIZE + opts.margin);
          css.left = p.left - (opts.width - p.width)/2;
          break;
        case SIDES.bottom:
          css.top = p.top + p.height + TAIL_SIZE + opts.margin;
          css.left = p.left - (opts.width - p.width)/2;
          break;
        case SIDES.left:
          css.left = p.left - (opts.width + TAIL_SIZE + opts.margin);
          css.top = p.top - (opts.height - p.height)/2;
          break;
        case SIDES.right:
          css.left = p.left + p.width + TAIL_SIZE + opts.margin;
          css.top = p.top - (opts.height - p.height)/2;
          break;
      }

      return css;
    }

    /** Triggers a manual recalculation of the tooltip's position */
    function updatePosition() {
      $elem.css(getPosition())
    }

    /** Creates the tooltip and adds it to the page */
    function renderTooltip() {
      var content;
      if (opts.attribute !== undefined &&
        $parent.attr(opts.attribute) !== undefined) {
          content = $parent.attr(opts.attribute);
      } else if(typeof opts.content === 'function') {
        content = opts.content();
      } else {
        content = opts.content;
      }

      $elem = $("<div class='tooltip " + opts.sideName + "'/>")
        .html(content)
        .css(getPosition())
        .append("<div class='tail'><div class='shadow'></div></div>")
        .appendTo('body');

      if (opts.className) {
        $elem.addClass(opts.className);
      }

      /* Because of our manual positioning, auto height/width requires
       * recalculating the position after the tooltip has been
       * inserted into the DOM. */
      if (opts.autoHeight) {
        opts.height = $elem.height();
        opts.autoHeight = false;
        updatePosition()
      }

      if (opts.autoWidth) {
        opts.width = $elem.width()
        opts.autoWidth = false;
        updatePosition()
      }

      if (typeof opts.forceInsideBounds === 'function') {
        opts.forceInsideBounds($elem);
      }

      if (typeof opts.onCreate === 'function') {
        opts.onCreate();
      }
    }

    /** Binds event handlers to close the tooltip, based on type */
    function bindEvents() {
      switch(opts.type) {
        case TYPES.standard:
          $("body").on('click keyup', closeFn);
          break;
        case TYPES.touch:
          $("body").on('touchend', closeFn);
          break;
        case TYPES.hover:
          $elem.addClass("hover");
          $parent.addClass('hasHoverTooltip');
          $parent.on('mouseleave', closeFn);

          if (opts.canMouseIn) {
            $elem.on('mouseenter mouseleave', function() {
              $elem.toggleClass("activeHover");
              closeFn();
            });
          }
          break;
        case TYPES.important:
          $elem.addClass("important");
          $parent.addClass('hasImportantTooltip');
          break;
      }

      $(window).on('resize updateTooltips', updatePosition);
    }

    /* Adjust the tooltip and tail position if it extends past the edge */
    function forceInsideBounds($elem) {
      var $tail = $elem.find('div.tail'),
        $bounds = $(opts.boundingElem),
        offset = $bounds.offset(),
        tailPos = $tail.position(),
        isVertical = (opts.side === SIDES.top || opts.side === SIDES.bottom),
        pos = $.extend($elem.position(), {   width: $elem.width(),
                           height: $elem.height() });

      var CSS = {},
        tailCSS = {},
        changed = false;

      // Right
      var rightDiff = ($bounds.outerWidth() + offset.left) - pos.left;
      if (rightDiff < pos.width) {
        CSS.left = pos.left + (rightDiff - pos.width);
        if (isVertical) {
          tailCSS.left = tailPos.left - (rightDiff - pos.width);
        }
        changed = true;
      }

      // Bottom
      var bottomDiff = ($bounds.outerHeight() + offset.top) -
        (pos.top + pos.height);
      if (bottomDiff < 0) {
        CSS.top = pos.top + (bottomDiff - 10);
        if (!isVertical) {
          tailCSS.top = tailPos.top - bottomDiff;
        }
        changed = true;
      }

      if (changed) {
        $elem.css(CSS);
        $tail.css(tailCSS);
      }
    }

    return this.each(function(e) {
      $parent = $(this);

      setCloseFunction(e);

      // If a tooltip already exists on this element, exit out
      if ($parent.hasClass('hasTooltip')) {
        closeFn();
        return this;
      }

      $parent.addClass('hasTooltip');
      renderTooltip();
      bindEvents();

      if(typeof opts.onCreate === 'function') {
        opts.onCreate(e);
      }

      return this;
    });
  };

  $.tooltip = {
    closeImportant: function() {
      $(".tooltip").remove();
      $(".hasTooltip.hasImportantTooltip")
        .removeClass("hasTooltip hasImportantTooltip");
    }
  };
})(jQuery, this);