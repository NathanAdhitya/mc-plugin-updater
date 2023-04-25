import { PluginSource } from "../abstracts/PluginSource.js";
import fs from "fs";
import fetch from "node-fetch";

export interface JenkinsResponse {
  artifacts: JenkinsArtifacts[];
  number: number;
  [x: string]: any;
}

export interface JenkinsArtifacts {
  displayPath: string; // The path to display the artifact
  fileName: string; // The name of the artifact file
  relativePath: string; // The relative path to the artifact file
}

export class JenkinsPluginSource extends PluginSource {
  constructor(
    public readonly name: string,
    public readonly uri: string,
    public readonly regex: RegExp
  ) {
    super(name, uri, "jenkins", regex);
  }

  async downloadPlugin(destination: string): Promise<void> {
    // Get latest version URL
    const url = await this.getLatestVersionUrl();

    // Fetch latest version
    const response = await fetch(new URL(url, this.uri + "/artifact/"));

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
    // TODO: Implement this
    return true;
  }

  async getLatestVersionUrl(): Promise<string> {
    // Fetch Jenkins JSON API
    const response = await fetch(new URL("api/json", this.uri));

    // Parse JSON
    const json = (await response.json()) as JenkinsResponse;

    if (!json.artifacts)
      throw new Error(`Invalid JSON found for ${this.name} on ${this.uri}`);

    // Get the first artifact that matches the regex
    const artifact = json.artifacts.find((v) => this.regex.test(v.fileName));

    if (!artifact)
      throw new Error(`No artifact found for ${this.name} on ${this.uri}`);

    return artifact.relativePath;
  }
}
