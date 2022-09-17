// ==UserScript==
// @name        Znacznik obserwowanych i obserwujący dla Wykop.pl
// @namespace   http://www.wykop.pl/ludzie/Deykun
// @description Pokazuje ikonkę przy osobach które obserwujemy/obserwują nas na wykop.
// @author      Deykun
// @version     1.00
// @include     htt*.wykop.pl/*
// @grant       none
// @run-at			document-end
// ==/UserScript==

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

// Stolen from https://userscripts-mirror.org/scripts/show/117457
const fetchPeople = (nick, type) => {
    let page = 1;
    let end = false;
    const people = [];

    do {
        $.ajax({
            method: 'GET',
            async: false,
            url: '/ludzie/' + type + '/' + nick + '/strona/' + page,
            success: (html) => {
                if ($('.usercard a b', html).length) {
                    $('.usercard a b', html).each(function () {
                        people.push($(this).text().trim());
                    });
                    if ((people.length % 75) > 0) end = true;
                } else end = true;
            },
            error: function (xhr) {
                console.log(xhr.status + ' ' + xhr.statusText);
                end = true;
            }
        });
        page++;
    } while (!end);

    return people;
}

const generateCache = (username) => {

    const currentTimestamp = (new Date()).getTime();
        const followers = fetchPeople(username, 'followers');
    const followed = fetchPeople(username, 'followed');

const newCache = {
    lastUpdate: currentTimestamp,
    followers,
    followed,
};

localStorage.setItem('spm-cache', JSON.stringify(newCache));

    return newCache;
}

const getPeople = (username) => {
    const currentTimestamp = (new Date()).getTime();
    const hasCache = Boolean(localStorage.getItem('spm-cache'));
    if (hasCache) {
        const cache = JSON.parse(localStorage.getItem('spm-cache')) || {};
        const { lastUpdate } = cache;

        const DAY_MS = 24 * 60 * 60 * 1000;

        const hasNotExpiredCache = lastUpdate && (currentTimestamp - lastUpdate) < 3 * DAY_MS;

        if (hasNotExpiredCache) {
            console.log('People from cache');
            return cache;
        }
    }

return generateCache();

}

const setMarkers = ({     followers,
    followed }) => {

    Array.from(document.querySelectorAll('.voters-list .link')).forEach((el) => {
      console.log(el);

        const username = el.innerText.trim();

        const isFollower = followers.includes(username);
        const isFollowed = followed.includes(username);

        if (isFollower) {
            if (!el.classList.contains('spm-follower')) {
el.classList.add('spm-follower');
            }
        }

                if (isFollowed) {
            if (!el.classList.contains('spm-follower')) {
el.classList.add('spm-follower');
            }
        }
    });
};

const domReady = fn => {
  document.addEventListener('DOMContentLoaded', fn);
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    fn();
  }
}

domReady(() => {
    const isLoggedIn = Boolean(document.querySelector('.logged-user'))
    if (!isLoggedIn) {
      return;
    }

    appendCSS(`
      .spm-followed,
      .spm-follower {
        position:relative;
      }

      .spm-followed::before,
      .spm-follower::before {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: green;
        padding: 2px 6px;
        border-radius: 15px;
        color: white;
        pointer-events: none;
        opacity: 0;
        transition: .3s ease-in-out;
      }

      .spm-followed:hover::before,
      .spm-follower:hover::before {
        opacity: 1;
      }

      .spm-followed::before {
        content: 'Obserwowany';
      }

      .spm-follower::before {
        content: 'Obserwujący';
      }

      .spm-followed.spm-follower::before {
        content: 'Obserwowany, Obserwujący';
      }

      .spm-followed::after,
      .spm-follower::after {
        content: '✓';
        display: inline-block;
        margin-left: 3px;
        background-color: green;
        color: white;
        width: 15px;
        height: 15px;
        vertical-align: middle;
        line-height: 15px;
        font-size: 10px;
        text-align: center;
        border-radius: 50%;
      }
    `);

    const username = document.querySelector('.logged-user .avatar').getAttribute('alt');

    const people = getPeople(username);

    setMarkers(people);
});
