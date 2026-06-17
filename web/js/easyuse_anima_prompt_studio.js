import { app } from "../../../scripts/app.js";

const NODE_TYPE = "EasyUseAnimaPromptStudio";
const FIELD_NAMES = [
  "lora_trigger_tags",
  "quality_tags",
  "trigger_and_artist_tags",
  "prompt",
  "trailing_quality_tags",
];

const FIELD_HEIGHTS = {
  lora_trigger_tags: 42,
  quality_tags: 72,
  trigger_and_artist_tags: 72,
  prompt: 150,
  trailing_quality_tags: 72,
};

const SECTION_STYLES = {
  count: { label: "인원수", fill: "#2563eb", text: "#ffffff" },
  character: { label: "캐릭터", fill: "#db2777", text: "#ffffff" },
  artist: { label: "작가", fill: "#7c3aed", text: "#ffffff" },
  copyright: { label: "작품", fill: "#ea580c", text: "#ffffff" },
  meta: { label: "메타", fill: "#64748b", text: "#ffffff" },
  general: { label: "학습 태그", fill: "#16a34a", text: "#ffffff" },
  natural: { label: "자연어", fill: "#475569", text: "#ffffff" },
  unknown: { label: "미확인", fill: "#dc2626", text: "#ffffff" },
};

const PANEL_MIN_HEIGHT = 118;
const PANEL_MAX_HEIGHT = 260;

function findWidget(node, name) {
  return node.widgets?.find((widget) => widget.name === name);
}

function refreshNodeSize(node) {
  requestAnimationFrame(() => {
    const size = node.computeSize();
    node.onResize?.([Math.max(size[0], node.size[0]), Math.max(size[1], node.size[1])]);
    app.graph.setDirtyCanvas(true, true);
  });
}

function debounce(fn, delay = 180) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function combinedPromptText(node) {
  return FIELD_NAMES
    .map((name) => String(findWidget(node, name)?.value ?? ""))
    .filter((value) => value.trim())
    .join(", ");
}

async function classifyPrompt(text) {
  const response = await fetch("/easyuse_anima/classify_prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, limit: 240 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return Array.isArray(data.tokens) ? data.tokens : [];
}

function addCustomWidget(node, widget) {
  if (typeof node.addCustomWidget === "function") {
    node.addCustomWidget(widget);
  } else {
    node.widgets ||= [];
    node.widgets.push(widget);
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawLegend(ctx, width, y) {
  const sections = ["count", "character", "artist", "copyright", "general", "unknown"];
  let x = 12;
  ctx.font = "10px sans-serif";
  for (const section of sections) {
    const style = SECTION_STYLES[section];
    const label = style.label;
    const chipWidth = ctx.measureText(label).width + 18;
    if (x + chipWidth > width - 12) {
      break;
    }
    ctx.fillStyle = style.fill;
    roundedRect(ctx, x, y, chipWidth, 16, 8);
    ctx.fill();
    ctx.fillStyle = style.text;
    ctx.fillText(label, x + 9, y + 11);
    x += chipWidth + 5;
  }
}

function tokenLabel(token) {
  const label = token.label || SECTION_STYLES[token.section]?.label || token.section || "태그";
  return token.learned ? `${token.token} · ${label}` : `${token.token} · ${label}`;
}

function drawTokenChips(ctx, tokens, width, y) {
  let x = 12;
  let rowY = y;
  let rows = 1;
  ctx.font = "11px sans-serif";

  for (const token of tokens.slice(0, 120)) {
    const style = SECTION_STYLES[token.section] || SECTION_STYLES.unknown;
    const label = tokenLabel(token);
    const chipWidth = Math.min(width - 24, ctx.measureText(label).width + 18);
    if (x + chipWidth > width - 12) {
      x = 12;
      rowY += 22;
      rows += 1;
    }
    if (rowY > y + PANEL_MAX_HEIGHT - 42) {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`+${tokens.length - tokens.indexOf(token)} more`, x, rowY + 13);
      break;
    }
    ctx.fillStyle = style.fill;
    roundedRect(ctx, x, rowY, chipWidth, 18, 9);
    ctx.fill();
    if (token.learned) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = 1;
      roundedRect(ctx, x + 0.5, rowY + 0.5, chipWidth - 1, 17, 8);
      ctx.stroke();
    }
    ctx.fillStyle = style.text;
    ctx.fillText(label, x + 9, rowY + 13);
    x += chipWidth + 6;
  }

  return rows;
}

function ensureAnalysisWidget(node) {
  let widget = findWidget(node, "easyuse_anima_tag_analysis");
  if (widget) {
    return widget;
  }

  widget = {
    name: "easyuse_anima_tag_analysis",
    type: "easyuse_anima_tag_analysis",
    serialize: false,
    __height: PANEL_MIN_HEIGHT,
    __tokens: [],
    __status: "Type prompt text to classify tags.",
    computeSize(width) {
      return [width, this.__height];
    },
    draw(ctx, _node, width, y) {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      roundedRect(ctx, 8, y + 4, width - 16, this.__height - 8, 8);
      ctx.fill();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px sans-serif";
      ctx.fillText("Anima tag analysis", 14, y + 21);
      drawLegend(ctx, width, y + 30);

      if (!this.__tokens.length) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px sans-serif";
        ctx.fillText(this.__status, 14, y + 60);
      } else {
        const rows = drawTokenChips(ctx, this.__tokens, width, y + 54);
        const nextHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, 76 + rows * 22));
        if (Math.abs(nextHeight - this.__height) > 4) {
          this.__height = nextHeight;
          refreshNodeSize(_node);
        }
      }

      ctx.restore();
    },
  };
  addCustomWidget(node, widget);
  return widget;
}

function enhanceResizableInput(node, widget) {
  const input = widget?.inputEl;
  if (!(input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement)) {
    return;
  }
  if (input.__easyuseAnimaStudioResizable) {
    return;
  }

  const defaultHeight = FIELD_HEIGHTS[widget.name] || 72;
  widget.__easyuseAnimaHeight = Math.max(defaultHeight, widget.__easyuseAnimaHeight || 0);
  input.style.resize = "vertical";
  input.style.minHeight = `${Math.min(defaultHeight, 54)}px`;
  input.style.height = `${widget.__easyuseAnimaHeight}px`;

  const computeSize = widget.computeSize;
  widget.computeSize = function (width) {
    const base = computeSize?.apply(this, arguments) || [width, defaultHeight];
    return [base[0], Math.max(base[1], this.__easyuseAnimaHeight || defaultHeight)];
  };

  const syncHeight = () => {
    const height = Math.max(defaultHeight, Math.round(input.getBoundingClientRect().height));
    if (Math.abs(height - widget.__easyuseAnimaHeight) > 2) {
      widget.__easyuseAnimaHeight = height;
      refreshNodeSize(node);
    }
  };

  input.addEventListener("mouseup", syncHeight);
  input.addEventListener("keyup", syncHeight);
  input.__easyuseAnimaStudioResizable = true;
}

function hookStudioNode(node) {
  const analysis = ensureAnalysisWidget(node);
  let classifySeq = 0;

  const update = debounce(async () => {
    const text = combinedPromptText(node);
    if (!text.trim()) {
      analysis.__tokens = [];
      analysis.__status = "Type prompt text to classify tags.";
      app.graph.setDirtyCanvas(true, false);
      return;
    }
    const seq = ++classifySeq;
    analysis.__status = "Classifying tags...";
    app.graph.setDirtyCanvas(true, false);
    try {
      const tokens = await classifyPrompt(text);
      if (seq !== classifySeq) {
        return;
      }
      analysis.__tokens = tokens;
      analysis.__status = tokens.length ? "" : "No tags detected.";
      refreshNodeSize(node);
    } catch (error) {
      if (seq !== classifySeq) {
        return;
      }
      analysis.__tokens = [];
      analysis.__status = `Tag analysis failed: ${error.message || error}`;
      app.graph.setDirtyCanvas(true, false);
    }
  });

  for (const name of FIELD_NAMES) {
    const widget = findWidget(node, name);
    if (!widget || widget.__easyuseAnimaStudioHooked) {
      continue;
    }
    enhanceResizableInput(node, widget);
    const callback = widget.callback;
    widget.callback = function (value) {
      const result = callback?.apply(this, arguments);
      update();
      return result;
    };
    widget.inputEl?.addEventListener("input", update);
    widget.__easyuseAnimaStudioHooked = true;
  }

  update();
}

app.registerExtension({
  name: "easyuse-anima.prompt-studio",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) {
      return;
    }

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);
      hookStudioNode(this);
    };

    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      onConfigure?.apply(this, arguments);
      hookStudioNode(this);
    };
  },
});
