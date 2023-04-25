import * as z from "zod";

const serverSchema = z
  .object({
    uri: z.string().nonempty().describe("server sftp uri"),
    username: z.string().nonempty().describe("server sftp username"),
    password: z.string().nonempty().describe("server sftp password"),
    pluginsPath: z.string().nonempty().describe("server plugins path"),
  })
  .describe("server properties");

const pluginSchema = z
  .object({
    name: z.string().nonempty().describe("plugin name"),
    version: z.string().optional().describe("plugin version"),
    url: z.string().nonempty().url().describe("plugin download url"),
    type: z
      .enum(["direct", "github", "spiget", "jenkins"])
      .describe("plugin source"),
    match: z.string().optional().describe("pattern to match when getting API"),
  })
  .describe("plugins to be installed");

export const pluginYamlSchema = z
  .object({
    server: serverSchema,
    plugins: z.array(pluginSchema),
  })
  .describe("schema for defining mc plugins");
