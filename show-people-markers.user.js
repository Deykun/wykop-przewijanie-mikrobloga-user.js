// ==UserScript==
// @name        Znacznik użytkowników dla Wykop.pl
// @namespace   http://www.wykop.pl/ludzie/Deykun
// @description Pokazuje ikonkę przy osobach które blokujemy/obserwujemy/obserwują nas na wykop.
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

const fetchAndCachePeople = (username) => {
    console.info('Pobieranie osób do znaczników osób');
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
        const MINUTE_MS = 60 * 1000;

        const hasNotExpiredCache = lastUpdate && (currentTimestamp - lastUpdate) < 1 * MINUTE_MS;

        if (hasNotExpiredCache) {
            return cache;
        }
    }

  return fetchAndCachePeople(username);
}

const setMarkers = ({
  followers = [],
  followed = [],
  blacklisted = [],
} = {}) => {

    const nickSelectors = [
      '.voters-list .link', // plusy na mikroblogu
      '.showProfileSummary b', // w komentarzach/wpisach
      '.user-profile .folContainer h2 > span', // na profilu
      '.article .fix-tagline [class*="color-"]', // w lini tagów znaleziska
      '.usercard a span b', // autora znaleziska
      '.related .ellipsis a:first-child', // w powiązanych
    ];

    Array.from(document.querySelectorAll(nickSelectors.join(', '))).forEach((el) => {
        const username = el.innerText.replace('@', '').trim();

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
        @keyframes scaleInSPM {
          0% {
              transform: scale(0);
              opacity: 0;
          }

          95% {
            transform: scale(1.1);
          }
      
          100% {
              transform: scale(1);
              opacity: 1;
          }
      }

      .votersContainer .voters-list {
        text-align: left;
      }

      .spm-followed::after,
      .spm-follower::after,
      .spm-blacklisted::after {
        content: '✓';
        display: inline-block;
        border-radius: 15px;
        margin-left: 3px;
        padding: 0 5px;
        min-width: 16px;
        max-width: 16px;
        height: 15px;
        color: white;
        vertical-align: sub;
        line-height: 15px;
        font-size: 9px;
        font-weight: 400;
        transition: .1s ease-in-out;
        white-space: nowrap;
        overflow: hidden;

        animation: scaleInSPM .3s forwards;
      }

      .spm-followed:hover::after,
      .spm-follower:hover::after,
      .spm-blacklisted:hover::after {
        max-width: 200px;
      }

      .spm-blacklisted:hover::after {
        content: '✘ blokujesz';
      }

      .spm-follower:hover::after {
        content: '✓ obserwuje';
      }

      .spm-followed:hover::after {
        content: '✓ obserwujesz';
      }

      .spm-follower.spm-followed:hover::after {
        content: '✓ obserwuje (i -sz)';
      }

      .spm-blacklisted.spm-follower:hover::after {
        content: '✘ zablokowany obserwujący';
      }

      .spm-blacklisted::after {
        content: '✘';
        background-color: #b0adad;
        color: #370909;
      }
      
      .spm-follower::after {
        color: black;
        background-color: #73e273;
      }

      .spm-followed::after {
        background-color: #02ce02;
      }

      .spm-follower.spm-followed::after {
        background-color: #02ce02;
      }

      .user-profile .folContainer h2 > span::after {
        vertical-align: middle;
      }
    `);

    const username = document.querySelector('.logged-user .avatar').getAttribute('alt');

    let people = getPeople(username);

    setMarkers(people);

    let debouncedSetMarkers = debounce(() => setMarkers(people), 500);

    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(debouncedSetMarkers);
      resizeObserver.observe(document.body);
    }

    document.body.addEventListener('click', (event) => {
      if (event.target.closest('.showVoters')) {
        setTimeout(debouncedSetMarkers, 500);
      }


      const resetCacheSelectors = [
        '[data-ajaxurl*="/block/"]', // zablokuj
        '[data-ajaxurl*="/unblock/"]', // odblokuj
        '[data-ajaxurl*="/observe/"]', // obserwuj
        '[data-ajaxurl*="/unobserve/"]', // przestań obserwować
      ];

      if (event.target.closest(resetCacheSelectors.join(', '))) {
        const labelsSelectors = [
          '.spm-follower',
          '.spm-followed',
          '.spm-blacklisted',
        ];
    
        Array.from(document.querySelectorAll(labelsSelectors.join(', '))).forEach((el) => {
          el.classList.remove('spm-follower');
          el.classList.remove('spm-followed');
          el.classList.remove('spm-blacklisted');
        });

        setTimeout(() => {
          people = fetchAndCachePeople(username);

          debouncedSetMarkers = debounce(() => setMarkers(people), 500);

          debouncedSetMarkers();
        }, 1500);
      }
    });
});
