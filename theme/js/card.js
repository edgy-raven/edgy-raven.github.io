(() => {
  const stack = document.querySelector("[data-card-stack]");
  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  };

  const clearInlineReference = (slot) => {
    if (!slot) return;
    slot.innerHTML = "";
    slot.hidden = true;
    delete slot.dataset.inlineReferenceActive;
  };

  const getInlineReferenceScope = (element) =>
    element.closest(".article-page, [data-card-content]") || document;

  const showInlineReference = (trigger) => {
    const key = trigger.dataset.inlineReference;
    if (!key) return;

    const group = trigger.closest("[data-inline-reference-group]");
    let slot = group?.querySelector("[data-inline-reference-slot]");
    if (!slot) {
      const container = trigger.closest("p, li, blockquote, div");
      const sibling = container?.nextElementSibling;
      if (sibling?.matches("[data-inline-reference-slot]")) {
        slot = sibling;
      }
    }
    if (!slot) return;

    if (slot.dataset.inlineReferenceActive === key && !slot.hidden) {
      clearInlineReference(slot);
      return;
    }

    const scope = getInlineReferenceScope(trigger);
    const selector = `template[data-inline-reference-template="${escapeSelector(key)}"]`;
    const template = scope.querySelector(selector) || document.querySelector(selector);
    if (!template) return;

    clearInlineReference(slot);
    slot.appendChild(template.content.cloneNode(true));
    slot.hidden = false;
    slot.dataset.inlineReferenceActive = key;
    requestAnimationFrame(() => {
      slot.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const setRelayView = (root, view) => {
    root.querySelectorAll("[data-relay-view]").forEach((panel) => {
      panel.hidden = panel.dataset.relayView !== view;
    });

    root.querySelectorAll("[data-relay-view-toggle]").forEach((button) => {
      const isActive = button.dataset.relayViewToggle === view;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  document.addEventListener("click", (event) => {
    const relayToggle = event.target.closest("[data-relay-view-toggle]");
    if (relayToggle) {
      const root = relayToggle.closest("[data-relay-view-root]");
      if (root) {
        event.preventDefault();
        setRelayView(root, relayToggle.dataset.relayViewToggle);
      }
      return;
    }

    const inlineReference = event.target.closest("[data-inline-reference]");
    if (inlineReference) {
      event.preventDefault();
      showInlineReference(inlineReference);
      return;
    }

    const inlineReferenceClose = event.target.closest("[data-inline-reference-close]");
    if (inlineReferenceClose) {
      event.preventDefault();
      clearInlineReference(inlineReferenceClose.closest("[data-inline-reference-slot]"));
      return;
    }

    if (!stack) return;

    const trigger = event.target.closest("[data-post-url]");
    const link = event.target.closest("a[href]");
    if (!trigger && !link) return;

    const href = trigger?.dataset.postUrl || trigger?.getAttribute("href") || link?.getAttribute("href");
    if (!href) return;

    const url = new URL(href, window.location.href);
    const slug = pathToSlug.get(url.pathname) || slugFromUrl(url.toString());
    if (!slugToUrl.has(slug)) return;

    const anchorId = url.hash ? decodeURIComponent(url.hash.slice(1)) : null;
    event.preventDefault();

    if (slug === currentSlug && anchorId) {
      scrollToAnchor(anchorId);
      updateHash(slug, anchorId);
      return;
    }

    loadArticle({ href: url.toString(), anchorId }).catch(() => {
      window.location.href = url.toString();
    });
  });

  if (!stack) return;

  const back = stack.querySelector("[data-card-back]");
  const content = stack.querySelector("[data-card-content]");
  const seriesSlot = stack.querySelector("[data-card-series-slot]");
  const closeButtons = stack.querySelectorAll("[data-card-close]");
  const registryNode = document.querySelector("#article-registry");
  const initialMarkup = content.innerHTML;
  const slugToUrl = new Map();
  const pathToSlug = new Map();
  let currentSlug = null;
  let currentSection = null;

  const clearCardSeriesNav = () => {
    if (!seriesSlot) return;
    seriesSlot.innerHTML = "";
    seriesSlot.hidden = true;
  };

  const slugFromUrl = (url) => {
    const pathname = new URL(url, window.location.href).pathname;
    const filename = pathname.split("/").filter(Boolean).pop() || "";
    return filename.replace(/\.html$/, "") || null;
  };

  if (registryNode) {
    const registry = JSON.parse(registryNode.textContent);
    Object.entries(registry).forEach(([slug, url]) => {
      slugToUrl.set(slug, url);
      pathToSlug.set(new URL(url, window.location.href).pathname, slug);
    });
  }

  const noteLinks = [...document.querySelectorAll("[data-post-url]")];
  noteLinks.forEach((link) => {
    const url = link.dataset.postUrl || link.getAttribute("href");
    if (!url) return;
    const slug = slugFromUrl(url);
    if (!slug) return;
    if (!slugToUrl.has(slug)) {
      slugToUrl.set(slug, url);
      pathToSlug.set(new URL(url, window.location.href).pathname, slug);
    }
  });

  const setFlipped = (value) => {
    stack.classList.toggle("is-flipped", value);
    back.setAttribute("aria-hidden", value ? "false" : "true");
  };

  const animateFlip = (value) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlipped(value);
      });
    });
  };

  const parseHashState = () => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return {
      slug: params.get("note"),
      section: params.get("section"),
    };
  };

  const updateHash = (slug, section = null) => {
    const url = slug
      ? `#note=${encodeURIComponent(slug)}${section ? `&section=${encodeURIComponent(section)}` : ""}`
      : window.location.pathname + window.location.search;
    history.replaceState(null, "", url);
  };

  const normalizeArticleLinks = (article, baseUrl) => {
    article.querySelectorAll("a[href]").forEach((link) => {
      const rawHref = link.getAttribute("href");
      if (!rawHref || rawHref.startsWith("mailto:") || rawHref.startsWith("javascript:")) return;

      const absoluteUrl = new URL(rawHref, baseUrl).toString();
      link.setAttribute("href", absoluteUrl);

      const slug = slugFromUrl(absoluteUrl);
      if (slugToUrl.has(slug)) {
        link.dataset.postUrl = absoluteUrl;
      }
    });
  };

  const scrollToAnchor = (anchorId) => {
    if (!anchorId) return;
    const target = content.querySelector(`#${escapeSelector(anchorId)}`);
    if (!target) return;

    const scroller = content.querySelector(".article-flow") || content;
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 14;
    scroller.scrollTop = Math.max(top, 0);
  };

  const showFront = (options = {}) => {
    currentSlug = null;
    currentSection = null;
    content.innerHTML = initialMarkup;
    content.scrollTop = 0;
    clearCardSeriesNav();
    animateFlip(false);
    if (!options.preserveHash) updateHash(null);
  };

  const extractArticle = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.querySelector(".article-page");
  };

  const prepareEmbeddedArticle = (article) => {
    const pageActions = article.querySelector(".page-actions");
    if (!pageActions) return;

    const seriesFooterNav = pageActions.querySelector(".series-footer-nav");
    if (seriesFooterNav && seriesSlot) {
      clearCardSeriesNav();
      seriesSlot.appendChild(seriesFooterNav);
      seriesSlot.hidden = false;
    }

    const standaloneBackLink = pageActions.querySelector(
      ':scope > .back-button[href$="/index.html"], :scope > .back-button[href$="index.html"]',
    );
    if (standaloneBackLink) {
      standaloneBackLink.remove();
    }

    if (pageActions.childElementCount === 0) {
      pageActions.remove();
    }
  };

  const loadArticle = async ({ slug, href, anchorId = null, updateLocation = true }) => {
    const resolvedSlug = slug || pathToSlug.get(new URL(href, window.location.href).pathname);
    const resolvedHref = href || slugToUrl.get(resolvedSlug);
    if (!resolvedSlug || !resolvedHref) throw new Error("Missing article route");

    const fetchUrl = new URL(resolvedHref, window.location.href);
    const resolvedAnchor = anchorId || (fetchUrl.hash ? decodeURIComponent(fetchUrl.hash.slice(1)) : null);
    fetchUrl.hash = "";

    const response = await fetch(fetchUrl.toString(), { headers: { "X-Requested-With": "squareqrow-card" } });
    if (!response.ok) throw new Error(`Failed to load ${resolvedHref}`);

    const article = extractArticle(await response.text());
    if (!article) throw new Error(`Missing article markup in ${resolvedHref}`);

    normalizeArticleLinks(article, fetchUrl.toString());
    clearCardSeriesNav();
    prepareEmbeddedArticle(article);
    content.innerHTML = article.outerHTML;
    content.scrollTop = 0;
    currentSlug = resolvedSlug;
    currentSection = resolvedAnchor;
    scrollToAnchor(resolvedAnchor);
    if (updateLocation) updateHash(resolvedSlug, resolvedAnchor);
    animateFlip(true);
  };

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => showFront());
  });

  window.addEventListener("hashchange", () => {
    const { slug, section } = parseHashState();
    if (!slug) {
      if (currentSlug) showFront({ preserveHash: true });
      return;
    }
    if (slug === currentSlug && section === currentSection) return;
    loadArticle({ slug, anchorId: section, updateLocation: false }).catch(() => {
      const href = slugToUrl.get(slug);
      if (href) window.location.href = href;
    });
  });

  const initialState = parseHashState();
  if (initialState.slug) {
    loadArticle({ slug: initialState.slug, anchorId: initialState.section, updateLocation: false }).catch(() => {
      const href = slugToUrl.get(initialState.slug);
      if (href) window.location.href = href;
    });
  }
})();
