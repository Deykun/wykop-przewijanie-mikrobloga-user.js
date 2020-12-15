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

// Możesz nieinwazynie zmienić klawisz przewijający stronę:
// - w konsoli wpisz localStorage.setItem('ssPrevious', 'k') 
// - po odświeżeniu zmieni przewijanie z domyślnego b na k
// robiąc to w taki sposób zmiany nie zostaną stracone po aktualizacji dodatku :)

const keysActions = {
  previous: localStorage.getItem('ssPrevious') || 'b',
  next: localStorage.getItem('ssNext') || 'n',
}

const scrollSelectors = {
  newEntryForm: '#commentForm',
  entry: '#itemsStream > .entry',
  pages: '.pager',
};

const appendCSS = styles => {
  const style = document.createElement('style')
  style.innerHTML = styles
  document.head.append(style)
}

$(document).ready(function () {
  var navHeight = $('#nav').height(),
      bodyHeight = $('body').height(),
      elements = [];

  appendCSS(`
    html {
      scroll-behavior: smooth;
    }
  `);

  function calcElementsY() {
    elementsY = [];
    navHeight = $('#nav').height();
    bodyHeight = $('body').height();

    const selectedElements = Object.values(scrollSelectors).reduce((stack, selector) => {
      const selectorElements = Array.from(document.querySelectorAll(selector));
      
      return [...stack, ...selectorElements];
    }, []);

    const bodyScrollY = window.scrollY;    
    elements = selectedElements.map(el => ({
      el: el,
      y: el.getBoundingClientRect().top + bodyScrollY,
    })).sort((a, b) => a.y - b.y);
  };
  calcElementsY();


  function smartScrollTo(direction = 'next') {
    // Strona doładywuje wpisy po pewnym czasie
    if (bodyHeight !== $('body').height()) { calcElementsY(); }

    var y = window.pageYOffset;

    const nextIndex = elements.findIndex(el => el.y > y + navHeight + 1);

    if (direction === 'previous') {
      if (nextIndex > 1) {
        const previousElY = elements[nextIndex - 2].y;
        window.scrollTo(0, previousElY - navHeight);
      } else {
        // TOP
        window.scrollTo(0, 0);
      }

      return;
    }

    if (direction === 'next') {
      if (nextIndex <= elements.length) {
        const nextElY = elements[nextIndex].y;
        window.scrollTo(0, nextElY - navHeight);
      } else {
        // BOTTOM
      }

      return;
    }


  }

  $(document).on('keyup', (e)=> {
      const triggerTagName = e.target.tagName.toLowerCase();
      const userIsTyping = triggerTagName === 'input' || triggerTagName === 'textarea';
      if (!userIsTyping) {
        switch (e.key) {
          case keysActions.next:
            smartScrollTo('next');
            break;
          case keysActions.previous:
            smartScrollTo('previous');
            break;
        }
      }
  });
});
