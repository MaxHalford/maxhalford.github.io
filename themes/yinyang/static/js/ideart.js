(function () {
  "use strict";

  var surface = document.querySelector(".ideart-surface");
  var stickers = Array.from(document.querySelectorAll(".ideart-sticker"));
  var dialog = document.getElementById("ideart-dialog");
  if (!surface || !dialog) return;

  var content = document.getElementById("ideart-dialog-content");
  var dialogTitle = document.getElementById("ideart-dialog-title");
  var dialogDate = document.getElementById("ideart-dialog-date");
  var closeButton = dialog.querySelector(".ideart-dialog-close");
  var articleCache = new Map();
  var activeRequest = 0;
  var activeSticker = null;

  function setHash(key) {
    var hash = "#idea-" + encodeURIComponent(key);
    if (window.location.hash !== hash) history.pushState({ ideart: key }, "", hash);
  }

  function clearHash() {
    if (window.location.hash.indexOf("#idea-") === 0) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  function hydrateArticle(sticker) {
    var request = ++activeRequest;
    var url = sticker.href;
    content.dataset.loading = "true";
    content.textContent = "Gathering the scraps…";

    if (articleCache.has(url)) {
      content.innerHTML = articleCache.get(url);
      content.dataset.loading = "false";
      return;
    }

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load this idea.");
        return response.text();
      })
      .then(function (html) {
        if (request !== activeRequest) return;
        var documentFromResponse = new DOMParser().parseFromString(html, "text/html");
        var article = documentFromResponse.querySelector(".post-content");
        if (!article) throw new Error("Could not find the idea in the page.");
        articleCache.set(url, article.innerHTML);
        content.innerHTML = article.innerHTML;
        content.dataset.loading = "false";
      })
      .catch(function () {
        if (request !== activeRequest) return;
        content.innerHTML = '<p>That scrap would not load. <a href="' + url + '">Open it as a page instead.</a></p>';
        content.dataset.loading = "false";
      });
  }

  function openIdea(sticker, fromHash) {
    activeSticker = sticker;
    dialogTitle.textContent = sticker.dataset.title;
    dialogDate.textContent = sticker.dataset.date;
    hydrateArticle(sticker);
    if (!dialog.open) dialog.showModal();
    if (!fromHash) setHash(sticker.dataset.key);
    closeButton.focus();
  }

  function closeIdea() {
    if (dialog.open) dialog.close();
  }

  stickers.forEach(function (sticker) {
    sticker.addEventListener("click", function (event) {
      if (sticker.dataset.justDragged === "true") {
        event.preventDefault();
        sticker.dataset.justDragged = "false";
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openIdea(sticker, false);
    });

  });

  closeButton.addEventListener("click", closeIdea);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeIdea();
  });
  dialog.addEventListener("close", function () {
    activeRequest += 1;
    clearHash();
    if (activeSticker) activeSticker.focus({ preventScroll: true });
  });

  function openFromHash() {
    if (window.location.hash.indexOf("#idea-") !== 0) return;
    var key = decodeURIComponent(window.location.hash.slice(6));
    var sticker = stickers.find(function (item) { return item.dataset.key === key; });
    if (sticker) openIdea(sticker, true);
  }

  window.addEventListener("popstate", function () {
    if (window.location.hash.indexOf("#idea-") === 0) openFromHash();
    else closeIdea();
  });
  openFromHash();

  if (surface.dataset.development !== "true") return;

  var storageKey = "ideart-layout-v2";
  var sizeInput = document.getElementById("ideart-size");
  var rotationInput = document.getElementById("ideart-rotation");
  var forwardButton = document.getElementById("ideart-forward");
  var copyButton = document.getElementById("ideart-copy");
  var resetButton = document.getElementById("ideart-reset");
  var status = document.getElementById("ideart-status");
  var selected = null;
  var maximumZ = stickers.reduce(function (maximum, sticker) {
    return Math.max(maximum, numberValue(sticker, "--sticker-z"));
  }, 0);

  function numberValue(sticker, property) {
    return parseFloat(sticker.style.getPropertyValue(property)) || 0;
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function selectSticker(sticker) {
    stickers.forEach(function (item) { item.classList.toggle("is-selected", item === sticker); });
    selected = sticker;
    sizeInput.disabled = false;
    rotationInput.disabled = false;
    forwardButton.disabled = false;
    sizeInput.value = numberValue(sticker, "--sticker-width");
    rotationInput.value = numberValue(sticker, "--sticker-rotation");
    status.textContent = "Editing “" + sticker.dataset.title + "”.";
  }

  function serializeLayout() {
    var layout = { stickers: {} };
    stickers.forEach(function (sticker) {
      layout.stickers[sticker.dataset.key] = {
        x: round(numberValue(sticker, "--sticker-x")),
        y: round(numberValue(sticker, "--sticker-y")),
        width: round(numberValue(sticker, "--sticker-width")),
        rotate: round(numberValue(sticker, "--sticker-rotation")),
        z: Math.round(numberValue(sticker, "--sticker-z"))
      };
    });
    return layout;
  }

  function saveDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(serializeLayout()));
    } catch (error) {}
  }

  function applyDraft() {
    var draft;
    try { draft = JSON.parse(localStorage.getItem(storageKey)); } catch (error) { return; }
    if (!draft) return;
    stickers.forEach(function (sticker) {
      var placement = draft.stickers && draft.stickers[sticker.dataset.key];
      if (!placement) return;
      sticker.style.setProperty("--sticker-x", placement.x + "%");
      sticker.style.setProperty("--sticker-y", placement.y + "%");
      sticker.style.setProperty("--sticker-width", placement.width + "%");
      sticker.style.setProperty("--sticker-rotation", placement.rotate + "deg");
      sticker.style.setProperty("--sticker-z", placement.z);
      maximumZ = Math.max(maximumZ, placement.z);
    });
    status.textContent = "Restored the draft from this browser.";
  }

  stickers.forEach(function (sticker) {
    var drag = null;

    sticker.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      selectSticker(sticker);
      var stickerRect = sticker.getBoundingClientRect();
      drag = {
        id: event.pointerId,
        offsetX: event.clientX - stickerRect.left,
        offsetY: event.clientY - stickerRect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      };
      sticker.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    sticker.addEventListener("pointermove", function (event) {
      if (!drag || drag.id !== event.pointerId) return;
      var distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance < 4 && !drag.moved) return;
      drag.moved = true;
      var boardRect = surface.getBoundingClientRect();
      var stickerRect = sticker.getBoundingClientRect();
      var x = (event.clientX - boardRect.left - drag.offsetX) / boardRect.width * 100;
      var y = (event.clientY - boardRect.top - drag.offsetY) / boardRect.height * 100;
      var widthAsPercent = stickerRect.width / boardRect.width * 100;
      var heightAsPercent = stickerRect.height / boardRect.height * 100;
      sticker.style.setProperty("--sticker-x", Math.max(0, Math.min(100 - widthAsPercent, x)).toFixed(2) + "%");
      sticker.style.setProperty("--sticker-y", Math.max(0, Math.min(100 - heightAsPercent, y)).toFixed(2) + "%");
    });

    function endDrag(event) {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved) {
        sticker.dataset.justDragged = "true";
        saveDraft();
        status.textContent = "Draft position saved in this browser.";
      }
      drag = null;
    }

    sticker.addEventListener("pointerup", endDrag);
    sticker.addEventListener("pointercancel", endDrag);
    sticker.addEventListener("dragstart", function (event) { event.preventDefault(); });
  });

  sizeInput.addEventListener("input", function () {
    if (!selected) return;
    selected.style.setProperty("--sticker-width", sizeInput.value + "%");
    saveDraft();
  });

  rotationInput.addEventListener("input", function () {
    if (!selected) return;
    selected.style.setProperty("--sticker-rotation", rotationInput.value + "deg");
    saveDraft();
  });

  forwardButton.addEventListener("click", function () {
    if (!selected) return;
    maximumZ += 1;
    selected.style.setProperty("--sticker-z", maximumZ);
    saveDraft();
    status.textContent = "Sticker brought to the front.";
  });

  copyButton.addEventListener("click", function () {
    var json = JSON.stringify(serializeLayout(), null, 2) + "\n";
    navigator.clipboard.writeText(json).then(function () {
      status.textContent = "Copied. Replace data/ideart.json with this layout.";
    }).catch(function () {
      status.textContent = "Clipboard access failed. Try again from localhost.";
    });
  });

  resetButton.addEventListener("click", function () {
    try { localStorage.removeItem(storageKey); } catch (error) {}
    window.location.reload();
  });

  applyDraft();
}());
