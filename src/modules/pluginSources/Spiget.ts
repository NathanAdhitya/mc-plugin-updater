import { PluginSource } from "../abstracts/PluginSource.js";
import fs from "fs";
import fetch from "node-fetch";

const spigetApiUrl = "https://api.spiget.org/v2/resources/";
const spigetApiUserAgent = "MCPluginUpdater/1.0";

const spigetFetch: typeof fetch = (...fetchParams) => {
  fetchParams[1] = {
    ...fetchParams[1],
    headers: {
      ...fetchParams[1]?.headers,
      "User-Agent": spigetApiUserAgent,
    },
  };
  return fetch(...fetchParams).then((response) => {
    return response;
  });
};

export class SpigetPluginSource extends PluginSource {
  constructor(
    public readonly name: string,
    public readonly uri: string,
    public readonly regex: RegExp
  ) {
    super(name, uri, "direct", regex);
  }

  static readonly spigotUrlRegex =
    /^https:\/\/www\.spigotmc\.org\/resources\/([a-zA-Z0-9-]+)\.([0-9]+)\//;

  extractSpigetResourceId(spigotUrl: string) {
    const resourceId = spigotUrl.match(SpigetPluginSource.spigotUrlRegex)?.[2];
    if (!resourceId || !Number.isInteger(Number.parseInt(resourceId))) {
      throw new Error(`Could not extract resource id from ${spigotUrl}`);
    }
    return resourceId;
  }

  async getSpigetResourceVersion(spigotUrl: string) {
    const spigetResourceDetails =
      spigetApiUrl +
      this.extractSpigetResourceId(spigotUrl) +
      "/versions/latest";
    const response = await spigetFetch(spigetResourceDetails);
    const json = (await response.json()) as any;
    return json?.name as string;
  }

  async getLatestFilename(): Promise<string> {
    return this.name + "-" + (await this.getSpigetResourceVersion(this.uri));
  }

  async downloadPlugin(destination: string): Promise<string> {
    const pluginFileNameCandidates = [await this.getLatestFilename()];

    if (pluginFileNameCandidates.length === 0)
      throw new Error(`Could not infer plugin name for ${this.name}`);

    const pluginFileName = pluginFileNameCandidates[0];

    // Fetch latest version
    const response = await fetch(await this.getLatestVersionUrl());

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
    return nameOnServer !== (await this.getLatestFilename());
  }

  async getLatestVersionUrl(): Promise<string> {
    const spigetResourceId = this.extractSpigetResourceId(this.uri);
    const spigetResourceDownload =
      spigetApiUrl + spigetResourceId + "/download";
    return spigetResourceDownload;
  }
}
