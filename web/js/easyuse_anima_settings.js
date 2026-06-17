import { app } from "../../../scripts/app.js";

async function getSettings() {
  try {
    const response = await fetch("/easyuse_anima/settings");
    if (!response.ok) {
      return {};
    }
    return await response.json();
  } catch {
    return {};
  }
}

function setSetting(key, value) {
  return fetch("/easyuse_anima/set_setting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

async function getDatasetStatus() {
  const response = await fetch("/easyuse_anima/animadex_status");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

async function downloadAnimaDexDataset(forceRefresh = false) {
  const response = await fetch("/easyuse_anima/download_animadex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force_refresh: forceRefresh }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

async function runDownload(forceRefresh = false, button = null) {
  const originalText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = forceRefresh ? "Refreshing..." : "Downloading...";
    }
    const result = await downloadAnimaDexDataset(forceRefresh);
    alert(
      [
        `AnimaDex dataset ${result.status}.`,
        "",
        `Character index: ${result.character_index || ""}`,
        `Artist index: ${result.artist_index || ""}`,
      ].join("\n"),
    );
    await refreshStatusPanels();
  } catch (error) {
    alert(`AnimaDex dataset download failed:\n${error.message || error}`);
    await refreshStatusPanels();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

const statusPanels = new Set();

function formatFileStatus(fileStatus) {
  if (!fileStatus?.exists) {
    return `missing: ${fileStatus?.path || ""}`;
  }
  const size = Number(fileStatus.size || 0).toLocaleString();
  const mtime = fileStatus.mtime
    ? new Date(fileStatus.mtime * 1000).toLocaleString()
    : "unknown time";
  return `found (${size} bytes, ${mtime}): ${fileStatus.path}`;
}

function appendLine(container, label, value, valueStyle = "") {
  const row = document.createElement("div");
  const strong = document.createElement("strong");
  const span = document.createElement("span");
  strong.textContent = `${label}: `;
  span.textContent = value;
  if (valueStyle) {
    span.style.cssText = valueStyle;
  }
  row.append(strong, span);
  container.append(row);
}

function renderStatusPanel(panel, status) {
  panel.replaceChildren();

  const guide = document.createElement("div");
  guide.style.cssText = "margin-bottom: 8px; line-height: 1.45;";
  guide.textContent =
    "Paste the AnimaDex export token above, then click Download. Dataset files are saved inside this custom node under __easyuse_anima__ and are ignored by git.";
  panel.append(guide);

  const banner = document.createElement("div");
  banner.textContent = status.downloaded
    ? "AnimaDex dataset is downloaded and ready."
    : "AnimaDex dataset is not downloaded yet.";
  banner.style.cssText = status.downloaded
    ? "margin: 8px 0; padding: 8px 10px; border-radius: 6px; background: rgba(22, 163, 74, 0.16); color: #16a34a; font-weight: 700;"
    : "margin: 8px 0; padding: 8px 10px; border-radius: 6px; background: rgba(234, 179, 8, 0.14); color: #ca8a04; font-weight: 700;";
  panel.append(banner);

  const statusText = status.downloaded ? "Downloaded" : "Not downloaded";
  appendLine(
    panel,
    "Dataset",
    statusText,
    status.downloaded
      ? "color: #16a34a; font-weight: 700;"
      : "color: #ca8a04; font-weight: 700;",
  );
  appendLine(panel, "Token", status.token_configured ? "configured" : "not configured");
  appendLine(panel, "Storage", status.data_dir || "");
  appendLine(panel, "Character index", formatFileStatus(status.character_index));
  appendLine(panel, "Artist index", formatFileStatus(status.artist_index));

  const refresh = document.createElement("button");
  refresh.textContent = "Refresh Status";
  refresh.style.cssText = "margin-top: 8px; padding: 4px 10px; cursor: pointer;";
  refresh.onclick = () => refreshStatusPanel(panel);
  panel.append(refresh);
}

async function refreshStatusPanel(panel) {
  try {
    const status = await getDatasetStatus();
    renderStatusPanel(panel, status);
  } catch (error) {
    panel.textContent = `Could not read AnimaDex dataset status: ${error.message || error}`;
  }
}

async function refreshStatusPanels() {
  await Promise.all([...statusPanels].map((panel) => refreshStatusPanel(panel)));
}

function datasetStatusPanel() {
  const panel = document.createElement("div");
  panel.style.cssText = "max-width: 760px; line-height: 1.45; white-space: normal;";
  panel.textContent = "Checking AnimaDex dataset status...";
  statusPanels.add(panel);
  refreshStatusPanel(panel);
  return panel;
}

function downloadButton(label, forceRefresh = false) {
  const button = document.createElement("button");
  button.textContent = label;
  button.style.cssText = "padding: 6px 12px; cursor: pointer;";
  button.onclick = () => runDownload(forceRefresh, button);
  return button;
}

app.registerExtension({
  name: "easyuse-anima.settings",
  async setup() {
    const settings = await getSettings();
    const tokenConfigured = settings["animadex.token_configured"] === true;

    app.ui.settings.addSetting({
      id: "EasyUseAnima.AnimaDex.Token",
      name: tokenConfigured
        ? "EasyUse Anima: AnimaDex Export Token (saved; enter to replace)"
        : "EasyUse Anima: AnimaDex Export Token",
      type: "text",
      defaultValue: "",
      onChange: async (value) => {
        await setSetting("animadex.token", value);
        await refreshStatusPanels();
      },
    });

    app.ui.settings.addSetting({
      id: "EasyUseAnima.AnimaDex.Status",
      name: "EasyUse Anima: AnimaDex Dataset Status",
      type: () => datasetStatusPanel(),
    });

    app.ui.settings.addSetting({
      id: "EasyUseAnima.AnimaDex.Site",
      name: "EasyUse Anima: AnimaDex Site",
      type: "text",
      defaultValue: settings["animadex.site"] || "https://animadex.net",
      onChange: (value) => setSetting("animadex.site", value),
    });

    app.ui.settings.addSetting({
      id: "EasyUseAnima.AnimaDex.Download",
      name: "EasyUse Anima: Download AnimaDex Dataset",
      type: () => downloadButton("Download", false),
      tooltip: "Download character/artist CSVs and build local indexes under this custom node.",
    });

    app.ui.settings.addSetting({
      id: "EasyUseAnima.AnimaDex.Refresh",
      name: "EasyUse Anima: Force Refresh AnimaDex Dataset",
      type: () => downloadButton("Force Refresh", true),
      tooltip: "Download again even if local indexes already exist.",
    });
  },
});
