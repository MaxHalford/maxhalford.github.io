(() => {
  const root = document.getElementById("search-comparison-explorer");
  if (!root) return;

  const select = root.querySelector("[data-query-select]");
  const random = root.querySelector("[data-random-query]");
  const rankings = root.querySelector("[data-rankings]");
  const status = root.querySelector("[data-status]");
  const summary = root.querySelector("[data-summary]");
  let queries = [];

  function wikipediaUrl(page) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key).replaceAll("%2F", "/")}`;
  }

  function createResult(page, rank, matches) {
    const item = document.createElement("li");
    item.className = "search-explorer__result";

    const number = document.createElement("span");
    number.className = "search-explorer__rank";
    number.textContent = rank;
    item.append(number);

    const content = document.createElement("div");
    const link = document.createElement("a");
    link.href = wikipediaUrl(page);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = page.title;
    content.append(link);

    const matchingRank = matches.get(page.id);
    if (matchingRank !== undefined) {
      item.classList.add("is-shared");
      item.dataset.matchId = page.id;
      if (matchingRank === rank) {
        item.classList.add("is-exact");
        link.setAttribute("aria-label", `${page.title}, same rank in both lists`);
      } else {
        link.setAttribute("aria-label", `${page.title}, rank ${matchingRank} in the other list`);
      }
    }

    item.append(content);
    return item;
  }

  function createColumn(title, pages, otherPages) {
    const column = document.createElement("section");
    const header = document.createElement("div");
    header.className = "search-explorer__column-header";

    const heading = document.createElement("h3");
    heading.textContent = title;
    header.append(heading);
    column.append(header);

    const matches = new Map(otherPages.map((page, index) => [page.id, index + 1]));
    const list = document.createElement("ol");
    list.className = "search-explorer__results";
    pages.forEach((page, index) => list.append(createResult(page, index + 1, matches)));
    column.append(list);
    return column;
  }

  function connectMatchingRows() {
    const rows = [...rankings.querySelectorAll("[data-match-id]")];
    const clear = () => rows.forEach((row) => row.classList.remove("is-linked"));

    rows.forEach((row) => {
      const highlightMatch = () => {
        clear();
        rows
          .filter((candidate) => candidate !== row && candidate.dataset.matchId === row.dataset.matchId)
          .forEach((candidate) => candidate.classList.add("is-linked"));
      };
      row.addEventListener("mouseenter", highlightMatch);
      row.addEventListener("mouseleave", clear);
      row.addEventListener("focusin", highlightMatch);
      row.addEventListener("focusout", clear);
    });
  }

  function render(index) {
    const item = queries[index];
    if (!item) return;

    select.value = String(index);
    const exactMatches = item.ours.filter(
      (page, rank) => item.wikipedia[rank] && item.wikipedia[rank].id === page.id,
    ).length;
    summary.textContent = `${item.overlap} shared pages · ${exactMatches} in the same position`;
    rankings.innerHTML = "";
    rankings.append(
      createColumn("turbopuffer", item.ours, item.wikipedia),
      createColumn("Wikipedia", item.wikipedia, item.ours),
    );
    connectMatchingRows();
  }

  select.addEventListener("change", () => render(Number(select.value)));
  random.addEventListener("click", () => render(Math.floor(Math.random() * queries.length)));

  fetch(root.dataset.source)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      queries = data.queries;
      queries.forEach((item, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = item.query;
        select.append(option);
      });

      status.hidden = true;
      render(Math.floor(Math.random() * queries.length));
    })
    .catch(() => {
      status.textContent = "The comparison data could not be loaded.";
    });
})();
