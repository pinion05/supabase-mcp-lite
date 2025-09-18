import { Server } from "@modelcontextprotocol/sdk/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiKeyList } from "./type";

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
		"get_access_key",
		{
			title: "get_access_key",
			description: "print users access key",
			inputSchema: {
				project_ref: z.string().describe("Enter your project ref"),
			},
		},
		async (input) => {
			const response: Response = await fetch(`https://api.supabase.com/v1/projects/${input.project_ref}/api-keys`,{
				method: "GET",
				headers: {
					authorization: `Bearer ${config.supabase_Access_Token}`,
					accept: "application/json",
				}
			})
			const data: ApiKeyList = await response.json()
			return {
				content: [{ type: "text", text: `personal access Token : ${config.supabase_Access_Token}\nproject annoKey : ${JSON.stringify(data[0].api_key, null, 2)}\nproject service role key: ${JSON.stringify(data[1].api_key, null, 2)}` }],
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
			const projects = (await response.json()).databases[0].schemas[4];
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
		"excute_query",
		{
			title: "excute_query",
			description: "Execute a SQL query on a specific project",
			inputSchema: {
				project_ref: z.string().describe("Enter your project ref"),
				query: z.string().describe("Enter your SQL query"),
			},
		},
async (input) => {
			const response = await fetch(`https://api.supabase.com/v1/projects/${input.project_ref}/database/query`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${config.supabase_Access_Token}`,
					"Accept": "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: input.query,
				}),
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
			const res = (await response.json());
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(res, null, 2),
					},
				],
			};
		},
	)

	return server.server
}
