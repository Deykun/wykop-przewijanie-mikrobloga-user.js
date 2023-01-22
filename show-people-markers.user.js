// ==UserScript==
// @name        Znacznik użytkowników dla Wykop.pl
// @namespace   http://www.wykop.pl/ludzie/Deykun
// @description Pokazuje ikonkę przy osobach które blokujemy/obserwujemy/obserwują nas na wykop.
// @author      Deykun
// @version     2.00
// @include     https://wykop.pl*
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

const fetchVoters = async ({ 
  entryId,
  commentId,
}) => {
  if (!entryId && !commentId) {
    return [];
  }

  const token = localStorage.getItem('token');

  if (!commentId) {
    const { data } = await fetch(`/api/v3/entries/${entryId}/votes`, {
      'headers': {
          'Authorization': `Bearer ${token}`,
      },
    }).then((response) => response.json());

    return data;
  }

  const { data } = await fetch(`/api/v3/entries/${entryId}/comments/${commentId}/votes`, {
    'headers': {
        'Authorization': `Bearer ${token}`,
    },
  }).then((response) => response.json());

  return data;
}

const getElIdForAPI = (el) => {
  if (!el) {
    return;
  }

  const htmlID = el.getAttribute('id');

  return htmlID ? htmlID.replace('comment-', '') : undefined;
}

const setLinksForAllVoters = async (el) => {
  console.log('el', el);
  const entryCommentEl = el.closest('.entry.reply');
  const votesEl = el.closest('.entry-voters');
  const entryEl = entryCommentEl ? entryCommentEl.parentNode.closest('.entry') : el.closest('.entry');

  const entryId = getElIdForAPI(entryEl);
  const commentId = getElIdForAPI(entryCommentEl);

  votesEl.setAttribute('data-entry-id', entryId);
  if (commentId) {
    votesEl.setAttribute('data-comment-id', commentId);
  }

  const voters = await fetchVoters({ entryId, commentId });

  const hasFetchedVoters = voters.length > 0;
  if (!hasFetchedVoters) {
    return;
  }

  setTimeout(() => {
    // They don't have links
    const rawVotesEl = votesEl.querySelector('.raw');

    if (rawVotesEl) {
      const firstUsernameToReplace = document.querySelector('.raw').innerText.split(',')[0];

      if (firstUsernameToReplace) {
        const mapVotesFromIndex = voters.findIndex(({ username }) => username === firstUsernameToReplace);
        const votersGenerated = voters.slice(mapVotesFromIndex);
        const isLastForIndex = votersGenerated.length - 1;

        const newRawInnerHTML = votersGenerated.reduce((stack, voter, index) => {
          const isLast = isLastForIndex === index;
          const { username, color, status } = voter;
          const itemHTML = `<li style="display: inline-block;">
            <a href="/ludzie/${username}" class="username ${color}-profile ${status}">
              <span>${username}</span>${isLast ? '' : ','}
            </a>&nbsp;
          </li>`;

          stack += itemHTML;

          return stack;
        }, '');

        rawVotesEl.innerHTML = newRawInnerHTML;
      }
    }

    console.log('voters', voters);
  }, 1500);
}

const fetchUsername = async () => {
  const token = localStorage.getItem('token');
  const { data: { username } } = await fetch('/api/v3/profile', {
    'headers': {
        'Authorization': `Bearer ${token}`,
    },
  }).then((response) => response.json());

  return username;
}

const fetchUsers = async ({ url } = {}) => {
  const token = localStorage.getItem('token');
  let page = 1;
  let end = false;

  let users = [];

  do {
      const { data, pagination } = await fetch(`${url}?page=${page}`, {
        'headers': {
            'Authorization': `Bearer ${token}`,
        },
      }).then((response) => response.json());

      users = users.concat(data.map(({ username }) => username));

      if (data.length === 0 || pagination.total <= users.length) {
        end = true;
      }

      page++;
  } while (!end);

  return users;
};

const fetchAndCachePeople = async () => {
    console.info('Pobieranie osób do znaczników osób');
    const currentTimestamp = (new Date()).getTime();
    const username = await fetchUsername();
    const followers = await fetchUsers({ url: `https://wykop.pl/api/v3/profile/users/${username}/observed/users/followers` });
    const followed = await fetchUsers({ url: `https://wykop.pl/api/v3/profile/users/${username}/observed/users/following` });
    const blacklisted = await fetchUsers({ url: `https://wykop.pl/api/v3/settings/blacklists/users` });

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
      '.username span',
    ];

    Array.from(document.querySelectorAll(nickSelectors.join(', '))).forEach((el) => {
        const username = el.innerText.replace('@', '').trim();

        const isFollower = followers.includes(username);
        const isFollowed = followed.includes(username);
        const isBlacklisted = blacklisted.includes(username);

        if (isFollower) {
          if (!el.classList.contains('spm-follower')) {
            el.classList.add('spm-label');
            el.classList.add('spm-follower');
          }
        }

        if (isFollowed) {
          if (!el.classList.contains('spm-followed')) {
            el.classList.add('spm-label');
            el.classList.add('spm-followed');
          }
        }

        if (isBlacklisted) {
          if (!el.classList.contains('spm-blacklisted')) {
            el.classList.add('spm-label');
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

domReady(async () => {
  const token = localStorage.getItem('token');
  const isLoggedIn = Boolean(token)
  if (!isLoggedIn) {
    return;
  }

  appendCSS(`
      /* Kolorowe plusy */
      a.username span {
        color: inherit !important;
      }

      .spm-label {
        position: relative;
      }
  
      .spm-label::before {
        position: absolute;
        bottom: calc(100% + 2px);
        z-index: 2;
        right: 8px;
        padding: 5px 8px;
        white-space: nowrap;
        font-size: 10px;
        line-height: 10px;
        letter-spacing: 0.04em;
        font-weight: 600;
        border-radius: 10px;
        border-bottom-right-radius: 0;
        color: black;
        background-color: #a4ccf7;
        opacity: 0;
        transform: translateY(50%);
        transition: all 0.3s ease-in-out;
        pointer-events: none;
      }

      .spm-label:hover::before {
        transform: translateY(0);
        opacity: 1;
      }

      section.stream > .content > ul li a {
        text-overflow: initial !important;
        width: 100%;
      }

      .users-stream li .spm-label::before,
      .link-block .tooltip-slot .spm-label::before {
        right: auto;
        left: calc(100% + 2px);
        bottom: 0;
        border-radius: 10px;
      }

      .spm-label::after {
        height: 16px;
        width: 16px;
        display: inline-block;
        text-align: center;
        background-color: green;
        border-radius: 8px;
        font-size: 9px;
        font-weight: 400;
        text-indent: -1px;
        line-height: 16px;
        margin-left: 4px;
        vertical-align: middle;
      }

      .spm-follower::after {
        color: black;
        background-color: #b5e1b5;
      }

      .spm-followed::after {
        color: white;
        background-color: #769876;
      }

      .spm-follower.spm-followed::after {
        color: black;
        background-color: #5ac95a;
      }

      .spm-blacklisted::after {
        background-color: #b0adad;
        color: #370909;
      }

      .spm-blacklisted::before { content: 'blokujesz'; }
      .spm-blacklisted::after { content: '✗'; }

      .spm-follower::before { content: 'obserwuje Cię'; }
      .spm-follower::after { content: '✔'; }

      .spm-followed::before { content: 'obserwujesz'; }
      .spm-followed::after { content: '✔'; }
  
      .spm-follower.spm-followed::before { content: 'obserwujecie się'; }
      .spm-blacklisted.spm-follower::before { content: 'zablokowany obserwujący'; }
  `);

  let people = await getPeople();

  setMarkers(people);

  let debouncedSetMarkers = debounce(() => setMarkers(people), 500);

  if (typeof ResizeObserver === 'function') {
    const resizeObserver = new ResizeObserver(debouncedSetMarkers);
    resizeObserver.observe(document.body);
  }

  const observer = new MutationObserver(debouncedSetMarkers);
  var config = {
      childList: true,
      subtree: true
  };
  observer.observe(document.body, config);

  document.body.addEventListener('click', (event) => {
    if (event.target.closest('.entry-voters .more')) {
      setLinksForAllVoters(event.target);
    }

    const resetCacheSelectors = [
      '[title="Zablokuj użytkownika"] button', // zablokuj
      '[title="Odblokuj użytkownika"] button', // odblokuj
      '[title="Dodaj do obserwowanych"] button', // obserwuj
      '[title="Przestań obserwować"] button', // przestań obserwować
    ];

    if (event.target.closest(resetCacheSelectors.join(', '))) {  
      Array.from(document.querySelectorAll('.spm-label')).forEach((el) => {
        el.classList.remove('spm-label');
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
