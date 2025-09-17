/**
 * 👋 Welcome to your Smithery project!
 * To run your server, run "npm run dev"
 *
 * You might find these resources useful:
 *
 * 🧑‍💻 MCP's TypeScript SDK (helps you define your server)
 * https://github.com/modelcontextprotocol/typescript-sdk
 *
 * 📝 smithery.yaml (defines user-level config, like settings or API keys)
 * https://smithery.ai/docs/build/project-config/smithery-yaml
 *
 * 💻 smithery CLI (run "npx @smithery/cli dev" or explore other commands below)
 * https://smithery.ai/docs/concepts/cli
 */

import { Server } from "@modelcontextprotocol/sdk/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const configSchema = z.object({
	supabase_Access_Token: z.string().describe("Enter API key"),
	enableLogging: z.boolean().default(false).describe("Enable logging"),
});

export default function createServer({
	config,
}: {
	config: z.infer<typeof configSchema>
}) {
	const server = new McpServer({
		name: "supabase-mcp-lite",
		version: "0.0.1",
	})


		server.registerTool(
		"check_access_key",
		{
			title: "check_access_key",
			description: "print users access key",
			inputSchema: {},
		},
async () => {
			return {
				content: [{ type: "text", text: `Your access key is ${config.supabase_Access_Token}` }],
			};
		},
	)



	// Add a tool
	server.registerTool(
		"get_project_list",
		{
			title: "get_project_list",
			description: "Get project list from supabase",
			inputSchema: {},
		},
async () => {
			const response = await fetch("https://api.supabase.com/v1/projects", {
				method: "GET",
				headers: {
					"Authorization": `Bearer ${config.supabase_Access_Token}`,
					"Accept": "application/json",
				},
			});
			if (!response.ok) {
				const errorBody = await response.text().catch(() => "");
				return {
					content: [
						{
							type: "text",
							text: `Failed to fetch projects (${response.status} ${response.statusText}). ${errorBody}`,
						},
					],
				};
			}
			const projects = await response.json();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(projects, null, 2),
					},
				],
			};
		},
	)


	server.registerTool(
		"get_table_list",
		{
			title: "get_table_list",
			description: "Get table list from a specific project",
			inputSchema: {
				project_ref: z.string().describe("Enter your project ref"),
			},
		},
async (input) => {
			const response = await fetch(`https://api.supabase.com/v1/projects/${input.project_ref}/database/context`, {
				method: "GET",
				headers: {
					"Authorization": `Bearer ${config.supabase_Access_Token}`,
					"Accept": "application/json",
				},
			});
			if (!response.ok) {
				const errorBody = await response.text().catch(() => "");
				return {
					content: [
						{
							type: "text",
							text: `Failed to fetch projects (${response.status} ${response.statusText}). ${errorBody}`,
						},
					],
				};
			}
			const projects = (await response.json()).databases[0].schemas[5];
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(projects, null, 2),
					},
				],
			};
		},
	)
	return server.server
}
