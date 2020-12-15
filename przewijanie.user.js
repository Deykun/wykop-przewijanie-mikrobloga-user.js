// ==UserScript==
// @name        Przewijanie mikrobloga
// @namespace   http://www.wykop.pl/ludzie/Deykun
// @description Dodaje możliwość przewjania wpisów na mikroblogu. Klawisze B i N przewijają stronę.
// @author      Deykun
// @version     1.10
// @include     htt*.wykop.pl/mikroblog/*
// @grant       none
// @run-at			document-end
// ==/UserScript==

const scrollSelectors = {
  newEntryForm: '#commentForm',
  entry: '#itemsStream > .entry',
  pages: '.pager',
};

$(document).ready(function () {
  var $elements = $('#commentForm, div[data-type="entry"][data-id]:not(.media-content), .pager'),
      navHeight = $('#nav').height(),
      bodyHeight = $('body').height(),
      elementsY = [];

  $('body').append('<div style="position:fixed; width: 30px; height:30px; left: 0; top:'+(navHeight+70)+'px; left:5px; z-index:10;"> <button id="next"><i class="fa fa-chevron-down"></i></button></div>');

  function calcElementsY() {
    elementsY = [];
    navHeight = $('#nav').height();
    bodyHeight = $('body').height();

    const elements = Object.values(scrollSelectors).reduce((stack, selector) => {
      const selectorElements = Array.from(document.querySelectorAll(selector));
      
      return [...stack, ...selectorElements];
    }, []);

    const bodyScrollTop = window.scrollY;
    elementsY = elements.map(element => (element.getBoundingClientRect().top + bodyScrollTop));

    $('#next').css('top', (navHeight+60));
  };
  calcElementsY();


  function nextEntry(direction) {
    // Strona doładywuje wpisy po pewnym czasie
    if (bodyHeight !== $('body').height()) { calcElementsY(); }

    var y = window.pageYOffset;

    for (var i = 1, imax = elementsY.length; i < imax ; i++) {
      if (elementsY[i] > y+navHeight+1) {
        var distanceScroll = $elements.eq(i).offset().top-navHeight;
        if (direction === 'before') {
          if (i !== 0 && i !== 1) {
            distanceScroll = $elements.eq(i-2).offset().top-navHeight;
          } else {
            distanceScroll = y;
          }
        }

        var timeScroll = 800,
            diffScroll = (y-distanceScroll);

        if (diffScroll < 500) { timeScroll = 400; }
        else if (diffScroll > 1500) { timeScroll = 1200; }

        $('html, body').animate({
            scrollTop: distanceScroll
        }, timeScroll);
        break;
      }
    }
  }

  $(document).on('keyup', (e)=> {
      var ktrigger = e.target.tagName.toLowerCase();
      if (ktrigger != 'input' && ktrigger != 'textarea') {
        switch (e.which) {
          case 78:
            nextEntry();
            break;
          case 66:
            nextEntry('before');
            break;
        }
      }
  });

  $('#next').on('click', nextEntry);
});
