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

  async downloadPlugin(destination: string): Promise<string> {
    // Fetch latest version
    const response = await fetch(this.uri);

    // Guess plugin name or infer from filename header
    const pluginFileNameGuess1 = this.uri.split("/").pop() as string;
    const pluginFileNameGuess2 = response.url.split("/").pop() as string;
    const pluginFileNameHeader = response.headers.get("content-disposition");

    const pluginFileNameCandidates = [];
    if (this.regex.test(pluginFileNameGuess1))
      pluginFileNameCandidates.push(pluginFileNameGuess1);
    if (this.regex.test(pluginFileNameGuess2))
      pluginFileNameCandidates.push(pluginFileNameGuess2);
    if (pluginFileNameHeader && this.regex.test(pluginFileNameHeader))
      pluginFileNameCandidates.push(pluginFileNameHeader);

    if (pluginFileNameCandidates.length === 0)
      throw new Error(`Could not infer plugin name for ${this.name}`);

    const pluginFileName = pluginFileNameCandidates[0];

    // Set plugin name
    destination = destination + "/" + pluginFileName;

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
        resolve(pluginFileName);
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
