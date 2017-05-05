// ==UserScript==
// @name        Przewijanie mikrobloga
// @description Dodaje możliwość przewjania wpisów.
// @version     1.00
// @include     htt*.wykop.pl/mikroblog/*
// @grant       none
// @run-at			document-end
// ==/UserScript==

$(document).ready(function () {
  var $entry = $('div[data-type="entry"][data-id]:not(.media-content)'),
      navHeight = $('#nav').height(),
      bodyHeight = $('body').height(),
      entryPos = [];

  $('body').append('<div style="position:fixed; width: 30px; height:30px; left: 0; top:'+(navHeight+70)+'px; left:5px; z-index:10;"> <button id="next"><i class="fa fa-chevron-down"></i></button></div>');

  function getY() {
    entryPos = [];
    navHeight = $('#nav').height();
    bodyHeight = $('body').height();

    $entry.each( function() {
      entryPos.push($(this).offset().top);
    });

    $('#next').css('top', (navHeight+60));
  };
  getY();


  $('#next').on('click', function (e) {
    // Strona doładywuje wpisy po pewnym czasie
    if (bodyHeight !== $('body').height()) { getY(); }

    var y = window.pageYOffset;

    for (var i = 1, imax = entryPos.length; i < imax ; i++) {
      if (entryPos[i] > y+navHeight+1) {
        var distanceScroll = $entry.eq(i).offset().top-navHeight,
            timeScroll = 800,
            diffScroll = (y-distanceScroll);

        if (diffScroll < 500) { timeScroll = 400; }
        else if (diffScroll > 1500) { timeScroll = 1200; }

        $('html, body').animate({
            scrollTop: distanceScroll
        }, timeScroll);
        break;
      }
    }
  });
});
