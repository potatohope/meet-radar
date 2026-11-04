/* ===== 遇见雷达 · 宠物人格测评 前端逻辑 ===== */

// 后端地址：阿里云函数计算 FC 3.0 的 HTTP 触发器公网地址
const API_BASE = "https://pet-radar-api-rajzqnsefr.cn-hangzhou.fcapp.run";

const DIMENSIONS = ["亲密度", "活力值", "傲娇度", "聪明值", "贪吃度", "独立度"];

let photoDataUrl = null;   // 压缩后 data URL，用于预览与海报
let photoBase64 = null;    // 纯 base64，用于接口
let species = "猫咪";
let lastResult = null;
let radarChart = null;
let currentPage = 0;
let pageCount = 8;

const $ = (id) => document.getElementById(id);

/* ---------- 视图切换 ---------- */
function showView(id) {
  ["view-home", "view-loading", "view-result"].forEach((v) => {
    $(v).style.display = v === id ? "block" : "none";
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- 上传与预览 ---------- */
const dropZone = $("dropZone");
const fileInput = $("fileInput");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault(); dropZone.classList.remove("drag");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith("image/")) { toast("请上传图片文件哦"); return; }
  compressImage(file).then(({ dataUrl, base64 }) => {
    photoDataUrl = dataUrl;
    photoBase64 = base64;
    $("previewImg").src = dataUrl;
    $("dzPreview").style.display = "block";
    $("dzEmpty").style.display = "none";
  });
}

function compressImage(file, maxW = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const scale = Math.min(1, maxW / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ dataUrl, base64: dataUrl.split(",")[1] });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- 物种选择 ---------- */
document.querySelectorAll(".pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    species = pill.dataset.species;
  });
});

/* ---------- 开始测评 ---------- */
$("btnStart").addEventListener("click", startAssessment);

async function startAssessment() {
  if (!photoDataUrl) { toast("先上传一张照片吧 📸"); return; }
  const name = $("petName").value.trim() || "毛孩子";
  const adjective = $("petAdj").value.trim();

  $("btnStart").disabled = true;
  showView("view-loading");
  cycleLoading();

  try {
    const resp = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo: photoBase64, name, species, adjective }),
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "测评失败");
    lastResult = { ...data.result, name, species };
    openReport();
    showView("view-result");
  } catch (err) {
    toast("测评失败：" + err.message);
    showView("view-home");
  } finally {
    $("btnStart").disabled = false;
  }
}

function cycleLoading() {
  const texts = [
    "正在观察它的眼神…",
    "分析它的微表情…",
    "琢磨它的傲娇指数…",
    "推测它的前世身份…",
    "解读它的内心戏…",
    "马上揭晓隐藏人格…",
  ];
  let i = 0;
  window.__loadingTimer && clearInterval(window.__loadingTimer);
  window.__loadingTimer = setInterval(() => {
    i = (i + 1) % texts.length;
    $("loadingText").textContent = texts[i];
  }, 1500);
}

/* ---------- 多页报告 ---------- */
function openReport() {
  currentPage = 0;
  renderPage(0);
}

function renderPage(idx) {
  currentPage = idx;
  const r = lastResult;
  const stage = $("reportStage");
  stage.innerHTML = buildPage(idx, r);
  stage.classList.remove("anim");
  void stage.offsetWidth; // 触发重排以重放入场动画
  stage.classList.add("anim");

  // 进度
  $("progressFill").style.width = ((idx + 1) / pageCount * 100) + "%";
  $("progressLabel").textContent = (idx + 1) + " / " + pageCount;

  // 导航
  const prev = $("btnPrev");
  const next = $("btnNext");
  prev.style.display = idx === 0 ? "none" : "block";
  if (idx === pageCount - 1) {
    $("reportNav").style.display = "none";
  } else {
    $("reportNav").style.display = "flex";
    next.textContent = "下一页 ›";
  }

  // 雷达页需要可见时再绘制
  if (idx === 1) drawRadar(r.scores || {});
  if (idx === pageCount - 1) generatePoster();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildPage(idx, r) {
  const s = r.scores || {};
  const dc = r.dimensionComments || {};
  switch (idx) {
    case 0: return coverPage(r);
    case 1: return radarPage(r, s, dc);
    case 2: return tagsPage(r);
    case 3: return innerPage(r);
    case 4: return pastLifePage(r);
    case 5: return seeYouPage(r);
    case 6: return guidePage(r);
    case 7: return finalPage(r);
    default: return "";
  }
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* 第 1 页：揭晓 */
function coverPage(r) {
  return `
    <div class="page page-cover">
      <div class="page-eyebrow">✨ AI 人格报告 · 隐藏人格揭晓</div>
      <div class="cover-photo">
        <img src="${photoDataUrl}" alt="${esc(r.name)}的照片" />
        <span class="cover-emoji">${esc(r.emoji || "🐾")}</span>
      </div>
      <h2 class="cover-type">${esc(r.type || "神秘型")}</h2>
      <p class="cover-tagline">${esc(r.tagline || "")}</p>
      <p class="cover-name">—— ${esc(r.name || "毛孩子")} ——</p>
    </div>`;
}

/* 第 2 页：六维画像 */
function radarPage(r, s, dc) {
  const dims = DIMENSIONS.map((d) => `
    <div class="dim-item">
      <div class="dim-top"><span class="dim-name">${d}</span><span class="dim-score">${s[d] ?? 50}</span></div>
      <p class="dim-desc">${esc(dc[d] || "")}</p>
    </div>`).join("");
  return `
    <div class="page">
      <div class="page-eyebrow">📊 六维人格画像</div>
      <h2 class="page-title">每个维度，<br />都是它的小宇宙</h2>
      <div class="radar-wrap"><canvas id="radarChart"></canvas></div>
      <div class="dim-list">${dims}</div>
    </div>`;
}

/* 第 3 页：性格标签 */
function tagsPage(r) {
  const tags = (r.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const comments = (r.comments || []).map((c) => `<li>${esc(c)}</li>`).join("");
  return `
    <div class="page">
      <div class="page-eyebrow">🏷️ 性格关键词</div>
      <h2 class="page-title">贴在它身上<br />刚刚好的标签</h2>
      <div class="tag-wall">${tags}</div>
      <ul class="comment-list">${comments}</ul>
    </div>`;
}

/* 第 4 页：内心世界 */
function innerPage(r) {
  return `
    <div class="page">
      <div class="page-eyebrow">💭 它的内心世界</div>
      <h2 class="page-title">其实它每天<br />都在想这些</h2>
      <div class="monologue-card">${esc(r.monologue || "")}</div>
      <div class="mini-card"><span class="mini-ico">💬</span><div><b>口头禅</b><p>${esc(r.catchphrase || "")}</p></div></div>
      <div class="mini-card"><span class="mini-ico">🤫</span><div><b>小秘密</b><p>${esc(r.secret || "")}</p></div></div>
    </div>`;
}

/* 第 5 页：前世今生 */
function pastLifePage(r) {
  return `
    <div class="page">
      <div class="page-eyebrow">🕰️ 前世今生</div>
      <h2 class="page-title">上辈子的它<br />可能是个大人物</h2>
      <div class="pastlife-badge">${esc(r.pastLife || "")}</div>
      <p class="story">${esc(r.pastLifeStory || "")}</p>
    </div>`;
}

/* 第 6 页：在它眼里你是谁 */
function seeYouPage(r) {
  return `
    <div class="page">
      <div class="page-eyebrow">👀 在它眼里，你是…</div>
      <h2 class="page-title">你可能不知道<br />它有多依赖你</h2>
      <div class="see-card">${esc(r.howItSeesYou || "")}</div>
    </div>`;
}

/* 第 7 页：相处指南 */
function guidePage(r) {
  return `
    <div class="page">
      <div class="page-eyebrow">📖 相处指南</div>
      <h2 class="page-title">读懂它<br />就这几招</h2>
      <div class="advice-card">${esc(r.advice || "")}</div>
      <div class="mini-card"><span class="mini-ico">🎯</span><div><b>隐藏天赋</b><p>${esc(r.talents || "")}</p></div></div>
    </div>`;
}

/* 第 8 页：总结 + 行动 */
function finalPage(r) {
  return `
    <div class="page page-final">
      <div class="page-eyebrow">💌 最后的悄悄话</div>
      <h2 class="page-title">遇见你<br />是它最大的幸运</h2>
      <div class="summary-card">${esc(r.summary || "")}</div>
      <div class="final-actions">
        <button class="btn-primary" data-action="share">分享结果 🐾</button>
        <button class="btn-ghost" data-action="retake">再测一次</button>
      </div>
      <p class="final-note">快乐第一，别太当真 🐾</p>
    </div>`;
}

/* ---------- 雷达图 ---------- */
function drawRadar(scores) {
  const labels = DIMENSIONS;
  const values = labels.map((d) => scores[d] ?? 50);
  const canvas = $("radarChart");
  if (!canvas) return;
  if (radarChart) radarChart.destroy();
  const ctx = canvas.getContext("2d");
  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "rgba(255,138,76,0.22)",
        borderColor: "#ff8a4c",
        borderWidth: 2,
        pointBackgroundColor: "#ff6b8a",
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: "rgba(240,140,70,0.15)" },
          angleLines: { color: "rgba(240,140,70,0.15)" },
          pointLabels: { font: { size: 13 }, color: "#57453a" },
        },
      },
    },
  });
}

/* ---------- 导航 ---------- */
$("btnNext").addEventListener("click", () => {
  if (currentPage < pageCount - 1) renderPage(currentPage + 1);
});
$("btnPrev").addEventListener("click", () => {
  if (currentPage > 0) renderPage(currentPage - 1);
});

/* 页内按钮（事件委托） */
$("reportStage").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "share") openShare();
  else if (action === "retake") retake();
});

/* ---------- 分享海报生成 ---------- */
function generatePoster() {
  if (!lastResult) return;
  const r = lastResult;
  const W = 750, H = 1200;
  const canvas = $("posterCanvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#FFB56B");
  bg.addColorStop(0.55, "#FF8A6B");
  bg.addColorStop(1, "#FF6B8A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  [[80, 140, 26], [660, 200, 18], [60, 960, 22], [690, 1040, 14], [620, 120, 12]].forEach(([x, y, rad]) => {
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 30px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText("🐾 隐藏人格揭晓 🐾", W / 2, 78);

  const img = new Image();
  img.onload = () => {
    drawPosterBody(ctx, img, r, W, H);
    $("sharePoster").src = canvas.toDataURL("image/png");
  };
  img.onerror = () => { drawPosterBody(ctx, null, r, W, H); $("sharePoster").src = canvas.toDataURL("image/png"); };
  img.src = photoDataUrl;
}

function drawPosterBody(ctx, img, r, W, H) {
  const phSize = 280, phY = 110;
  roundRectPath(ctx, W / 2 - phSize / 2, phY, phSize, phSize, 28);
  ctx.save();
  ctx.clip();
  if (img) {
    const cover = coverRect(img.width, img.height, phSize, phSize);
    ctx.drawImage(img, W / 2 - phSize / 2 + cover.dx, phY + cover.dy, cover.dw, cover.dh);
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(W / 2 - phSize / 2, phY, phSize, phSize);
    ctx.fillStyle = "#ff8a4c";
    ctx.font = "120px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🐾", W / 2, phY + phSize / 2 + 40);
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 52px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText((r.emoji || "🐾") + " " + (r.type || ""), W / 2, 470);

  ctx.font = "26px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.globalAlpha = 0.95;
  ctx.fillText(r.tagline || "", W / 2, 520);
  ctx.globalAlpha = 1;

  ctx.font = "22px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText("—— " + (r.name || "毛孩子") + " ——", W / 2, 560);
  ctx.globalAlpha = 1;

  const scores = r.scores || {};
  const barX = 150, barW = 450, startY = 620, gap = 62, barH = 18;
  DIMENSIONS.forEach((d, i) => {
    const y = startY + i * gap;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "24px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText(d, barX, y + 12);
    ctx.textAlign = "right";
    ctx.fillText(String(scores[d] ?? 50), barX + barW, y + 12);
    roundRectPath(ctx, barX, y, barW, barH, barH / 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
    const v = Math.max(6, (scores[d] ?? 50));
    roundRectPath(ctx, barX, y, barW * v / 100, barH, barH / 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "24px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.globalAlpha = 0.95;
  wrapText(ctx, r.monologue || "", W / 2, 1040, W - 120, 34);
  ctx.globalAlpha = 1;

  ctx.font = "22px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.globalAlpha = 0.9;
  ctx.fillText("—— 遇见雷达 · 宠物人格测评 ——", W / 2, 1130);
  ctx.globalAlpha = 1;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function coverRect(iw, ih, w, h) {
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const chars = [...text];
  let line = "";
  let curY = y;
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      ctx.fillText(line, cx, curY);
      line = ch; curY += lineH;
    } else {
      line += ch;
    }
  }
  if (line) ctx.fillText(line, cx, curY);
}

/* ---------- 分享操作 ---------- */
function openShare() {
  $("shareModal").style.display = "flex";
}
$("shareClose").addEventListener("click", () => { $("shareModal").style.display = "none"; });
$("shareModal").addEventListener("click", (e) => {
  if (e.target === $("shareModal")) $("shareModal").style.display = "none";
});

$("btnDownload").addEventListener("click", () => {
  const canvas = $("posterCanvas");
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "宠物人格测评_" + (lastResult?.name || "毛孩子") + ".png";
  a.click();
  toast("海报已保存 📸");
});

$("btnCopy").addEventListener("click", async () => {
  const r = lastResult;
  const scores = r?.scores || {};
  const text =
    `🐾 我家${r?.species || "毛孩子"}「${r?.name || "它"}」的隐藏人格揭晓：${r?.emoji || ""} ${r?.type || ""}！\n` +
    `${r?.tagline || ""}\n` +
    `亲密度${scores["亲密度"] ?? ""} · 活力值${scores["活力值"] ?? ""} · 傲娇度${scores["傲娇度"] ?? ""}\n` +
    `聪明值${scores["聪明值"] ?? ""} · 贪吃度${scores["贪吃度"] ?? ""} · 独立度${scores["独立度"] ?? ""}\n` +
    `💬 它的口头禅：「${r?.catchphrase || "……"}」\n` +
    `快来「遇见雷达」测测你家毛孩子是什么隐藏人格吧 🐾`;
  try {
    await navigator.clipboard.writeText(text);
    toast("文案已复制 ✅");
  } catch {
    toast("复制失败，请长按文字手动复制");
  }
});

/* ---------- 再测一次 ---------- */
function retake() {
  clearInterval(window.__loadingTimer);
  $("dzPreview").style.display = "none";
  $("dzEmpty").style.display = "block";
  $("previewImg").src = "";
  $("petName").value = "";
  $("petAdj").value = "";
  photoDataUrl = null; photoBase64 = null; lastResult = null;
  currentPage = 0;
  fileInput.value = "";
  showView("view-home");
}

/* ---------- 工具 ---------- */
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(t.__timer);
  t.__timer = setTimeout(() => { t.style.display = "none"; }, 2200);
}
