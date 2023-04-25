import { z } from "zod";
import { pluginYamlSchema } from "../../schema.js";

export abstract class PluginSource {
  constructor(
    public readonly name: string,
    public readonly uri: string,
    public readonly type: z.infer<
      typeof pluginYamlSchema
    >["plugins"][number]["type"],
    public readonly regex: RegExp
  ) {}

  abstract downloadPlugin(destination: string): Promise<void>;
  abstract isServerVersionOutdated(nameOnServer: string): Promise<boolean>;
  abstract getLatestVersionUrl(): Promise<string>;
}
