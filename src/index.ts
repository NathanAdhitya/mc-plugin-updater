import chalk from "chalk";
import ora from "ora";
import path from "path";
import yaml from "yaml";
import fs from "fs/promises";
import fsSync from "fs";
import Client from "ssh2-sftp-client";
import { z } from "zod";
import { pluginYamlSchema } from "./schema.js";

import { DirectPluginSource } from "./modules/pluginSources/Direct.js";
import { JenkinsPluginSource } from "./modules/pluginSources/Jenkins.js";
import { SpigetPluginSource } from "./modules/pluginSources/Spiget.js";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

// Parse command line arguments
const args = process.argv.slice(2);
const [command, ...options] = args;

// Get server name from first option
const serverName = options[0];

// Validate serverName zod
const serverNameSchema = z.string().min(1);
serverNameSchema.parse(serverName);

// Get mc-plugins.yml from serverName
const mcPluginsYml = await fs.readFile(
  path.join(`./data/servers/${serverName}/mc-plugins.yml`),
  "utf-8"
);

// Load JSON Schema
const schema = JSON.parse(await fs.readFile("./data/schema.json", "utf-8"));

const data = yaml.parse(mcPluginsYml);
const parsedData = pluginYamlSchema.parse(data);

// Connect via SFTP
const sftp = new Client();
// @ts-expect-error Increase the max listeners to 100, hacky way.
sftp.client.setMaxListeners(100);
const spinner = ora("Connecting to server").start();

// Parse server uri
const uri = parsedData.server.uri;
const uriObject = new URL(uri);

await sftp.connect({
  host: uriObject.hostname,
  port: Number.parseInt(uriObject.port) ?? 22,
  username: parsedData.server.username,
  password: parsedData.server.password,
});

spinner.succeed("Connected to server.");

const currentPluginList = (
  await sftp.list(parsedData.server.pluginsPath)
).filter((v) => v.type === "-");

// Match with pattern provided in mc-plugins.yml
// Turn the pattern into a regex with * -> .* and ? -> .
const pluginPatterns = parsedData.plugins.map((v) => ({
  ...v,
  regex: new RegExp(
    "^" +
      escapeRegExp(v.match ? v.match : v.name)
        .replace(/\\\*/g, ".*")
        .replace(/\\\?/g, ".") +
      "$",
    "i"
  ),
}));

// Filter plugins that match the pattern
const filteredPluginListMatch = currentPluginList.filter((v) =>
  pluginPatterns.some((w) => w.regex.test(v.name))
);

// Filter plugins that don't match the pattern
const filteredPluginListNoMatch = currentPluginList.filter(
  (v) => !filteredPluginListMatch.some((w) => w.name === v.name)
);

console.log("Plugins that doesn't match the pattern:");
console.log(filteredPluginListNoMatch.map((v) => v.name));

console.log("Plugins that match the pattern:");
console.log(filteredPluginListMatch.map((v) => v.name));

// Map plugins to classes
const pluginClasses = pluginPatterns.map((v) => {
  switch (v.type) {
    case "direct":
      return new DirectPluginSource(v.name, v.url, v.regex);
    case "jenkins":
      return new JenkinsPluginSource(v.name, v.url, v.regex);
    case "spiget":
      return new SpigetPluginSource(v.name, v.url, v.regex);
    default:
      throw new Error(`Plugin type ${v.type} is not supported.`);
  }
});

// Delete matched plugins in server async
await Promise.all(
  filteredPluginListMatch.map(async (v) => {
    console.log(`Deleting ${v.name}...`);
    await sftp.delete(path.join(parsedData.server.pluginsPath, v.name));
    console.log(`Deleted ${v.name}.`);
  })
);

// Create /plugins folder in this server folder if nonexistant
await fs.mkdir(`./data/servers/${serverName}/plugins`, {
  recursive: true,
});

// Download plugins async
await Promise.all(
  pluginClasses.map(async (v) => {
    console.log(`Downloading ${v.name}...`);
    // Extract plugin file name from url provided by class
    const pluginFileName = await v.downloadPlugin(
      `./data/servers/${serverName}/plugins`
    );

    console.log(`Downloaded ${v.name}.`);
    console.log(`Writing ${v.name}...`);
    // Open plugin file stream
    await sftp.fastPut(
      `./data/servers/${serverName}/plugins/${pluginFileName}`,
      parsedData.server.pluginsPath + "/" + pluginFileName
    );
    console.log(`Wrote ${v.name}.`);
  })
);

await sftp.end();
