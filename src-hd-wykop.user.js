// ==UserScript==
// @name        Obrazki HD dla Wykop.pl
// @namespace   http://www.wykop.pl/ludzie/Deykun
// @description Obrazki w serwisie mają większą rozdzielczość przez co lepiej wyglądają na większych monitorach.
// @author      Deykun
// @version     1.00
// @include     htt*.wykop.pl/*
// @grant       none
// @run-at			document-end
// ==/UserScript==

// Możesz nieinwazynie zmienić skalowanie wybranych obrazów
// - w konsoli wpisz localStorage.setItem('whd-w400', '1600')
// - po odświeżeniu zmieni się rozdzielczość obrazków - wykop nie wspiera wszystkich skalowań więc zwykle serwuje orginalne zdjęcia
// robiąc toWidth w taki sposób zmiany nie zostaną stracone po aktualizacji dodatku :)

const scaleOptions = [
  {
    name: 'entryImage',
    selector: 'img[src*=",w400"], img[data-original*=",w400"]',
    patternWidth: ',w400.',
    width: 400,
    toWidth: localStorage.getItem('whd-w400') || 800,
  },
  {
    name: 'profile150',
    selector: 'img[src*=",q150"], img[data-original*=",q150"]',
    patternWidth: ',q150.',
    width: 150,
    toWidth: localStorage.getItem('whd-q150') || 300,
  },
  {
    name: 'profile48',
    selector: 'img[src*=",q48."], img[data-original*=",q48."]',
    patternWidth: ',q48',
    width: 48,
    toWidth: localStorage.getItem('whd-q48') || 96,
  },
  {
    name: 'profile48',
    selector: 'img[src*=",q40."], img[data-original*=",q40."]',
    patternWidth: ',q40',
    width: 40,
    toWidth: localStorage.getItem('whd-q40') || 80,
  },
  {
    name: 'profile30',
    selector: 'img[src*=",q30."], img[data-original*=",q30."]',
    patternWidth: ',q30',
    width: 30,
    toWidth: localStorage.getItem('whd-q30') || 60,
  },
  {
    name: 'link207',
    selector: 'img[src*=",w207"], img[data-original*=",w207"]',
    patternWidth: ',w207',
    width: 207,
    height: 139,
    toWidth: localStorage.getItem('whd-w207') || 407,
  },
  {
    name: 'link113',
    selector: 'img[src*=",w113"], img[data-original*=",w113"]',
    patternWidth: ',w113',
    width: 113,
    height: 64,
    toWidth: localStorage.getItem('whd-w113') || 226,
  }
];

const appendCSS = (styles, { id = '' } = {} ) => {
  const style = document.createElement('style')
  style.innerHTML = styles
  if (id) {
    style.id = id;
  }
  document.head.append(style)
}

const getElementHeight = selector => {
  const el = document.querySelector(selector);

  return el ? parseFloat(getComputedStyle(el, null).height.replace('px', '')) : 0;
}

const debounce = (fn, time) => {
  let timeoutHandler;

  return (...args) => {
    clearTimeout(timeoutHandler);
    timeoutHandler = setTimeout(() => {
      fn(...args)
    }, time);
  }
}

const domReady = fn => {
  document.addEventListener('DOMContentLoaded', fn);
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    fn();
  }
}

domReady(() => {
    appendCSS(`
      @keyframes hdImgLoader {
        0%, 100% {
          background-position: 0% 0%;
          background-size: 100% 100%;
        }
        50% {
          background-size: 200% 10%;
          background-position: 50% -25%;
        }
        75% {
          background-position: 100% 100%;
          background-size: 250% 450%;
        }
      }
    `);

    (scaleOptions).forEach(({ selector, width, height, toWidth }) => {
      const newSelector = selector.replace(width, toWidth);

      appendCSS(`
        ${newSelector} {
          width: 100%;
          max-width: ${width}px;
          ${height && `
            height: ${height}px;
            object-fit: cover;
            background-color: #ddd;
          `}
          font-size: 12px;
          line-height: 20px;
          text-align: center;
          line-height: 1.5em;
          color: white;
          animation: hdImgLoader 15s infinite ease-in-out;
          background-image: repeating-linear-gradient(90deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 1px, rgba(135, 135, 135, 0.06) 1px, rgba(135, 135, 135, 0.06) 6px), repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 1px, rgba(135, 135, 135, 0.06) 1px, rgba(135, 135, 135, 0.06) 6px), repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 1px, rgba(135, 135, 135, 0.06) 1px, rgba(135, 135, 135, 0.06) 18px), repeating-linear-gradient(90deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 1px, rgba(135, 135, 135, 0.06) 1px, rgba(135, 135, 135, 0.06) 18px), linear-gradient(90deg, rgb(190, 196, 199), rgb(236, 240, 241))
        }
      `, { id: `script-img-hd-w-${width}-tW-${toWidth}` });
    });

  function rescale() {
    (scaleOptions).forEach(({ selector, width, toWidth, patternWidth }) => {
      const elements = Array.from(document.querySelectorAll(selector));
      const newpatternWidth = patternWidth.replace(width, toWidth);

      elements.forEach((el) => {
        const lazySrc = el.dataset.original;
        const isLazyLoaded = Boolean(lazySrc);

        if (isLazyLoaded) {
          el.dataset.original = lazySrc.replace(patternWidth, newpatternWidth);
        }
        el.src = el.src.replace(patternWidth, newpatternWidth);
      })
    });
  };
  rescale();

  if (typeof ResizeObserver === 'function' && 1 === 2) {
    const resizeObserver = new ResizeObserver(() => rescale());
    resizeObserver.observe(document.body);
  } else {
    // scroll based fallback
    let bodyHeight = getElementHeight('body');

    document.addEventListener('scroll', debounce(() => {
      const didBodyHeightChange = bodyHeight !== getElementHeight('body');
      if (didBodyHeightChange) {
        bodyHeight = getElementHeight('body');
        rescale();
      }
    }, 50));
  }
});
