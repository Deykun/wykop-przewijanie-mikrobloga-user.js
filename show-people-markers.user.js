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
const fetchPeopleByFollowStatus = (nick, type) => {
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

const fetchPeopleFromBlackList = () => {
  const people = [];

  $.ajax({
      method: 'GET',
      async: false,
      url: '/ustawienia/czarne-listy/',
      success: (html) => {
          if ($('[data-type="users"] a b', html).length) {
              $('[data-type="users"] a b', html).each(function () {
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

  return people;
}

const generateCache = (username) => {
    const currentTimestamp = (new Date()).getTime();
    const followers = fetchPeopleByFollowStatus(username, 'followers');
    const followed = fetchPeopleByFollowStatus(username, 'followed');
    const blacklisted = fetchPeopleFromBlackList();

    const newCache = {
        lastUpdate: currentTimestamp,
        followers,
        followed,
        blacklisted,
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

  return generateCache(username);
}

const setMarkers = ({
  followers = [],
  followed = [],
  blacklisted = [],
} = {}) => {

    const selectors = [
      '.voters-list .link', // plusy na mikroblogu
      '.showProfileSummary b', // nicki w komentarzach
    ];

    Array.from(document.querySelectorAll(selectors.join(', '))).forEach((el) => {
        const username = el.innerText.trim();

        const isFollower = followers.includes(username);
        const isFollowed = followed.includes(username);
        const isBlacklisted = blacklisted.includes(username);

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

        if (isBlacklisted) {
          if (!el.classList.contains('spm-blacklisted')) {
            el.classList.add('spm-blacklisted');
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
      .votersContainer .voters-list {
        text-align: left;
      }

      .spm-followed::after,
      .spm-follower::after,
      .spm-blacklisted::after {
        content: '✔';
        display: inline-block;
        border-radius: 15px;
        margin-left: 3px;
        border: 1px solid #06b206;
        padding: 0 4px;
        min-width: 16px;
        max-width: 16px;
        height: 15px;
        vertical-align: sub;
        line-height: 13px;
        font-size: 9px;
        font-weight: 400;
        transition: .1s ease-in-out;
        white-space: nowrap;
        overflow: hidden;
      }

      .spm-followed:hover::after,
      .spm-follower:hover::after,
      .spm-blacklisted:hover::after {
        max-width: 100px;
      }

      .spm-blacklisted:hover::after {
        content: '✘ blokujesz';
      }

      .spm-follower:hover::after {
        content: '✔ obserwuje';
      }

      .spm-followed:hover::after {
        content: '✔ obserwujesz';
      }

      .spm-follower.spm-followed:hover::after {
        content: '✔ obserwuje (i -sz)';
      }

      .spm-blacklisted::after {
        content: '✘';
        background-color: #b0adad;
        border-color: #b0adad;
        color: #602121;
      }
      
      .spm-follower::after {
        color: black;
        border-color: #91dd91;
        background-color: #91dd91;
      }

      .spm-followed::after {
        color: white;
        border-color: #06b206;
        background-color: #06b206;
      }

      .spm-follower.spm-followed::after {
        border-color: #067a06;
        background-color: #067a06;
      }
    `);

    const username = document.querySelector('.logged-user .avatar').getAttribute('alt');

    const people = getPeople(username);

    console.log(people);

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
