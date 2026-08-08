const { Plugin, Modal, Setting, Notice } = require("obsidian");

module.exports = class BulkPropertyRemoverPlugin extends Plugin {
  async onload() {
    // Add command to Command Palette
    this.addCommand({
      id: "remove-property-vault-wide",
      name: "Remove frontmatter property across entire vault",
      callback: () => {
        new PropertyInputModal(this.app, (propertyName) => {
          this.removePropertyFromVault(propertyName);
        }).open();
      },
    });
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
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.propertyName = "";
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Remove Frontmatter Property" });
    contentEl.createEl("p", {
      text: "Enter the exact key name of the property you want to remove from ALL markdown files in your vault.",
    });

    new Setting(contentEl)
      .setName("Property Key")
      .setDesc("Case-sensitive (e.g., 'tags', 'draft', 'created_at')")
      .addText((text) =>
        text.onChange((value) => {
          this.propertyName = value.trim();
        })
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Delete Vault-Wide")
        .setCta()
        .onClick(() => {
          if (!this.propertyName) {
            new Notice("Please enter a property name.");
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
