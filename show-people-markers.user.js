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

    const selectors = [
      '.voters-list .link', // plusy na mikroblogu
      '.showProfileSummary b', // nicki w komentarzach
    ];

    Array.from(document.querySelectorAll(selectors.join(', '))).forEach((el) => {
        const username = el.innerText.trim();

        const isFollower = followers.includes(username);
        const isFollowed = followed.includes(username);

        if (isFollower) {
          if (!el.classList.contains('spm-follower')) {
            el.classList.add('spm-follower');
          }
        }

        if (isFollowed) {
          if (!el.classList.contains('spm-followed')) {
            el.classList.add('spm-followed');
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
      .spm-followed::after,
      .spm-follower::after {
        content: '✓';
        display: inline-block;
        text-align: center;
        border-radius: 15px;
        margin-left: 3px;
        border: 1px solid #06b206;
        color: white;
        padding: 0 3px;
        min-width: 15px;
        max-width: 15px;
        height: 15px;
        vertical-align: sub;
        line-height: 13px;
        font-size: 9px;
        transition: .3s ease-in-out;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .spm-followed:hover::after,
      .spm-follower:hover::after {
        max-width: 100px;
      }

      .spm-follower:hover::after {
        content: '✓ obserwujący';
      }

      .spm-followed:hover::after {
        content: '✓ obserwowany';
      }

      .spm-follower.spm-followed:hover::after {
        content: '✓ obserwujący/any';
      }
      
      .spm-follower::after {
        color: #06b206;
      }

      .spm-followed::after {
        color: white;
        background-color: #06b206;
      }
    `);

    const username = document.querySelector('.logged-user .avatar').getAttribute('alt');

    const people = getPeople(username);

    setMarkers(people);

    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(() => setMarkers(people));
      resizeObserver.observe(document.body);
    }

    document.body.addEventListener('click', (event) => {
      if (event.target.closest('.showVoters')) {
        setTimeout(() => setMarkers(people), 1000);
      }
    });
});
