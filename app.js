(() => {
  const ALLOWED_EXT = ["mp4", "webm", "ogg", "ogv", "mov", "m4v", "mpeg", "mpg", "3gp"];
  const MAX_FPS = 30;
  const STICKERS = ["⚓", "🚢", "🌊", "⭐", "❤️", "🔥", "😎", "🐟", "🐠", "🌞", "🌙", "👑", "⚡", "🎉", "💎", "🍀", "🎯", "🚀", "👻", "🌈", "👍", "🌺", "❄️", "🎵"];

  const els = {
    fileInput: document.getElementById("fileInput"),
    dropzone: document.getElementById("dropzone"),
    toast: document.getElementById("toast"),
    workspace: document.getElementById("workspace"),
    sourceVideo: document.getElementById("sourceVideo"),
    sourceName: document.getElementById("sourceName"),
    playBtn: document.getElementById("playBtn"),
    clipBar: document.getElementById("clipBar"),
    clipSpan: document.getElementById("clipSpan"),
    clipDimLeft: document.getElementById("clipDimLeft"),
    clipDimRight: document.getElementById("clipDimRight"),
    startHandle: document.getElementById("startHandle"),
    endHandle: document.getElementById("endHandle"),
    playhead: document.getElementById("playhead"),
    clipTimeLabel: document.getElementById("clipTimeLabel"),
    fpsRange: document.getElementById("fpsRange"),
    fpsLabel: document.getElementById("fpsLabel"),
    widthRange: document.getElementById("widthRange"),
    widthLabel: document.getElementById("widthLabel"),
    frameInfo: document.getElementById("frameInfo"),
    convertBtn: document.getElementById("convertBtn"),
    closeEditorBtn: document.getElementById("closeEditorBtn"),
    progressBlock: document.getElementById("progressBlock"),
    progressBar: document.getElementById("progressBar"),
    progressText: document.getElementById("progressText"),
    progressPct: document.getElementById("progressPct"),
    videoLibrary: document.getElementById("videoLibrary"),
    gifLibrary: document.getElementById("gifLibrary"),
    lightbox: document.getElementById("lightbox"),
    lightboxImage: document.getElementById("lightboxImage"),
    lightboxClose: document.getElementById("lightboxClose"),
    gifStudio: document.getElementById("gifStudio"),
    gifCanvas: document.getElementById("gifCanvas"),
    gifEditName: document.getElementById("gifEditName"),
    closeGifStudio: document.getElementById("closeGifStudio"),
    undoBtn: document.getElementById("undoBtn"),
    resetBtn: document.getElementById("resetBtn"),
    pixelMode: document.getElementById("pixelMode"),
    textInput: document.getElementById("textInput"),
    textColor: document.getElementById("textColor"),
    textSize: document.getElementById("textSize"),
    addTextBtn: document.getElementById("addTextBtn"),
    stickerGrid: document.getElementById("stickerGrid"),
    deleteOverlayBtn: document.getElementById("deleteOverlayBtn"),
    saveGifBtn: document.getElementById("saveGifBtn"),
    gifProgressBlock: document.getElementById("gifProgressBlock"),
    gifProgressBar: document.getElementById("gifProgressBar"),
    gifProgressText: document.getElementById("gifProgressText"),
    gifProgressPct: document.getElementById("gifProgressPct"),
  };

  const uploadedVideos = [];
  const completedGifs = [];
  let currentVideo = null;
  let converting = false;
  let clip = { start: 0, end: 1, duration: 1, drag: null };
  let gifEdit = null;
  let gifRaf = 0;

  function showToast(type, message) {
    els.toast.hidden = false;
    els.toast.className = `toast ${type}`;
    els.toast.textContent = message;
  }

  function extensionOf(name) {
    const parts = name.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function baseName(name) {
    return name.replace(/\.[^/.]+$/, "");
  }

  function formatTime(sec) {
    return `${sec.toFixed(2)}s`;
  }

  function isAllowedFile(file) {
    const ext = extensionOf(file.name);
    if (ALLOWED_EXT.includes(ext)) return true;
    return Boolean(file.type && file.type.startsWith("video/"));
  }

  ["dragenter", "dragover"].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("dragover");
    });
  });
  els.dropzone.addEventListener("drop", (e) => {
    [...e.dataTransfer.files].forEach(handleFile);
  });
  els.fileInput.addEventListener("change", () => {
    [...els.fileInput.files].forEach(handleFile);
    els.fileInput.value = "";
  });

  async function handleFile(file) {
    const url = URL.createObjectURL(file);
    const allowed = isAllowedFile(file);
    const playable = allowed ? await probeVideo(url) : false;
    const editable = allowed && playable;
    const thumb = playable ? await captureThumb(url) : "";

    uploadedVideos.unshift({
      id: crypto.randomUUID(),
      file,
      url,
      name: file.name,
      editable,
      thumb,
    });
    renderVideoLibrary();

    if (editable) {
      showToast("ok", `편집 가능한 동영상입니다. ${file.name} — 썸네일을 눌러 구간을 선택하세요.`);
    } else {
      showToast(
        "bad",
        `편집할 수 없는 파일입니다. (${file.name}) MP4, WebM, OGG, MOV, M4V, MPEG, 3GP만 변환할 수 있습니다.`
      );
    }
  }

  function probeVideo(url) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      let settled = false;
      let timer = 0;
      const cleanup = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.removeAttribute("src");
        video.load();
        resolve(ok);
      };
      video.onloadedmetadata = () => cleanup(isFinite(video.duration) && video.duration > 0);
      video.onerror = () => cleanup(false);
      timer = setTimeout(() => cleanup(false), 8000);
      video.src = url;
    });
  }

  function captureThumb(url) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      let settled = false;
      const finish = (data) => {
        if (settled) return;
        settled = true;
        video.removeAttribute("src");
        video.load();
        resolve(data);
      };
      video.onerror = () => finish("");
      video.onloadeddata = () => {
        const draw = () => {
          try {
            const canvas = document.createElement("canvas");
            const w = video.videoWidth || 320;
            const h = video.videoHeight || 180;
            canvas.width = 320;
            canvas.height = Math.max(1, Math.round((320 * h) / w));
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
            finish(canvas.toDataURL("image/jpeg", 0.72));
          } catch {
            finish("");
          }
        };
        video.onseeked = draw;
        video.currentTime = Math.min(0.3, (video.duration || 1) * 0.1);
      };
      setTimeout(() => finish(""), 8000);
      video.src = url;
    });
  }

  function openEditor(item) {
    currentVideo = item;
    els.gifStudio.hidden = true;
    stopGifPreview();
    els.workspace.hidden = false;
    els.sourceName.textContent = item.name;
    els.sourceVideo.src = item.url;
    els.progressBlock.hidden = true;
    setProgress(0, "변환 준비 중");
    els.sourceVideo.onloadedmetadata = () => {
      clip.duration = els.sourceVideo.duration || 1;
      clip.start = 0;
      clip.end = Math.min(1, 3 / clip.duration);
      els.sourceVideo.currentTime = 0;
      updateClipUI();
      updateRangeInfo();
    };
    els.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEditor() {
    currentVideo = null;
    els.workspace.hidden = true;
    els.sourceVideo.pause();
    els.sourceVideo.removeAttribute("src");
    els.sourceVideo.load();
    els.playBtn.textContent = "▶";
  }

  els.closeEditorBtn.addEventListener("click", closeEditor);

  function startTime() {
    return clip.start * clip.duration;
  }
  function endTime() {
    return clip.end * clip.duration;
  }
  function fpsValue() {
    return Math.min(MAX_FPS, Math.max(1, Number(els.fpsRange.value)));
  }

  function updateClipUI() {
    els.clipSpan.style.left = `${clip.start * 100}%`;
    els.clipSpan.style.width = `${(clip.end - clip.start) * 100}%`;
    els.clipDimLeft.style.left = "0";
    els.clipDimLeft.style.width = `${clip.start * 100}%`;
    els.clipDimRight.style.left = `${clip.end * 100}%`;
    els.clipDimRight.style.width = `${(1 - clip.end) * 100}%`;
    els.startHandle.style.left = `${clip.start * 100}%`;
    els.endHandle.style.left = `${clip.end * 100}%`;
    const ratio = clip.duration ? els.sourceVideo.currentTime / clip.duration : 0;
    els.playhead.style.left = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
    els.clipTimeLabel.textContent = `시작 ${formatTime(startTime())} · 종료 ${formatTime(endTime())}`;
  }

  function updateRangeInfo() {
    els.fpsLabel.textContent = `${fpsValue()} FPS`;
    els.widthLabel.textContent = `${els.widthRange.value}px`;
    const span = Math.max(0.04, endTime() - startTime());
    const frames = Math.max(1, Math.round(span * fpsValue()));
    els.frameInfo.textContent = `선택 구간 ${span.toFixed(2)}초 · 예상 프레임 ${frames}장 (최대 ${MAX_FPS}FPS)`;
  }

  function ratioFromEvent(e) {
    const rect = els.clipBar.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    return Math.min(1, Math.max(0, x / rect.width));
  }

  function beginClipDrag(which, e) {
    e.preventDefault();
    clip.drag = which;
  }

  els.startHandle.addEventListener("pointerdown", (e) => beginClipDrag("start", e));
  els.endHandle.addEventListener("pointerdown", (e) => beginClipDrag("end", e));
  els.clipBar.addEventListener("pointerdown", (e) => {
    if (e.target === els.startHandle || e.target === els.endHandle) return;
    const ratio = ratioFromEvent(e);
    const distStart = Math.abs(ratio - clip.start);
    const distEnd = Math.abs(ratio - clip.end);
    clip.drag = distStart <= distEnd ? "start" : "end";
    applyClipDrag(ratio);
  });

  window.addEventListener("pointermove", (e) => {
    if (!clip.drag) return;
    applyClipDrag(ratioFromEvent(e));
  });
  window.addEventListener("pointerup", () => {
    clip.drag = null;
  });

  function applyClipDrag(ratio) {
    const minSpan = Math.min(0.04 / Math.max(clip.duration, 0.04), 0.98);
    if (clip.drag === "start") {
      clip.start = Math.min(ratio, clip.end - minSpan);
      els.sourceVideo.currentTime = startTime();
    } else if (clip.drag === "end") {
      clip.end = Math.max(ratio, clip.start + minSpan);
      els.sourceVideo.currentTime = endTime();
    }
    updateClipUI();
    updateRangeInfo();
  }

  els.playBtn.addEventListener("click", () => {
    if (els.sourceVideo.paused) {
      if (els.sourceVideo.currentTime < startTime() || els.sourceVideo.currentTime >= endTime() - 0.05) {
        els.sourceVideo.currentTime = startTime();
      }
      els.sourceVideo.play();
      els.playBtn.textContent = "❚❚";
    } else {
      els.sourceVideo.pause();
      els.playBtn.textContent = "▶";
    }
  });

  els.sourceVideo.addEventListener("timeupdate", () => {
    if (!els.sourceVideo.paused && els.sourceVideo.currentTime >= endTime() - 0.02) {
      els.sourceVideo.currentTime = startTime();
    }
    updateClipUI();
  });
  els.sourceVideo.addEventListener("ended", () => {
    els.playBtn.textContent = "▶";
  });

  ["fpsRange", "widthRange"].forEach((id) => {
    els[id].addEventListener("input", updateRangeInfo);
  });

  function setProgress(pct, text) {
    const value = Math.max(0, Math.min(100, Math.round(pct)));
    els.progressBlock.hidden = false;
    els.progressBar.style.width = `${value}%`;
    els.progressPct.textContent = `${value}%`;
    if (text) els.progressText.textContent = text;
    els.progressBlock.querySelector(".progress-track").setAttribute("aria-valuenow", String(value));
  }

  function seekVideo(video, time) {
    return new Promise((resolve, reject) => {
      const target = Math.min(Math.max(time, 0), Math.max(0, video.duration - 0.001));
      if (Math.abs(video.currentTime - target) < 0.001) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        resolve();
      }, 1200);
      const onSeeked = () => {
        clearTimeout(timer);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        clearTimeout(timer);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        reject(new Error("영상 탐색에 실패했습니다."));
      };
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.currentTime = target;
    });
  }

  els.convertBtn.addEventListener("click", async () => {
    if (!currentVideo || converting) return;
    converting = true;
    els.convertBtn.disabled = true;
    const video = els.sourceVideo;
    video.pause();
    els.playBtn.textContent = "▶";

    const start = startTime();
    const end = Math.max(start + 0.04, endTime());
    const fps = fpsValue();
    const duration = end - start;
    const frameCount = Math.max(1, Math.round(duration * fps));
    const delay = Math.round(1000 / fps);
    const outWidth = Number(els.widthRange.value);
    const ratio = video.videoHeight / video.videoWidth || 9 / 16;
    const outHeight = Math.max(2, Math.round((outWidth * ratio) / 2) * 2);

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const frames = [];

    setProgress(1, "프레임을 추출하는 중...");

    try {
      for (let i = 0; i < frameCount; i++) {
        const t = start + i / fps;
        await seekVideo(video, Math.min(t, end - 0.001));
        ctx.drawImage(video, 0, 0, outWidth, outHeight);
        frames.push(new Uint8ClampedArray(ctx.getImageData(0, 0, outWidth, outHeight).data));
        setProgress(((i + 1) / frameCount) * 70, `프레임 추출 ${i + 1}/${frameCount}`);
        await new Promise((r) => setTimeout(r, 0));
      }

      setProgress(72, "GIF로 압축하는 중...");
      const blob = await encodeAnimatedGif(frames, outWidth, outHeight, delay, (p) => {
        setProgress(72 + p * 28, "GIF로 압축하는 중...");
      });

      setProgress(100, "변환 완료");
      const name = `${baseName(currentVideo.name)}.gif`;
      const url = URL.createObjectURL(blob);
      completedGifs.unshift({
        id: crypto.randomUUID(),
        name,
        blob,
        url,
        from: currentVideo.name,
        frames,
        width: outWidth,
        height: outHeight,
        delay,
      });
      renderGifLibrary();
      showToast("ok", `GIF 변환이 완료되었습니다. ${name}`);
    } catch (err) {
      showToast("bad", err.message || "변환 중 오류가 발생했습니다.");
    } finally {
      converting = false;
      els.convertBtn.disabled = false;
    }
  });

  function renderVideoLibrary() {
    if (!uploadedVideos.length) {
      els.videoLibrary.innerHTML = `<p class="empty">아직 업로드한 동영상이 없습니다.</p>`;
      return;
    }
    els.videoLibrary.innerHTML = uploadedVideos
      .map((item) => {
        const badge = item.editable
          ? `<span class="badge ok">편집 가능</span>`
          : `<span class="badge bad">편집 불가</span>`;
        const media = item.thumb
          ? `<img src="${item.thumb}" alt="${escapeHtml(item.name)} 썸네일" />`
          : `<div class="thumb-fallback">미리보기 없음</div>`;
        return `
        <article class="card ${item.editable ? "editable" : "locked"}">
          <div class="thumb" data-open="${item.id}" title="${item.editable ? "눌러서 편집" : "편집할 수 없는 파일"}">
            ${media}
            ${badge}
            <button type="button" class="btn-del" data-delete-video="${item.id}" aria-label="삭제">×</button>
          </div>
          <div class="card-body">
            <div class="card-name">${escapeHtml(item.name)}</div>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderGifLibrary() {
    if (!completedGifs.length) {
      els.gifLibrary.innerHTML = `<p class="empty">아직 완성된 GIF가 없습니다.</p>`;
      return;
    }
    els.gifLibrary.innerHTML = completedGifs
      .map(
        (item) => `
        <article class="card">
          <div class="thumb" data-preview="${item.id}">
            <img src="${item.url}" alt="${escapeHtml(item.name)} 미리보기" />
            <button type="button" class="btn-del" data-delete-gif="${item.id}" aria-label="삭제">×</button>
          </div>
          <div class="card-body">
            <div class="card-name">${escapeHtml(item.name)}</div>
            <div class="btn-row">
              <button type="button" class="btn btn-primary" data-download="${item.id}">다운로드</button>
              <button type="button" class="btn btn-ghost" data-edit-gif="${item.id}">편집</button>
            </div>
          </div>
        </article>`
      )
      .join("");
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function deleteVideo(id) {
    const index = uploadedVideos.findIndex((v) => v.id === id);
    if (index < 0) return;
    const item = uploadedVideos[index];
    if (currentVideo && currentVideo.id === id) closeEditor();
    URL.revokeObjectURL(item.url);
    uploadedVideos.splice(index, 1);
    renderVideoLibrary();
  }

  function deleteGif(id) {
    const index = completedGifs.findIndex((g) => g.id === id);
    if (index < 0) return;
    if (gifEdit && gifEdit.item.id === id) closeGifStudio();
    URL.revokeObjectURL(completedGifs[index].url);
    completedGifs.splice(index, 1);
    renderGifLibrary();
  }

  els.videoLibrary.addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete-video]");
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      deleteVideo(del.dataset.deleteVideo);
      return;
    }
    const open = e.target.closest("[data-open]");
    if (!open) return;
    const item = uploadedVideos.find((v) => v.id === open.dataset.open);
    if (!item) return;
    if (!item.editable) {
      showToast("bad", `이 파일은 편집할 수 없습니다. (${item.name})`);
      return;
    }
    openEditor(item);
  });

  els.gifLibrary.addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete-gif]");
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      deleteGif(del.dataset.deleteGif);
      return;
    }
    const edit = e.target.closest("[data-edit-gif]");
    if (edit) {
      const item = completedGifs.find((g) => g.id === edit.dataset.editGif);
      if (item) openGifStudio(item);
      return;
    }
    const preview = e.target.closest("[data-preview]");
    const download = e.target.closest("[data-download]");
    if (preview) {
      const item = completedGifs.find((g) => g.id === preview.dataset.preview);
      if (item) openLightbox(item);
    }
    if (download) {
      const item = completedGifs.find((g) => g.id === download.dataset.download);
      if (item) downloadGif(item);
    }
  });

  function openLightbox(item) {
    els.lightboxImage.src = item.url;
    els.lightboxImage.alt = item.name;
    els.lightbox.hidden = false;
  }

  function closeLightbox() {
    els.lightbox.hidden = true;
    els.lightboxImage.src = "";
  }

  els.lightboxClose.addEventListener("click", closeLightbox);
  els.lightbox.addEventListener("click", (e) => {
    if (e.target === els.lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.lightbox.hidden) closeLightbox();
    if (e.key === "Delete" && gifEdit) deleteSelectedOverlay();
  });

  function downloadGif(item) {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  els.stickerGrid.innerHTML = STICKERS.map(
    (emoji) => `<button type="button" class="sticker-btn" data-sticker="${emoji}">${emoji}</button>`
  ).join("");

  function snapshotEdit() {
    if (!gifEdit) return;
    gifEdit.history.push(JSON.stringify({ overlays: gifEdit.overlays, pixelMode: gifEdit.pixelMode }));
    if (gifEdit.history.length > 40) gifEdit.history.shift();
  }

  function openGifStudio(item) {
    if (!item.frames) {
      showToast("bad", "이 GIF는 프레임 데이터가 없어 편집할 수 없습니다. 영상을 다시 변환해 주세요.");
      return;
    }
    els.workspace.hidden = true;
    els.gifStudio.hidden = false;
    els.gifEditName.textContent = item.name;
    gifEdit = {
      item,
      overlays: [],
      pixelMode: "none",
      history: [],
      selectedId: null,
      frameIndex: 0,
      lastTick: 0,
      drag: null,
    };
    els.pixelMode.value = "none";
    const canvas = els.gifCanvas;
    canvas.width = item.width;
    canvas.height = item.height;
    startGifPreview();
    els.gifStudio.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeGifStudio() {
    stopGifPreview();
    gifEdit = null;
    els.gifStudio.hidden = true;
  }

  els.closeGifStudio.addEventListener("click", closeGifStudio);

  function startGifPreview() {
    stopGifPreview();
    const tick = (now) => {
      if (!gifEdit) return;
      const delay = gifEdit.item.delay || 80;
      if (!gifEdit.lastTick || now - gifEdit.lastTick >= delay) {
        gifEdit.lastTick = now;
        gifEdit.frameIndex = (gifEdit.frameIndex + 1) % gifEdit.item.frames.length;
        drawGifFrame();
      }
      gifRaf = requestAnimationFrame(tick);
    };
    gifRaf = requestAnimationFrame(tick);
  }

  function stopGifPreview() {
    cancelAnimationFrame(gifRaf);
  }

  function drawGifFrame() {
    if (!gifEdit) return;
    const { item, frameIndex } = gifEdit;
    const ctx = els.gifCanvas.getContext("2d");
    const image = new ImageData(new Uint8ClampedArray(item.frames[frameIndex]), item.width, item.height);
    applyPixelMode(image, gifEdit.pixelMode);
    ctx.putImageData(image, 0, 0);
    gifEdit.overlays.forEach((ov) => drawOverlay(ctx, ov, true));
  }

  function applyPixelMode(image, mode) {
    const settings = {
      "4bit": { block: 14, step: 64 },
      "8bit": { block: 8, step: 32 },
      "16bit": { block: 4, step: 8 },
      "32bit": { block: 2, step: 4 },
    }[mode];
    if (!settings) return;
    const { width, height, data } = image;
    const { block, step } = settings;
    for (let y = 0; y < height; y += block) {
      for (let x = 0; x < width; x += block) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = 0; dy < block && y + dy < height; dy++) {
          for (let dx = 0; dx < block && x + dx < width; dx++) {
            const i = ((y + dy) * width + (x + dx)) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count += 1;
          }
        }
        r = Math.round(r / count / step) * step;
        g = Math.round(g / count / step) * step;
        b = Math.round(b / count / step) * step;
        for (let dy = 0; dy < block && y + dy < height; dy++) {
          for (let dx = 0; dx < block && x + dx < width; dx++) {
            const i = ((y + dy) * width + (x + dx)) * 4;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
        }
      }
    }
  }

  function handlePx() {
    const rect = els.gifCanvas.getBoundingClientRect();
    const scale = els.gifCanvas.width / Math.max(rect.width, 1);
    return Math.max(18 * scale, 14);
  }

  function overlayBox(ov) {
    const w = ov.type === "text" ? Math.max(48, ov.text.length * ov.size * 0.62) : ov.size * 1.15;
    const h = ov.size * 1.25;
    return { x: ov.x - w / 2, y: ov.y - h / 2, w, h };
  }

  function deleteHandle(ov) {
    const box = overlayBox(ov);
    const s = handlePx();
    return { x: box.x + box.w - s / 2, y: box.y - s / 2, s };
  }

  function resizeHandle(ov) {
    const box = overlayBox(ov);
    const s = handlePx();
    return { x: box.x + box.w - s / 2, y: box.y + box.h - s / 2, s };
  }

  function inHandle(x, y, h) {
    return x >= h.x && x <= h.x + h.s && y >= h.y && y <= h.y + h.s;
  }

  function drawHandleCircle(ctx, h, fill, kind) {
    ctx.save();
    ctx.setLineDash([]);
    const r = h.s / 2;
    const cx = h.x + r;
    const cy = h.y + r;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r / 7);
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.strokeStyle = "white";
    ctx.lineCap = "round";
    if (kind === "delete") {
      const d = r * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx - d, cy - d);
      ctx.lineTo(cx + d, cy + d);
      ctx.moveTo(cx + d, cy - d);
      ctx.lineTo(cx - d, cy + d);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.35, cy + r * 0.15);
      ctx.lineTo(cx + r * 0.35, cy + r * 0.15);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.15, cy - r * 0.35);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.35);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverlay(ctx, ov, chrome) {
    ctx.save();
    if (ov.type === "text") {
      ctx.font = `800 ${ov.size}px "Segoe UI", "Noto Sans KR", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(3, ov.size / 10);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(ov.text, ov.x, ov.y);
      ctx.fillStyle = ov.color;
      ctx.fillText(ov.text, ov.x, ov.y);
    } else {
      ctx.font = `${ov.size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ov.emoji, ov.x, ov.y);
    }
    if (chrome) {
      const box = overlayBox(ov);
      ctx.strokeStyle = ov.id === gifEdit.selectedId ? "#35c1ff" : "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash(ov.id === gifEdit.selectedId ? [5, 4] : []);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      drawHandleCircle(ctx, deleteHandle(ov), "#d92d20", "delete");
      drawHandleCircle(ctx, resizeHandle(ov), "#1a56c4", "resize");
      return;
    }
    ctx.restore();
  }

  function hitOverlay(x, y) {
    if (!gifEdit) return null;
    for (let i = gifEdit.overlays.length - 1; i >= 0; i--) {
      const ov = gifEdit.overlays[i];
      if (inHandle(x, y, deleteHandle(ov))) return { kind: "delete", ov };
      if (inHandle(x, y, resizeHandle(ov))) return { kind: "resize", ov };
      const box = overlayBox(ov);
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        return { kind: "move", ov };
      }
    }
    return null;
  }

  function canvasPoint(e) {
    const rect = els.gifCanvas.getBoundingClientRect();
    const scaleX = els.gifCanvas.width / rect.width;
    const scaleY = els.gifCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  els.gifCanvas.addEventListener("pointerdown", (e) => {
    if (!gifEdit) return;
    const pt = canvasPoint(e);
    const hit = hitOverlay(pt.x, pt.y);
    if (!hit) {
      gifEdit.selectedId = null;
      gifEdit.drag = null;
      drawGifFrame();
      return;
    }
    gifEdit.selectedId = hit.ov.id;
    if (hit.kind === "delete") {
      snapshotEdit();
      gifEdit.overlays = gifEdit.overlays.filter((o) => o.id !== hit.ov.id);
      gifEdit.selectedId = null;
      gifEdit.drag = null;
      drawGifFrame();
      return;
    }
    snapshotEdit();
    els.gifCanvas.setPointerCapture(e.pointerId);
    if (hit.kind === "resize") {
      const dist = Math.max(8, Math.hypot(pt.x - hit.ov.x, pt.y - hit.ov.y));
      gifEdit.drag = { kind: "resize", id: hit.ov.id, startSize: hit.ov.size, startDist: dist };
    } else {
      gifEdit.drag = { kind: "move", id: hit.ov.id, dx: pt.x - hit.ov.x, dy: pt.y - hit.ov.y };
    }
    drawGifFrame();
  });
  els.gifCanvas.addEventListener("pointermove", (e) => {
    if (!gifEdit) return;
    const pt = canvasPoint(e);
    if (!gifEdit.drag) {
      const hit = hitOverlay(pt.x, pt.y);
      els.gifCanvas.style.cursor = hit
        ? hit.kind === "delete"
          ? "pointer"
          : hit.kind === "resize"
            ? "nwse-resize"
            : "grab"
        : "default";
      return;
    }
    const ov = gifEdit.overlays.find((o) => o.id === gifEdit.drag.id);
    if (!ov) return;
    if (gifEdit.drag.kind === "resize") {
      const dist = Math.max(8, Math.hypot(pt.x - ov.x, pt.y - ov.y));
      ov.size = Math.max(16, Math.min(160, gifEdit.drag.startSize * (dist / gifEdit.drag.startDist)));
    } else {
      ov.x = pt.x - gifEdit.drag.dx;
      ov.y = pt.y - gifEdit.drag.dy;
    }
  });
  els.gifCanvas.addEventListener("pointerup", () => {
    if (gifEdit) gifEdit.drag = null;
  });

  els.addTextBtn.addEventListener("click", () => {
    if (!gifEdit) return;
    const text = els.textInput.value.trim();
    if (!text) {
      showToast("bad", "넣을 텍스트를 입력하세요.");
      return;
    }
    snapshotEdit();
    gifEdit.overlays.push({
      id: crypto.randomUUID(),
      type: "text",
      text,
      color: els.textColor.value,
      size: Number(els.textSize.value) || 32,
      x: gifEdit.item.width / 2,
      y: gifEdit.item.height / 2,
    });
    gifEdit.selectedId = gifEdit.overlays.at(-1).id;
    els.textInput.value = "";
  });

  els.stickerGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sticker]");
    if (!btn || !gifEdit) return;
    snapshotEdit();
    gifEdit.overlays.push({
      id: crypto.randomUUID(),
      type: "sticker",
      emoji: btn.dataset.sticker,
      size: 48,
      x: gifEdit.item.width / 2,
      y: gifEdit.item.height / 2,
    });
    gifEdit.selectedId = gifEdit.overlays.at(-1).id;
  });

  function deleteSelectedOverlay() {
    if (!gifEdit || !gifEdit.selectedId) {
      showToast("bad", "삭제할 텍스트나 스티커를 먼저 선택하세요.");
      return;
    }
    snapshotEdit();
    gifEdit.overlays = gifEdit.overlays.filter((o) => o.id !== gifEdit.selectedId);
    gifEdit.selectedId = null;
  }

  els.deleteOverlayBtn.addEventListener("click", deleteSelectedOverlay);

  els.pixelMode.addEventListener("change", () => {
    if (!gifEdit) return;
    snapshotEdit();
    gifEdit.pixelMode = els.pixelMode.value;
  });

  els.undoBtn.addEventListener("click", () => {
    if (!gifEdit || !gifEdit.history.length) {
      showToast("bad", "되돌릴 편집이 없습니다.");
      return;
    }
    const prev = JSON.parse(gifEdit.history.pop());
    gifEdit.overlays = prev.overlays;
    gifEdit.pixelMode = prev.pixelMode;
    els.pixelMode.value = prev.pixelMode;
    gifEdit.selectedId = null;
  });

  els.resetBtn.addEventListener("click", () => {
    if (!gifEdit) return;
    snapshotEdit();
    gifEdit.overlays = [];
    gifEdit.pixelMode = "none";
    els.pixelMode.value = "none";
    gifEdit.selectedId = null;
    showToast("ok", "원본 GIF 상태로 되돌렸습니다.");
  });

  els.saveGifBtn.addEventListener("click", async () => {
    if (!gifEdit) return;
    const item = gifEdit.item;
    const canvas = document.createElement("canvas");
    canvas.width = item.width;
    canvas.height = item.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const outFrames = [];
    els.gifProgressBlock.hidden = false;
    els.saveGifBtn.disabled = true;
    try {
      for (let i = 0; i < item.frames.length; i++) {
        const image = new ImageData(new Uint8ClampedArray(item.frames[i]), item.width, item.height);
        applyPixelMode(image, gifEdit.pixelMode);
        ctx.putImageData(image, 0, 0);
        gifEdit.overlays.forEach((ov) => drawOverlay(ctx, ov, false));
        outFrames.push(ctx.getImageData(0, 0, item.width, item.height).data);
        const pct = Math.round(((i + 1) / item.frames.length) * 70);
        els.gifProgressBar.style.width = `${pct}%`;
        els.gifProgressPct.textContent = `${pct}%`;
        els.gifProgressText.textContent = `프레임 합성 ${i + 1}/${item.frames.length}`;
        await new Promise((r) => setTimeout(r, 0));
      }
      const blob = await encodeAnimatedGif(outFrames, item.width, item.height, item.delay, (p) => {
        const pct = Math.round(70 + p * 30);
        els.gifProgressBar.style.width = `${pct}%`;
        els.gifProgressPct.textContent = `${pct}%`;
        els.gifProgressText.textContent = "GIF로 저장하는 중...";
      });
      URL.revokeObjectURL(item.url);
      item.blob = blob;
      item.url = URL.createObjectURL(blob);
      renderGifLibrary();
      els.gifProgressBar.style.width = "100%";
      els.gifProgressPct.textContent = "100%";
      els.gifProgressText.textContent = "저장 완료";
      showToast("ok", `편집한 GIF를 저장했습니다. ${item.name}`);
    } catch (err) {
      showToast("bad", err.message || "GIF 저장에 실패했습니다.");
    } finally {
      els.saveGifBtn.disabled = false;
    }
  });
})();
