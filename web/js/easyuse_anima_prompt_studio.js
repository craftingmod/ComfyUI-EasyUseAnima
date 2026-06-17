import { app } from "../../../scripts/app.js";

const NODE_TYPE = "EasyUseAnimaPromptStudio";
const FIELD_NAMES = [
  "lora_trigger_tags",
  "quality_tags",
  "trigger_and_artist_tags",
  "prompt",
  "trailing_quality_tags",
];

const FIELD_LABELS = {
  lora_trigger_tags: "LoRA trigger render",
  quality_tags: "Leading quality render",
  trigger_and_artist_tags: "Trigger / artist render",
  prompt: "Prompt render",
  trailing_quality_tags: "Trailing render",
};

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

const RENDER_MIN_HEIGHT = 34;
const RENDER_MAX_HEIGHT = 132;
const CHIP_HEIGHT = 18;
const CHIP_GAP = 6;

function findWidget(node, name) {
  return node.widgets?.find((widget) => widget.name === name);
}

function refreshNodeSize(node) {
  requestAnimationFrame(() => {
    const size = node.computeSize();
    const width = Math.max(size[0], node.size?.[0] || size[0]);
    const height = Math.max(size[1], 80);
    if (
      Math.abs(width - (node.size?.[0] || 0)) > 1
      || Math.abs(height - (node.size?.[1] || 0)) > 1
    ) {
      node.onResize?.([width, height]);
    }
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

function insertCustomWidgetAfter(node, afterWidget, widget) {
  node.widgets ||= [];
  const current = node.widgets.indexOf(widget);
  if (current >= 0) {
    node.widgets.splice(current, 1);
  }
  const after = node.widgets.indexOf(afterWidget);
  node.widgets.splice(after >= 0 ? after + 1 : node.widgets.length, 0, widget);
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

function tokenLabel(token) {
  const style = SECTION_STYLES[token.section];
  const section = token.label || style?.label || token.section || "태그";
  return `${token.base || token.token} · ${section}`;
}

function chipRows(ctx, tokens, width) {
  if (!tokens.length) {
    return 1;
  }
  let x = 12;
  let rows = 1;
  ctx.font = "11px sans-serif";
  for (const token of tokens) {
    const label = tokenLabel(token);
    const chipWidth = Math.min(width - 24, ctx.measureText(label).width + 18);
    if (x + chipWidth > width - 12) {
      x = 12;
      rows += 1;
    }
    x += chipWidth + CHIP_GAP;
  }
  return rows;
}

function desiredRenderHeight(ctx, tokens, width) {
  if (!tokens.length) {
    return RENDER_MIN_HEIGHT;
  }
  const rows = chipRows(ctx, tokens, width);
  return Math.max(RENDER_MIN_HEIGHT, Math.min(RENDER_MAX_HEIGHT, 26 + rows * (CHIP_HEIGHT + 4)));
}

function drawRenderPanel(ctx, widget, width, y) {
  const tokens = widget.__tokens || [];
  const title = FIELD_LABELS[widget.__fieldName] || "Prompt render";

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  roundedRect(ctx, 8, y + 3, width - 16, widget.__height - 6, 7);
  ctx.fill();

  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(title, 14, y + 16);

  if (!tokens.length) {
    ctx.fillStyle = "#64748b";
    ctx.fillText(widget.__status || "No rendered tags.", 14, y + 30);
    ctx.restore();
    return;
  }

  let x = 12;
  let rowY = y + 22;
  ctx.font = "11px sans-serif";
  for (const token of tokens.slice(0, 96)) {
    const style = SECTION_STYLES[token.section] || SECTION_STYLES.unknown;
    const label = tokenLabel(token);
    const chipWidth = Math.min(width - 24, ctx.measureText(label).width + 18);
    if (x + chipWidth > width - 12) {
      x = 12;
      rowY += CHIP_HEIGHT + 4;
    }
    if (rowY + CHIP_HEIGHT > y + widget.__height - 8) {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`+${tokens.length - tokens.indexOf(token)} more`, x, rowY + 13);
      break;
    }
    ctx.fillStyle = style.fill;
    roundedRect(ctx, x, rowY, chipWidth, CHIP_HEIGHT, 9);
    ctx.fill();
    if (token.learned) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = 1;
      roundedRect(ctx, x + 0.5, rowY + 0.5, chipWidth - 1, CHIP_HEIGHT - 1, 8);
      ctx.stroke();
    }
    ctx.fillStyle = style.text;
    ctx.fillText(label, x + 9, rowY + 13);
    x += chipWidth + CHIP_GAP;
  }

  ctx.restore();
}

function ensureRenderWidget(node, sourceWidget) {
  const name = `easyuse_anima_render_${sourceWidget.name}`;
  let widget = findWidget(node, name);
  if (widget) {
    insertCustomWidgetAfter(node, sourceWidget, widget);
    return widget;
  }

  widget = {
    name,
    type: "easyuse_anima_field_render",
    serialize: false,
    __fieldName: sourceWidget.name,
    __height: RENDER_MIN_HEIGHT,
    __tokens: [],
    __status: "No rendered tags.",
    computeSize(width) {
      return [width, this.__height];
    },
    draw(ctx, _node, width, y) {
      const nextHeight = desiredRenderHeight(ctx, this.__tokens || [], width);
      if (Math.abs(nextHeight - this.__height) > 2) {
        this.__height = nextHeight;
        refreshNodeSize(_node);
      }
      drawRenderPanel(ctx, this, width, y);
    },
  };
  insertCustomWidgetAfter(node, sourceWidget, widget);
  return widget;
}

function enhanceResizableInput(node, widget) {
  const input = widget?.inputEl;
  if (!(input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement)) {
    return;
  }

  const defaultHeight = FIELD_HEIGHTS[widget.name] || 72;
  const readInputHeight = () => {
    const styleHeight = Number.parseFloat(input.style.height || "");
    return Math.round(input.offsetHeight || input.clientHeight || styleHeight || defaultHeight);
  };

  widget.__easyuseAnimaHeight = Math.max(defaultHeight, widget.__easyuseAnimaHeight || 0);
  input.style.boxSizing = "border-box";
  input.style.resize = "vertical";
  input.style.minHeight = `${Math.min(defaultHeight, 54)}px`;
  input.style.height = `${widget.__easyuseAnimaHeight}px`;

  if (!widget.__easyuseAnimaStudioComputeWrapped) {
    const computeSize = widget.computeSize;
    widget.computeSize = function (width) {
      const base = computeSize?.apply(this, arguments) || [width, defaultHeight];
      return [base[0], Math.max(base[1], this.__easyuseAnimaHeight || defaultHeight)];
    };
    widget.__easyuseAnimaStudioComputeWrapped = true;
  }

  const syncHeight = () => {
    const height = Math.max(defaultHeight, readInputHeight());
    if (Math.abs(height - widget.__easyuseAnimaHeight) > 2) {
      widget.__easyuseAnimaHeight = height;
      input.style.height = `${height}px`;
      refreshNodeSize(node);
    }
  };

  if (input.__easyuseAnimaStudioResizable) {
    return;
  }

  input.addEventListener("mouseup", syncHeight);
  input.addEventListener("pointerup", syncHeight);
  input.addEventListener("input", syncHeight);
  input.__easyuseAnimaStudioResizable = true;
}

function hookStudioNode(node) {
  const renderByField = new Map();
  const updateByField = new Map();

  const getUpdateField = (fieldName) => {
    if (updateByField.has(fieldName)) {
      return updateByField.get(fieldName);
    }
    let classifySeq = 0;
    const update = debounce(async () => {
      const widget = findWidget(node, fieldName);
      const renderWidget = renderByField.get(fieldName);
      if (!widget || !renderWidget) {
        return;
      }
      const text = String(widget.value ?? "");
      if (!text.trim()) {
        renderWidget.__tokens = [];
        renderWidget.__status = "No rendered tags.";
        app.graph.setDirtyCanvas(true, false);
        return;
      }

      const seq = ++classifySeq;
      renderWidget.__status = "Rendering tags...";
      app.graph.setDirtyCanvas(true, false);
      try {
        const tokens = await classifyPrompt(text);
        if (seq !== classifySeq) {
          return;
        }
        renderWidget.__tokens = tokens;
        renderWidget.__status = tokens.length ? "" : "No rendered tags.";
        refreshNodeSize(node);
      } catch (error) {
        if (seq !== classifySeq) {
          return;
        }
        renderWidget.__tokens = [];
        renderWidget.__status = `Render failed: ${error.message || error}`;
        app.graph.setDirtyCanvas(true, false);
      }
    });
    updateByField.set(fieldName, update);
    return update;
  };

  for (const name of FIELD_NAMES) {
    const widget = findWidget(node, name);
    if (!widget) {
      continue;
    }
    enhanceResizableInput(node, widget);
    const renderWidget = ensureRenderWidget(node, widget);
    renderByField.set(name, renderWidget);
    const updateField = getUpdateField(name);

    if (!widget.__easyuseAnimaStudioHooked) {
      const callback = widget.callback;
      widget.callback = function (value) {
        const result = callback?.apply(this, arguments);
        updateField();
        return result;
      };
      widget.inputEl?.addEventListener("input", updateField);
      widget.__easyuseAnimaStudioHooked = true;
    }
    updateField();
  }

  refreshNodeSize(node);
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

    const onResize = nodeType.prototype.onResize;
    nodeType.prototype.onResize = function () {
      const result = onResize?.apply(this, arguments);
      for (const name of FIELD_NAMES) {
        const widget = findWidget(this, name);
        const input = widget?.inputEl;
        if (input && widget.__easyuseAnimaHeight) {
          input.style.height = `${widget.__easyuseAnimaHeight}px`;
        }
      }
      return result;
    };
  },
});
