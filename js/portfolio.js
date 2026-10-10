/* ==========================================================
   Class portfolio: homepage cards, portfolio tiles, and the project page.
   Everything is built from PROJECTS in js/projects.js.
   (Runs before main.js, so the reveal animations and the
   screenshot slider pick up what's built here.)
   ========================================================== */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function hostOf(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function projectLink(project) {
  return `project.html?id=${encodeURIComponent(project.id)}`;
}

function screenshot(project, lazy) {
  const img = el("img");
  img.src = project.images[0];
  img.alt = `${project.title} website`;
  img.width = 1920;
  img.height = 1200;
  if (lazy) img.loading = "lazy";
  return img;
}

/* ---------- One project card (homepage + "more projects") ---------- */
function workCard(project) {
  const card = el("a", "work-card reveal reveal-pop");
  card.href = projectLink(project);

  const media = el("div", "work-media");
  media.append(screenshot(project, true));

  const caption = el("div", "work-caption");
  caption.append(el("h3", null, project.title), el("p", null, `${project.category} · ${hostOf(project.url)}`));

  card.append(media, caption);
  return card;
}

function renderGrid(container, projects) {
  container.replaceChildren(...projects.map(workCard));
}

/* ---------- One tile per project (class portfolio page) ---------- */
function workTile(project, index) {
  const tile = el("a", "portfolio-tile reveal reveal-pop");
  tile.href = projectLink(project);
  tile.style.setProperty("--stagger", `${(index % 3) * 0.08}s`); // tiles in a row pop in one after another
  tile.append(screenshot(project, index > 2));

  // shows on hover: category, title, then "View project", one after another
  const info = el("div", "portfolio-tile-info");
  info.append(
    el("span", "portfolio-tile-cat", project.category),
    el("span", "portfolio-tile-title", project.title),
    el("span", "portfolio-tile-more", "View project →")
  );
  tile.append(info);
  return tile;
}

function initWorkLists() {
  const featured = document.getElementById("featured-work");
  if (featured) renderGrid(featured, PROJECTS.filter((p) => p.featured).slice(0, 3));

  const grid = document.getElementById("portfolio-grid");
  if (grid) grid.replaceChildren(...PROJECTS.map(workTile));
}

/* ---------- Project page (project.html?id=...) ---------- */
function initProjectPage() {
  const page = document.getElementById("project-page");
  if (!page) return;

  const id = new URLSearchParams(location.search).get("id");
  const project = PROJECTS.find((p) => p.id === id);

  if (!project) {
    document.getElementById("project-title").textContent = "Project not found";
    document.getElementById("project-crumb").textContent = "Not found";
    page.replaceChildren(el("p", "project-missing", "We couldn't find that project. It may have been moved or renamed."));
    const back = el("a", "btn btn-outline", "Back to the class portfolio");
    back.href = "portfolio.html";
    page.append(back);
    document.querySelector(".project-mobile")?.remove();
    document.getElementById("more-work").closest("section").remove();
    return;
  }

  const name = project.shortTitle || project.title;
  document.title = `${project.title} | BavtsBackStacks Class Portfolio`;
  document.getElementById("project-title").textContent = name;
  document.getElementById("project-crumb").textContent = name;

  // screenshots (main.js adds the dots and arrows)
  document.querySelector("#project-slider .slider-track").replaceChildren(
    ...project.images.map((src, i) => {
      const img = el("img", i === 0 ? "slide-img is-active" : "slide-img");
      img.src = src;
      img.alt = `${project.title}, screenshot ${i + 1} of ${project.images.length}`;
      img.width = 1920;
      img.height = 1200;
      return img;
    })
  );

  // text
  document.getElementById("project-name").textContent = project.title;
  document.getElementById("project-lead").textContent = project.summary;
  document.getElementById("project-desc").replaceChildren(...project.description.map((p) => el("p", null, p)));

  // details list (year and team only show if they're filled in)
  const list = document.getElementById("project-meta");
  [
    ["Client", project.title],
    ["Category", project.category],
    ["Built with", project.builtWith],
    ["Year", project.year],
    ["Team", project.team],
  ]
    .filter(([, value]) => value)
    .forEach(([label, value]) => {
      const row = el("div");
      row.append(el("dt", null, label), el("dd", null, value));
      list.append(row);
    });
  const siteLink = el("a", null, hostOf(project.url));
  siteLink.href = project.url;
  siteLink.target = "_blank";
  siteLink.rel = "noopener";
  const siteDd = el("dd");
  siteDd.append(siteLink);
  const siteRow = el("div");
  siteRow.append(el("dt", null, "Website"), siteDd);
  list.append(siteRow);
  document.getElementById("project-visit").href = project.url;

  // highlights + phone
  document.getElementById("project-highlights").replaceChildren(...project.highlights.map((h) => el("li", null, h)));
  const phone = document.getElementById("project-phone");
  if (project.mobile) {
    const img = el("img");
    img.src = project.mobile;
    img.alt = `${project.title} on a phone`;
    img.width = 750;
    img.height = 1624;
    img.loading = "lazy";
    phone.append(img);
  } else {
    phone.closest(".project-mobile").remove();
  }

  // more projects
  const more = document.getElementById("more-work");
  const others = PROJECTS.filter((p) => p.id !== project.id);
  if (others.length) renderGrid(more, others.slice(0, 3));
  else more.closest("section").remove();
}

initWorkLists();
initProjectPage();
