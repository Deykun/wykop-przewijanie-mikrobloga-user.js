// ==UserScript==
// @name        Znacznik użytkowników dla Wykop.pl
// @namespace   http://www.wykop.pl/ludzie/Deykun
// @description Pokazuje ikonkę przy osobach które blokujemy/obserwujemy/obserwują nas na wykop.
// @author      Deykun
// @version     2.2
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

const authorByEntryId = {};
const authorByCommentId = {};

const getEntryDataFromEl = (el) => {
  const entryCommentEl = el.closest('.entry.reply');
  const votesEl = el.closest('.entry-voters');
  const entryEl = entryCommentEl ? entryCommentEl.parentNode.closest('.entry') : el.closest('.entry');

  const entryId = getElIdForAPI(entryEl);
  const commentId = getElIdForAPI(entryCommentEl);

  let entryAuthor = authorByEntryId[entryId];
  if (entryEl) {
    entryAuthor = entryEl.querySelector('header .username span')?.innerText?.trim();

    authorByEntryId[entryId] = entryAuthor;
  }

  let commentAuthor = authorByCommentId[commentId];
  if (entryCommentEl && entryEl) {
    commentAuthor = entryCommentEl.querySelector('header .username span')?.innerText?.trim();

    authorByCommentId[commentId] = commentAuthor;
  }

  if (entryId) {
    votesEl.setAttribute('data-entry-id', entryId);
  }

  if (commentId) {
    votesEl.setAttribute('data-comment-id', commentId);
  }

  return {
    votesEl,
    entryId,
    entryAuthor,
    commentId,
    commentAuthor,
  };
}

const setLinksForAllVoters = async (el) => {
  const {
    votesEl,
    entryId,
    commentId,
  } = getEntryDataFromEl(el);

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

        const newRawHTML = votersGenerated.reduce((stack, voter, index) => {
          const isLast = isLastForIndex === index;
          const { username, color, status } = voter;
          const itemHTML = `<li style="display: inline-block;">
            <a href="/ludzie/${username}" class="username ${color}-profile ${status}"
            ><span>${username}</span></a>${isLast ? '' : ','}&nbsp;
          </li>`;

          stack += itemHTML;

          return stack;
        }, '');

        rawVotesEl.outerHTML = newRawHTML;
      }
    }
  }, 2000);
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

      const newUsers = data.map(({ username }) => username).filter(username => !users.includes(username));

      users = users.concat(newUsers);

      const { per_page, total } = pagination;

      const areAllPageFetched = page >= Math.ceil(total / per_page);

      if (data.length === 0 || areAllPageFetched) {
        end = true;
      }

      page++;
  } while (!end);

  return users;
};

const fetchAndCachePeople = async () => {
    console.info('Pobieranie osób do znaczników osób do dodatków');

    const currentTimestamp = (new Date()).getTime();
    const username = await fetchUsername();
    const followers = await fetchUsers({ url: `https://wykop.pl/api/v3/profile/users/${username}/observed/users/followers` });
    const followed = await fetchUsers({ url: `https://wykop.pl/api/v3/profile/users/${username}/observed/users/following` });
    const blacklisted = await fetchUsers({ url: `https://wykop.pl/api/v3/settings/blacklists/users` });

    const newCache = {
        lastUpdate: currentTimestamp,
        you: username,
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

const removeMarkers = () => {
  Array.from(document.querySelectorAll('.spm-label')).forEach((el) => {
    el.classList.remove('spm-label');
    el.classList.remove('spm-follower');
    el.classList.remove('spm-followed');
    el.classList.remove('spm-blacklisted');
  });
}

const getMarkerDataForUser = ({
  isYou,
  isFollower,
  isFollowed,
  isBlacklisted,
  isEntryAuthor,
  isIsEntryOrEntryComment,
}) => {
  let icon = '';
  const labelParts = [];
  const classesToAdd = [];
  const classesToRemove = ['spm-label', 'spm-you', 'spm-op', 'spm-blacklisted', 'spm-follower', 'spm-followed'];

  if (isFollower && isFollowed) {
    labelParts.push('obserwujecie się');
    icon = '✔';
    classesToAdd.push('spm-follower', 'spm-followed');
    classesToRemove.filter((className) => ['spm-follower', 'spm-followed'].includes(className));
  } else {
    if (isFollower) {
      labelParts.push('obserwuje Cię');
      icon = '✔';
      classesToAdd.push('spm-follower');
      classesToRemove.filter((className) => className === 'spm-follower');
    }

    if (isFollowed) {
      labelParts.push('obserwujesz');
      icon = '✔';
      classesToAdd.push('spm-followed');
      classesToRemove.filter((className) => className === 'spm-followed');
    }
  }

  if (isBlacklisted) {
    labelParts.push('blokujesz');
    icon = '✗';
    classesToAdd.push('spm-blacklisted');
    classesToRemove.filter((className) => className === 'spm-blacklisted');
  }

  // isIsEntryOrEntryComment only in long list of voters
  if (isIsEntryOrEntryComment && isYou) {
    labelParts.push('ty');
    icon = '❤';
    classesToAdd.push('spm-you');
    classesToRemove.filter((className) => className === 'spm-you');
  }

  if (isEntryAuthor) {
    labelParts.push('autor wpisu');
    icon = 'OP';
    classesToAdd.push('spm-op');
    classesToRemove.filter((className) => className === 'spm-op');
  }

  if (classesToAdd.length > 0) {
    classesToAdd.push('spm-label');
    classesToRemove.filter((className) => className === 'spm-label');
  }

  return {
    label: labelParts.join(' - '),
    icon,
    classesToAdd,
    classesToRemove,
  }
}

const setMarkers = ({
  you,
  followers = [],
  followed = [],
  blacklisted = [],
} = {}) => {
  const nickSelectors = [
    '.username span',
  ];

  Array.from(document.querySelectorAll(nickSelectors.join(', '))).forEach((el) => {
    const elVotersEntry = el.closest('.entry-voters');
    const isIsEntryOrEntryComment = Boolean(elVotersEntry);
    const username = el.innerText.replace('@', '').trim();
    const isYou = you === username;

    const isFollower = followers.includes(username);
    const isFollowed = followed.includes(username);
    const isBlacklisted = blacklisted.includes(username);

    let isEntryAuthor = false;
    if (isIsEntryOrEntryComment) {
      const { entryAuthor } = getEntryDataFromEl(el);

      isEntryAuthor = username === entryAuthor;
    }

    const {
      classesToAdd,
      classesToRemove,
      label,
      icon,
    } = getMarkerDataForUser({
      isYou,
      isFollower,
      isFollowed,
      isBlacklisted,
      isEntryAuthor,
      isIsEntryOrEntryComment,
    });

    if (classesToRemove.length > 0) {
      el.classList.remove(...classesToRemove);
    }

    if (classesToAdd.length > 0) {
      el.classList.add(...classesToAdd);
    }

    el.setAttribute('data-spm-label', label);
    el.setAttribute('data-spm-icon', icon);
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
        content: attr(data-spm-label);
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
        box-shadow: 0px 2px 3px -2px rgba(0,0,0,0.2);
        transform: translateY(50%) scale(0);
        transform-origin: right bottom;
        transition: all 0.15s ease-in-out;
        pointer-events: none;
      }

      .spm-label:hover::before {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      /* Active user icon */
      .spm-label i {
        position: static !important;
        vertical-align: middle !important;
        display: inline-block !important;
        transform: none !important;
        margin-left: 0.2em !important;
        margin-right: 0.1em !important;
        font-size: inherit !important;
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
        transform-origin: left center;
      }

      .spm-label::after {
        content: attr(data-spm-icon);
        height: 16px;
        width: 16px;
        display: inline-block;
        text-align: center;
        background-color: green;
        border-radius: 8px;
        font-size: 9px;
        font-weight: 400;
        line-height: 16px;
        margin-left: 4px;
        vertical-align: middle;

        el.setAttribute('data-spm-label', label);
        el.setAttribute('data-spm-icon', icon);
      }

      .spm-follower::before,
      .spm-follower::after {
        color: black;
        background-color: #b5e1b5;
      }

      .spm-followed::before,
      .spm-followed::after {
        color: white;
        background-color: #769876;
      }

      .spm-follower.spm-followed::before,
      .spm-follower.spm-followed::after {
        color: black;
        background-color: #5ac95a;
      }

      .spm-blacklisted::before,
      .spm-blacklisted::after {
        background-color: #e00606;
        color: #fff;
      }

      .spm-you::before,
      .spm-you::after {
        color: black;
        background-color: #c9a94a;
      }

      .spm-op::before,
      .spm-op::after {
        color: white;
        background-color: #847698;
      }

      .spm-op[data-spm-icon="OP"]::after {
        font-size: 7px;
        letter-spacing: 0.1em;
        font-weight: 600;
      }
  `);

  let people = await getPeople();

  setMarkers(people);

  let debouncedSetMarkers = debounce(() => setMarkers(people), 1000);

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
      removeMarkers();

      setTimeout(() => {
        people = fetchAndCachePeople(username);

        debouncedSetMarkers = debounce(() => setMarkers(people), 500);

        debouncedSetMarkers();
      }, 1500);
    }
  });
});
