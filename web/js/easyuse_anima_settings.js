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
      onChange: (value) => setSetting("animadex.token", value),
    });

    app.ui.settings.addSetting({
      id: "EasyUseAnima.AnimaDex.TokenFile",
      name: "EasyUse Anima: AnimaDex Token File",
      type: "text",
      defaultValue: settings["animadex.token_file"] || "",
      onChange: (value) => setSetting("animadex.token_file", value),
    });

    app.ui.settings.addSetting({
      id: "EasyUseAnima.AnimaDex.Site",
      name: "EasyUse Anima: AnimaDex Site",
      type: "text",
      defaultValue: settings["animadex.site"] || "https://animadex.net",
      onChange: (value) => setSetting("animadex.site", value),
    });
  },
});
