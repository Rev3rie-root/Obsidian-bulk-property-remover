const { Plugin, Modal, Setting, Notice } = require("obsidian");

module.exports = class BulkPropertyRemoverPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: "remove-property-vault-wide",
      name: "Remove frontmatter property across entire vault",
      callback: () => {
        const existingProperties = this.getVaultProperties();
        
        new PropertyInputModal(this.app, existingProperties, (propertyName) => {
          this.removePropertyFromVault(propertyName);
        }).open();
      },
    });
  }

  getVaultProperties() {
    const files = this.app.vault.getMarkdownFiles();
    const propertySet = new Set();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache && cache.frontmatter) {
        Object.keys(cache.frontmatter).forEach((key) => {
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
    this.countEl = null;
  }

  // Counts how many markdown files in metadataCache currently contain the given key
  getMatchingFileCount(propertyName) {
    if (!propertyName) return 0;
    
    const files = this.app.vault.getMarkdownFiles();
    let count = 0;

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache && cache.frontmatter && Object.prototype.hasOwnProperty.call(cache.frontmatter, propertyName)) {
        count++;
      }
    }
    return count;
  }

  // Updates the modal text dynamically whenever input changes
  updateCountDisplay() {
    if (!this.countEl) return;

    if (!this.propertyName) {
      this.countEl.setText("No property selected.");
      this.countEl.style.color = "var(--text-muted)";
      return;
    }

    const count = this.getMatchingFileCount(this.propertyName);

    if (count === 0) {
      this.countEl.setText(`Property "${this.propertyName}" was not found in any files.`);
      this.countEl.style.color = "var(--text-warning)";
    } else {
      this.countEl.setText(`⚠️ Will remove "${this.propertyName}" from ${count} file(s).`);
      this.countEl.style.color = "var(--text-accent)";
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Remove Frontmatter Property" });
    contentEl.createEl("p", {
      text: "Select or type a property key. The box below will show how many files will be affected before deleting.",
    });

    // 1. Dropdown selection
    new Setting(contentEl)
      .setName("Select Existing Property")
      .setDesc("Properties detected in your vault")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "-- Tap to select --");

        this.existingProperties.forEach((prop) => {
          dropdown.addOption(prop, prop);
        });

        dropdown.onChange((value) => {
          this.propertyName = value;
          if (this.textComponent) {
            this.textComponent.setValue(value);
          }
          this.updateCountDisplay();
        });
      });

    // 2. Manual text field
    new Setting(contentEl)
      .setName("Or Type Property Key")
      .setDesc("Case-sensitive key name")
      .addText((text) => {
        this.textComponent = text;
        text.setPlaceholder("e.g., status, draft, tags");
        text.onChange((value) => {
          this.propertyName = value.trim();
          this.updateCountDisplay();
        });
      });

    // 3. Dynamic confirmation box
    const countContainer = contentEl.createEl("div");
    countContainer.style.margin = "1em 0";
    countContainer.style.padding = "0.75em";
    countContainer.style.borderRadius = "6px";
    countContainer.style.backgroundColor = "var(--background-secondary)";

    this.countEl = countContainer.createEl("p", {
      text: "No property selected.",
    });
    this.countEl.style.margin = "0";
    this.countEl.style.fontWeight = "bold";

    // 4. Submit button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Delete Vault-Wide")
        .setCta()
        .onClick(() => {
          if (!this.propertyName) {
            new Notice("Please select or type a property name.");
            return;
          }

          const count = this.getMatchingFileCount(this.propertyName);
          if (count === 0) {
            new Notice(`Property "${this.propertyName}" was not found in any files.`);
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
