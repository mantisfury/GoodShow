const SEEDED_MOVIES = [
  {
    id: "movie-arrival",
    type: "movie",
    title: "Arrival",
    year: 2016,
    genres: ["Science Fiction", "Drama"],
    runtime: 116,
    image: "",
    summary: "A linguist works with the military to communicate with visitors whose arrival changes how humanity understands time."
  },
  {
    id: "movie-everything-everywhere",
    type: "movie",
    title: "Everything Everywhere All at Once",
    year: 2022,
    genres: ["Adventure", "Comedy"],
    runtime: 140,
    image: "",
    summary: "A laundromat owner is pulled into a multiverse crisis where family, regret, and possibility collide."
  },
  {
    id: "movie-moonlight",
    type: "movie",
    title: "Moonlight",
    year: 2016,
    genres: ["Drama"],
    runtime: 111,
    image: "",
    summary: "A quiet portrait of identity, intimacy, and survival across three defining chapters of one life."
  },
  {
    id: "movie-spider-verse",
    type: "movie",
    title: "Spider-Man: Into the Spider-Verse",
    year: 2018,
    genres: ["Animation", "Action"],
    runtime: 117,
    image: "",
    summary: "Miles Morales finds his footing as Spider-Man when heroes from other dimensions crash into his world."
  }
];

const STARTER_SHOWS = [
  {
    id: "seed-the-bear",
    providerId: 41734,
    source: "TVMaze",
    type: "show",
    title: "The Bear",
    year: 2022,
    genres: ["Drama", "Comedy"],
    runtime: 31,
    image: "",
    summary: "A chef returns home to run his family's sandwich shop and rebuild a kitchen under pressure."
  },
  {
    id: "seed-severance",
    providerId: 44933,
    source: "TVMaze",
    type: "show",
    title: "Severance",
    year: 2022,
    genres: ["Drama", "Science Fiction"],
    runtime: 50,
    image: "",
    summary: "Workers at Lumon split their office and personal memories, exposing the cost of a clean boundary."
  }
];

const STORAGE_KEY = "goodshow-library-v2";
const LEGACY_STORAGE_KEY = "goodshow-library-v1";
const watchingWithOptions = ["", "Self", "Spouse", "Partner", "Friend", "Coworker", "Other"];
const platformOptions = [
  "",
  "DVD",
  "Blu-ray",
  "Crunchyroll",
  "Netflix",
  "HBO Max",
  "Hulu",
  "Disney+",
  "Prime Video",
  "Apple TV",
  "Paramount+",
  "Peacock",
  "YouTube",
  "Library",
  "Other"
];
const shelves = ["watchlist", "watching", "completed", "paused"];
const shelfLabels = {
  watchlist: "Watchlist",
  watching: "Watching",
  completed: "Completed",
  paused: "Paused"
};

const state = {
  query: "",
  filter: "all",
  results: [...STARTER_SHOWS, ...SEEDED_MOVIES],
  library: loadLibrary()
};

const resultTemplate = document.querySelector("#resultCardTemplate");
const resultsGrid = document.querySelector("#resultsGrid");
const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const libraryList = document.querySelector("#libraryList");
const libraryFilter = document.querySelector("#libraryFilter");
const exportLibraryButton = document.querySelector("#exportLibrary");
const importLibraryInput = document.querySelector("#importLibrary");
const backupStatus = document.querySelector("#backupStatus");

function loadLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) ?? {};
    return Object.fromEntries(Object.entries(parsed).map(([id, item]) => [id, normalizeLibraryItem(id, item)]));
  } catch {
    return {};
  }
}

function saveLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.library));
}

function normalizeLibraryItem(id, item) {
  const providerId = item.providerId || (id.startsWith("tvmaze-") ? Number(id.replace("tvmaze-", "")) : undefined);
  return {
    ...item,
    providerId,
    watchingWith: item.watchingWith || "",
    watchingWithCustom: item.watchingWithCustom || "",
    platform: item.platform || "",
    platformCustom: item.platformCustom || "",
    watchedEpisodes: item.watchedEpisodes || [],
    episodes: item.episodes || []
  };
}

function setBackupStatus(message) {
  backupStatus.textContent = message;
}

function libraryBackupPayload() {
  return {
    app: "goodshow",
    version: 1,
    exportedAt: new Date().toISOString(),
    items: state.library
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseImportedLibrary(payload) {
  const items = payload?.app === "goodshow" && payload.items ? payload.items : payload;
  if (!items || typeof items !== "object" || Array.isArray(items)) {
    throw new Error("Import file does not look like a GoodShow library backup.");
  }

  return Object.fromEntries(Object.entries(items).map(([id, item]) => [id, normalizeLibraryItem(id, item)]));
}

function mergeLibraries(current, incoming) {
  const merged = { ...current };
  Object.entries(incoming).forEach(([id, incomingItem]) => {
    const existing = merged[id];
    if (!existing) {
      merged[id] = incomingItem;
      return;
    }

    merged[id] = {
      ...incomingItem,
      ...existing,
      watchedEpisodes: [...new Set([...(incomingItem.watchedEpisodes || []), ...(existing.watchedEpisodes || [])])],
      episodes: existing.episodes?.length ? existing.episodes : incomingItem.episodes || [],
      notes: existing.notes || incomingItem.notes || "",
      rating: existing.rating || incomingItem.rating || "",
      watchingWith: existing.watchingWith || incomingItem.watchingWith || "",
      watchingWithCustom: existing.watchingWithCustom || incomingItem.watchingWithCustom || "",
      platform: existing.platform || incomingItem.platform || "",
      platformCustom: existing.platformCustom || incomingItem.platformCustom || ""
    };
  });
  return merged;
}

function stripHtml(value = "") {
  const parser = new DOMParser();
  return parser.parseFromString(value, "text/html").body.textContent?.trim() || "";
}

function titleSource(item) {
  if (item.source) return item.source;
  return item.type === "movie" ? "Seeded" : "TVMaze";
}

function normalizeShow(result) {
  const show = result.show;
  const suggestedPlatform = show.webChannel?.name || show.network?.name || "";
  return {
    id: `tvmaze-${show.id}`,
    providerId: show.id,
    source: "TVMaze",
    suggestedPlatform,
    type: "show",
    title: show.name,
    year: show.premiered ? Number(show.premiered.slice(0, 4)) : "TBD",
    genres: show.genres?.length ? show.genres : ["Show"],
    runtime: show.averageRuntime || show.runtime || 45,
    image: show.image?.medium || show.image?.original || "",
    summary: stripHtml(show.summary) || "No summary available yet."
  };
}

function normalizeWikidataMovie(entity) {
  return {
    id: `wikidata-${entity.id}`,
    providerId: entity.id,
    source: "Wikidata",
    type: "movie",
    title: entity.label,
    year: "TBD",
    genres: ["Film"],
    runtime: 110,
    image: "",
    summary: entity.description
      ? `Wikidata: ${entity.description}.`
      : "Public Wikidata film entry. Details are intentionally lightweight."
  };
}

async function searchWikidataMovies(query) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&limit=12`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const payload = await response.json();
  const movieLike = payload.search.filter((entity) => {
    const description = (entity.description || "").toLowerCase();
    return description.includes("film") || description.includes("movie");
  });
  return (movieLike.length ? movieLike : payload.search).slice(0, 8).map(normalizeWikidataMovie);
}

async function searchTitles(query) {
  const normalizedQuery = query.toLowerCase();
  const seededMovies = SEEDED_MOVIES.filter((movie) => {
    const text = `${movie.title} ${movie.genres.join(" ")}`.toLowerCase();
    return text.includes(normalizedQuery);
  });

  let showMatches = [];
  let movieMatches = seededMovies;

  if (query.trim().length > 1) {
    try {
      const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        showMatches = (await response.json()).slice(0, 8).map(normalizeShow);
      }
    } catch {
      showMatches = STARTER_SHOWS.filter((show) => show.title.toLowerCase().includes(normalizedQuery));
    }

    try {
      const wikidataMovies = await searchWikidataMovies(query);
      movieMatches = wikidataMovies.length ? wikidataMovies : seededMovies;
    } catch {
      movieMatches = seededMovies;
    }
  }

  const combined = [...showMatches, ...movieMatches];
  return combined.length ? combined : [...STARTER_SHOWS, ...SEEDED_MOVIES];
}

async function fetchEpisodes(item) {
  if (item.type !== "show" || !item.providerId) return [];

  try {
    const response = await fetch(`https://api.tvmaze.com/shows/${item.providerId}/episodes`);
    if (!response.ok) return [];
    return (await response.json()).map((episode) => ({
      id: `tvmaze-episode-${episode.id}`,
      season: episode.season,
      number: episode.number,
      title: episode.name,
      airdate: episode.airdate || ""
    }));
  } catch {
    return [];
  }
}

function renderResults() {
  const visible = state.results.filter((item) => state.filter === "all" || item.type === state.filter);
  resultsGrid.innerHTML = "";

  if (!visible.length) {
    resultsGrid.innerHTML = `<div class="empty-state">No titles match this filter yet.</div>`;
    return;
  }

  visible.forEach((item) => {
    const card = resultTemplate.content.firstElementChild.cloneNode(true);
    const poster = card.querySelector(".poster");
    const kicker = card.querySelector(".card-kicker");
    const title = card.querySelector("h3");
    const meta = card.querySelector(".meta");
    const summary = card.querySelector(".summary");

    if (item.image) {
      poster.style.backgroundImage = `url("${item.image}")`;
    } else {
      poster.classList.add("placeholder");
      poster.textContent = item.title.slice(0, 1);
    }

    kicker.textContent = `${item.type === "show" ? "TV show" : "Movie"} - ${titleSource(item)}`;
    title.textContent = item.title;
    meta.textContent = `${item.year} - ${item.genres.slice(0, 2).join(", ")} - ${item.runtime} min`;
    summary.textContent = item.summary;

    card.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => addToLibrary(item, button.dataset.action));
    });

    resultsGrid.append(card);
  });
}

async function addToLibrary(item, shelf) {
  const existing = state.library[item.id] || {};
  state.library[item.id] = {
    ...existing,
    ...item,
    shelf,
    rating: existing.rating || "",
    notes: existing.notes || "",
    watchingWith: existing.watchingWith || "",
    watchingWithCustom: existing.watchingWithCustom || "",
    platform: existing.platform || item.suggestedPlatform || "",
    platformCustom: existing.platformCustom || "",
    watchedEpisodes: existing.watchedEpisodes || [],
    episodes: existing.episodes || [],
    addedAt: existing.addedAt || new Date().toISOString()
  };
  saveLibrary();
  renderLibrary();
  renderStats();

  if (item.type === "show" && !state.library[item.id].episodes.length) {
    state.library[item.id].episodes = await fetchEpisodes(item);
    saveLibrary();
    renderLibrary();
    renderStats();
  }
}

function createFieldLabel(text, control) {
  const label = document.createElement("label");
  label.className = "field-label";
  label.append(text, control);
  return label;
}

function createWatchingWithControls(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "watching-with";

  const select = document.createElement("select");
  select.dataset.field = "watchingWith";
  select.setAttribute("aria-label", `Watching with for ${item.title}`);
  watchingWithOptions.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue || "Watching with...";
    option.selected = item.watchingWith === optionValue;
    select.append(option);
  });

  const custom = document.createElement("input");
  custom.dataset.field = "watchingWithCustom";
  custom.type = "text";
  custom.placeholder = "Custom person or group";
  custom.value = item.watchingWithCustom || "";
  custom.hidden = item.watchingWith !== "Other";
  custom.setAttribute("aria-label", `Custom watching with for ${item.title}`);

  select.addEventListener("change", () => {
    state.library[item.id].watchingWith = select.value;
    if (select.value !== "Other") {
      state.library[item.id].watchingWithCustom = "";
    }
    saveLibrary();
    renderLibrary();
    renderStats();
  });

  custom.addEventListener("change", () => {
    state.library[item.id].watchingWithCustom = custom.value;
    saveLibrary();
    renderStats();
  });

  wrapper.append(createFieldLabel("Watching with", select), custom);
  return wrapper;
}

function createPlatformControls(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "platform-field";

  const select = document.createElement("select");
  select.dataset.field = "platform";
  select.setAttribute("aria-label", `Watching platform for ${item.title}`);
  const options = [...platformOptions];
  if (item.suggestedPlatform && !options.includes(item.suggestedPlatform)) {
    options.splice(1, 0, item.suggestedPlatform);
  }

  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue || "Watching on...";
    option.selected = item.platform === optionValue;
    select.append(option);
  });

  const custom = document.createElement("input");
  custom.dataset.field = "platformCustom";
  custom.type = "text";
  custom.placeholder = "Custom platform";
  custom.value = item.platformCustom || "";
  custom.hidden = item.platform !== "Other";
  custom.setAttribute("aria-label", `Custom platform for ${item.title}`);

  select.addEventListener("change", () => {
    state.library[item.id].platform = select.value;
    if (select.value !== "Other") {
      state.library[item.id].platformCustom = "";
    }
    saveLibrary();
    renderLibrary();
    renderStats();
  });

  custom.addEventListener("change", () => {
    state.library[item.id].platformCustom = custom.value;
    saveLibrary();
    renderStats();
  });

  wrapper.append(createFieldLabel("Watching on", select), custom);
  return wrapper;
}

function createEpisodeTracker(item) {
  const wrapper = document.createElement("details");
  wrapper.className = "episode-panel";
  wrapper.open = item.shelf === "watching";

  const totalCount = item.episodes?.length || 0;
  const summary = document.createElement("summary");
  const updateSummary = () => {
    const watchedCount = state.library[item.id]?.watchedEpisodes?.length || 0;
    summary.textContent = totalCount ? `Episodes watched: ${watchedCount} of ${totalCount}` : "Episodes watched";
  };
  updateSummary();
  wrapper.append(summary);

  if (!totalCount) {
    const empty = document.createElement("p");
    empty.className = "episode-empty";
    empty.textContent = item.providerId ? "Episode data is still loading. Reopen this shelf item in a moment." : "Episode tracking needs a TVMaze-backed show from Discover.";
    wrapper.append(empty);
    return wrapper;
  }

  const actions = document.createElement("div");
  actions.className = "episode-actions";
  const markAll = document.createElement("button");
  markAll.type = "button";
  markAll.textContent = "Mark all";
  const clearAll = document.createElement("button");
  clearAll.type = "button";
  clearAll.textContent = "Clear";
  actions.append(markAll, clearAll);
  wrapper.append(actions);

  const list = document.createElement("div");
  list.className = "episode-list";

  const seasons = new Map();
  item.episodes.forEach((episode) => {
    if (!seasons.has(episode.season)) seasons.set(episode.season, []);
    seasons.get(episode.season).push(episode);
  });

  const updateSeasonSummary = (seasonSummary, seasonEpisodes) => {
    const watched = new Set(state.library[item.id]?.watchedEpisodes || []);
    const watchedInSeason = seasonEpisodes.filter((episode) => watched.has(episode.id)).length;
    seasonSummary.textContent = `Season ${seasonEpisodes[0].season}: ${watchedInSeason} of ${seasonEpisodes.length}`;
  };

  seasons.forEach((seasonEpisodes, seasonNumber) => {
    const seasonPanel = document.createElement("details");
    seasonPanel.className = "season-panel";
    seasonPanel.dataset.season = String(seasonNumber);
    seasonPanel.open = seasonNumber === item.episodes[0].season;

    const seasonSummary = document.createElement("summary");
    updateSeasonSummary(seasonSummary, seasonEpisodes);
    seasonPanel.append(seasonSummary);

    const seasonActions = document.createElement("div");
    seasonActions.className = "season-actions";
    const markSeason = document.createElement("button");
    markSeason.type = "button";
    markSeason.textContent = "Mark season";
    const clearSeason = document.createElement("button");
    clearSeason.type = "button";
    clearSeason.textContent = "Clear season";
    seasonActions.append(markSeason, clearSeason);
    seasonPanel.append(seasonActions);

    const seasonList = document.createElement("div");
    seasonList.className = "season-episodes";
    seasonEpisodes.forEach((episode) => {
      const id = `${item.id}-${episode.id}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = id;
      checkbox.checked = item.watchedEpisodes.includes(episode.id);
      checkbox.addEventListener("change", () => {
        const watched = new Set(state.library[item.id].watchedEpisodes || []);
        if (checkbox.checked) watched.add(episode.id);
        else watched.delete(episode.id);
        state.library[item.id].watchedEpisodes = [...watched];
        saveLibrary();
        updateSummary();
        updateSeasonSummary(seasonSummary, seasonEpisodes);
        renderStats();
      });

      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.append(checkbox, `E${episode.number} - ${episode.title}`);
      seasonList.append(label);
    });

    markSeason.addEventListener("click", () => {
      const watched = new Set(state.library[item.id].watchedEpisodes || []);
      seasonEpisodes.forEach((episode) => watched.add(episode.id));
      state.library[item.id].watchedEpisodes = [...watched];
      saveLibrary();
      seasonList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = true;
      });
      updateSummary();
      updateSeasonSummary(seasonSummary, seasonEpisodes);
      renderStats();
    });

    clearSeason.addEventListener("click", () => {
      const seasonIds = new Set(seasonEpisodes.map((episode) => episode.id));
      state.library[item.id].watchedEpisodes = (state.library[item.id].watchedEpisodes || []).filter((id) => !seasonIds.has(id));
      saveLibrary();
      seasonList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = false;
      });
      updateSummary();
      updateSeasonSummary(seasonSummary, seasonEpisodes);
      renderStats();
    });

    seasonPanel.append(seasonList);
    list.append(seasonPanel);
  });

  markAll.addEventListener("click", () => {
    state.library[item.id].watchedEpisodes = item.episodes.map((episode) => episode.id);
    saveLibrary();
    list.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = true;
    });
    list.querySelectorAll(".season-panel").forEach((seasonPanel) => {
      const seasonSummary = seasonPanel.querySelector("summary");
      updateSeasonSummary(seasonSummary, seasons.get(Number(seasonPanel.dataset.season)));
    });
    updateSummary();
    renderStats();
  });

  clearAll.addEventListener("click", () => {
    state.library[item.id].watchedEpisodes = [];
    saveLibrary();
    list.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = false;
    });
    list.querySelectorAll(".season-panel").forEach((seasonPanel) => {
      const seasonSummary = seasonPanel.querySelector("summary");
      updateSeasonSummary(seasonSummary, seasons.get(Number(seasonPanel.dataset.season)));
    });
    updateSummary();
    renderStats();
  });

  wrapper.append(list);
  return wrapper;
}

function renderLibrary() {
  const selectedShelf = libraryFilter.value;
  const items = Object.values(state.library)
    .filter((item) => selectedShelf === "all" || item.shelf === selectedShelf)
    .sort((a, b) => a.title.localeCompare(b.title));

  libraryList.innerHTML = "";

  if (!items.length) {
    libraryList.innerHTML = `<div class="empty-state">Your shelf is empty. Add titles from Discover to start shaping your taste profile.</div>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "library-item";

    const detail = document.createElement("div");
    detail.className = "library-detail";
    const poster = document.createElement("div");
    poster.className = "library-poster";
    if (item.image) {
      poster.style.backgroundImage = `url("${item.image}")`;
    } else {
      poster.classList.add("placeholder");
      poster.textContent = item.title.slice(0, 1);
    }

    const copy = document.createElement("div");
    copy.className = "library-copy";
    const kicker = document.createElement("span");
    const title = document.createElement("h3");
    const meta = document.createElement("p");
    const summary = document.createElement("p");

    kicker.className = "card-kicker";
    kicker.textContent = `${item.type === "show" ? "TV show" : "Movie"} - ${shelfLabels[item.shelf]}`;
    title.textContent = item.title;
    meta.textContent = `${item.year} - ${item.genres.slice(0, 3).join(", ")} - ${item.runtime} min`;
    summary.textContent = item.summary;
    copy.append(kicker, title, meta, summary);
    if (item.type === "show") copy.append(createEpisodeTracker(item));
    detail.append(poster, copy);

    const controls = document.createElement("div");
    controls.className = "library-controls";

    const shelfSelect = document.createElement("select");
    shelfSelect.dataset.field = "shelf";
    shelfSelect.setAttribute("aria-label", `Shelf for ${item.title}`);
    shelves.forEach((shelf) => {
      const option = document.createElement("option");
      option.value = shelf;
      option.textContent = shelfLabels[shelf];
      option.selected = item.shelf === shelf;
      shelfSelect.append(option);
    });

    const ratingInput = document.createElement("input");
    ratingInput.dataset.field = "rating";
    ratingInput.type = "number";
    ratingInput.min = "0";
    ratingInput.max = "5";
    ratingInput.step = "0.5";
    ratingInput.placeholder = "Rating";
    ratingInput.value = item.rating;
    ratingInput.setAttribute("aria-label", `Rating for ${item.title}`);

    const notes = document.createElement("textarea");
    notes.dataset.field = "notes";
    notes.placeholder = "Add private notes, themes, or who recommended it...";
    notes.value = item.notes;
    notes.setAttribute("aria-label", `Notes for ${item.title}`);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.dataset.action = "remove";
    removeButton.textContent = "Remove from library";

    controls.append(shelfSelect, ratingInput, createWatchingWithControls(item), createPlatformControls(item), notes, removeButton);
    row.append(detail, controls);

    row.querySelectorAll("[data-field]").forEach((field) => {
      if (["watchingWith", "watchingWithCustom", "platform", "platformCustom"].includes(field.dataset.field)) return;
      field.addEventListener("change", () => {
        state.library[item.id][field.dataset.field] = field.value;
        saveLibrary();
        renderLibrary();
        renderStats();
      });
    });

    row.querySelector("[data-action='remove']").addEventListener("click", () => {
      delete state.library[item.id];
      saveLibrary();
      renderLibrary();
      renderStats();
    });

    libraryList.append(row);
  });
}

function renderStats() {
  const items = Object.values(state.library);
  const completed = items.filter((item) => item.shelf === "completed");
  const rated = items.map((item) => Number(item.rating)).filter(Boolean);
  const watchedEpisodes = items.reduce((sum, item) => sum + (item.watchedEpisodes?.length || 0), 0);
  const totalHours = Math.round(completed.reduce((sum, item) => sum + Number(item.runtime || 0), 0) / 60);
  const average = rated.length ? (rated.reduce((sum, rating) => sum + rating, 0) / rated.length).toFixed(1) : "-";

  document.querySelector("#statTotal").textContent = items.length;
  document.querySelector("#statCompleted").textContent = completed.length;
  document.querySelector("#statAverage").textContent = average;
  document.querySelector("#statHours").textContent = `${totalHours}h`;
  document.querySelector("#sidebarCompleted").textContent = `${completed.length} completed`;
  document.querySelector("#sidebarFocus").textContent = items.length
    ? `${items.filter((item) => item.shelf === "watching").length} currently watching, ${watchedEpisodes} episodes logged.`
    : "Start by adding a show or movie to your watchlist.";

  const meterWidth = Math.min(100, completed.length * 12);
  document.querySelector("#sidebarMeter").style.width = `${meterWidth}%`;

  const chart = document.querySelector("#shelfChart");
  const max = Math.max(1, ...shelves.map((shelf) => items.filter((item) => item.shelf === shelf).length));
  chart.innerHTML = shelves.map((shelf) => {
    const count = items.filter((item) => item.shelf === shelf).length;
    return `
      <div class="bar-row">
        <strong>${shelfLabels[shelf]}</strong>
        <div class="bar-track"><span style="width: ${(count / max) * 100}%"></span></div>
        <span>${count}</span>
      </div>
    `;
  }).join("");
}

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${viewName}-view`)?.classList.add("active");
  document.querySelectorAll("[data-view-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.viewLink === viewName);
  });
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.query = searchInput.value.trim();
  resultsGrid.innerHTML = `<div class="empty-state">Searching titles...</div>`;
  state.results = await searchTitles(state.query);
  renderResults();
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((filterButton) => {
      filterButton.classList.toggle("active", filterButton === button);
    });
    renderResults();
  });
});

document.querySelectorAll("[data-view-link]").forEach((link) => {
  link.addEventListener("click", () => setView(link.dataset.viewLink));
});

libraryFilter.addEventListener("change", renderLibrary);

exportLibraryButton.addEventListener("click", () => {
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(`goodshow-library-${date}.json`, libraryBackupPayload());
  setBackupStatus("Export started. Save the JSON file somewhere you can find it.");
});

importLibraryInput.addEventListener("change", async () => {
  const file = importLibraryInput.files?.[0];
  if (!file) return;

  try {
    const imported = parseImportedLibrary(JSON.parse(await file.text()));
    const mode = document.querySelector("input[name='importMode']:checked")?.value || "merge";
    state.library = mode === "replace" ? imported : mergeLibraries(state.library, imported);
    saveLibrary();
    renderLibrary();
    renderStats();
    setBackupStatus(`${Object.keys(imported).length} title${Object.keys(imported).length === 1 ? "" : "s"} imported using ${mode} mode.`);
  } catch (error) {
    setBackupStatus(error.message || "Import failed. Try another JSON backup file.");
  } finally {
    importLibraryInput.value = "";
  }
});

document.querySelector("#resetDemo").addEventListener("click", () => {
  state.library = {};
  saveLibrary();
  renderLibrary();
  renderStats();
});

window.addEventListener("hashchange", () => {
  setView(location.hash.replace("#", "") || "discover");
});

renderResults();
renderLibrary();
renderStats();
setView(location.hash.replace("#", "") || "discover");
