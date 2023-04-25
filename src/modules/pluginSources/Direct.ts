import { PluginSource } from "../abstracts/PluginSource.js";
import fs from "fs";
import fetch from "node-fetch";

export class DirectPluginSource extends PluginSource {
  constructor(
    public readonly name: string,
    public readonly uri: string,
    public readonly regex: RegExp
  ) {
    super(name, uri, "direct", regex);
  }

  async downloadPlugin(destination: string): Promise<void> {
    // Fetch latest version
    const response = await fetch(this.uri);

    if (response.body === null)
      throw new Error(`No response body found for ${this.name}`);

    return new Promise((resolve, reject) => {
      // Write to file
      const fileStream = fs.createWriteStream(destination);
      response.body?.pipe(fileStream);
      response.body?.on("error", (err) => {
        reject(err);
      });
      fileStream.on("finish", () => {
        resolve();
      });
    });
  }

  async isServerVersionOutdated(nameOnServer: string): Promise<boolean> {
    return true;
  }

  async getLatestVersionUrl(): Promise<string> {
    return this.uri;
  }
}
