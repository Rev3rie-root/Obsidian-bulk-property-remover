const { Plugin, Modal, Setting, Notice } = require("obsidian");

module.exports = class BulkPropertyRemoverPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: "remove-property-vault-wide",
      name: "Remove frontmatter property across entire vault",
      callback: () => {
        // Collect all existing property keys across the vault
        const existingProperties = this.getVaultProperties();
        
        new PropertyInputModal(this.app, existingProperties, (propertyName) => {
          this.removePropertyFromVault(propertyName);
        }).open();
      },
    });
  }

  // Scans Obsidian's metadata cache to find all unique frontmatter keys
  getVaultProperties() {
    const files = this.app.vault.getMarkdownFiles();
    const propertySet = new Set();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache && cache.frontmatter) {
        Object.keys(cache.frontmatter).forEach((key) => {
          // Exclude internal Obsidian metadata properties if present
          if (key !== "position") {
            propertySet.add(key);
          }
        });
      }
    }

    return Array.from(propertySet).sort();
  }

  async removePropertyFromVault(propertyName) {
    if (!propertyName) return;

    const files = this.app.vault.getMarkdownFiles();
    let modifiedCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          if (frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, propertyName)) {
            delete frontmatter[propertyName];
            modifiedCount++;
          }
        });
      } catch (err) {
        console.error(`Error processing file ${file.path}:`, err);
        errorCount++;
      }
    }

    new Notice(
      `Finished! Removed "${propertyName}" from ${modifiedCount} file(s).` +
      (errorCount > 0 ? ` Encountered ${errorCount} error(s).` : "")
    );
  }
};

class PropertyInputModal extends Modal {
  constructor(app, existingProperties, onSubmit) {
    super(app);
    this.existingProperties = existingProperties;
    this.onSubmit = onSubmit;
    this.propertyName = "";
    this.textComponent = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Remove Frontmatter Property" });
    contentEl.createEl("p", {
      text: "Select an existing property from your vault or type a name manually below.",
    });

    // 1. Dropdown for selecting detected properties (mobile-friendly)
    new Setting(contentEl)
      .setName("Select Existing Property")
      .setDesc("Properties currently used in your vault")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "-- Tap to select --");
        
        this.existingProperties.forEach((prop) => {
          dropdown.addOption(prop, prop);
        });

        dropdown.onChange((value) => {
          if (value) {
            this.propertyName = value;
            // Sync the text field to match the selected dropdown item
            if (this.textComponent) {
              this.textComponent.setValue(value);
            }
          }
        });
      });

    // 2. Manual text input field
    new Setting(contentEl)
      .setName("Or Type Property Key")
      .setDesc("Case-sensitive key name")
      .addText((text) => {
        this.textComponent = text;
        text.setPlaceholder("e.g., status, draft, tags");
        text.onChange((value) => {
          this.propertyName = value.trim();
        });
      });

    // 3. Confirm button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Delete Vault-Wide")
        .setCta()
        .onClick(() => {
          if (!this.propertyName) {
            new Notice("Please select or type a property name.");
            return;
          }
          this.close();
          this.onSubmit(this.propertyName);
        })
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
