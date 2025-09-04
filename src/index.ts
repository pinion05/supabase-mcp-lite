import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Configuration schema - used in smithery.yaml
export const configSchema = z.object({
  supabaseUrl: z.string().describe("Supabase project URL"),
  supabaseKey: z.string().describe("Supabase service role key"),
});

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: "supabase-lite",
    version: "1.0.0",
  });

  // Check if configuration is provided
  if (!config?.supabaseUrl || !config?.supabaseKey) {
    console.warn("Supabase not configured. Please provide supabaseUrl and supabaseKey.");
    // Return server without tools if not configured
    return server.server;
  }

  // Initialize Supabase client
  const supabase: SupabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false }
  });

  // Tool 1: Select - Simple table query
  server.registerTool("select", {
    title: "Get data",
    description: "Select data from a table",
    inputSchema: {
      table: z.string().describe("Table name"),
      where: z.record(z.any()).optional().describe("Filter conditions"),
      limit: z.number().optional().describe("Maximum rows to return")
    }
  }, async ({ table, where = {}, limit = 100 }) => {
    try {
      let query = supabase.from(table).select('*');
      
      // Apply filters
      Object.entries(where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      // Apply limit
      query = query.limit(limit);
      
      const { data, error } = await query;
      if (error) throw error;
      
      return { 
        content: [{
          type: "text",
          text: JSON.stringify({ 
            data: data || [], 
            count: data?.length || 0 
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Select failed: ${error}`);
    }
  });

  // Tool 2: Mutate - Insert/Update/Delete
  server.registerTool("mutate", {
    title: "Change data",
    description: "Insert, update or delete data",
    inputSchema: {
      action: z.enum(['insert', 'update', 'delete']).describe("Operation type"),
      table: z.string().describe("Table name"),
      data: z.any().optional().describe("Data for insert/update"),
      where: z.record(z.any()).optional().describe("Filter for update/delete")
    }
  }, async ({ action, table, data, where = {} }) => {
    try {
      let result;
      
      switch (action) {
        case 'insert':
          if (!data) throw new Error('Data required for insert');
          result = await supabase.from(table).insert(data);
          break;
          
        case 'update':
          if (!data) throw new Error('Data required for update');
          let updateQuery = supabase.from(table).update(data);
          Object.entries(where).forEach(([key, value]) => {
            updateQuery = updateQuery.eq(key, value);
          });
          result = await updateQuery;
          break;
          
        case 'delete':
          let deleteQuery = supabase.from(table).delete();
          Object.entries(where).forEach(([key, value]) => {
            deleteQuery = deleteQuery.eq(key, value);
          });
          result = await deleteQuery;
          break;
      }
      
      if (result.error) throw result.error;
      
      return { 
        content: [{
          type: "text",
          text: JSON.stringify({ 
            success: true, 
            affected: result.count || 0 
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Mutate failed: ${error}`);
    }
  });

  // Tool 3: Storage - File operations
  server.registerTool("storage", {
    title: "Files",
    description: "Manage storage files",
    inputSchema: {
      action: z.enum(['upload', 'download', 'delete', 'list']).describe("Operation"),
      bucket: z.string().describe("Storage bucket"),
      path: z.string().optional().describe("File path"),
      data: z.string().optional().describe("File data (base64)")
    }
  }, async ({ action, bucket, path, data }) => {
    try {
      switch (action) {
        case 'upload':
          if (!path || !data) throw new Error('Path and data required');
          const uploadResult = await supabase.storage
            .from(bucket)
            .upload(path, Buffer.from(data, 'base64'));
          if (uploadResult.error) throw uploadResult.error;
          return { 
            content: [{
              type: "text",
              text: `Uploaded: ${path}`
            }]
          };
          
        case 'download':
          if (!path) throw new Error('Path required');
          const { data: file, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(path);
          if (downloadError) throw downloadError;
          const fileText = await file?.text();
          return { 
            content: [{
              type: "text",
              text: fileText || ''
            }]
          };
          
        case 'delete':
          if (!path) throw new Error('Path required');
          const { error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([path]);
          if (deleteError) throw deleteError;
          return { 
            content: [{
              type: "text",
              text: `Deleted: ${path}`
            }]
          };
          
        case 'list':
          const { data: files, error: listError } = await supabase.storage
            .from(bucket)
            .list(path || '');
          if (listError) throw listError;
          return { 
            content: [{
              type: "text",
              text: JSON.stringify(files?.slice(0, 100) || [], null, 2)
            }]
          };
      }
    } catch (error) {
      throw new Error(`Storage failed: ${error}`);
    }
  });

  // Tool 4: Auth - User management  
  server.registerTool("auth", {
    title: "Users",
    description: "Manage users",
    inputSchema: {
      action: z.enum(['list', 'create', 'delete']).describe("Operation"),
      email: z.string().optional().describe("User email"),
      password: z.string().optional().describe("User password"),
      id: z.string().optional().describe("User ID")
    }
  }, async ({ action, email, password, id }) => {
    try {
      switch (action) {
        case 'list':
          const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
          if (listError) throw listError;
          // Return minimal user info
          const userList = users?.slice(0, 100).map(u => ({
            id: u.id,
            email: u.email,
            created: u.created_at
          })) || [];
          return { 
            content: [{
              type: "text",
              text: JSON.stringify(userList, null, 2)
            }]
          };
          
        case 'create':
          if (!email || !password) throw new Error('Email and password required');
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
          });
          if (createError) throw createError;
          return { 
            content: [{
              type: "text",
              text: `Created user: ${newUser.user?.id}`
            }]
          };
          
        case 'delete':
          if (!id) throw new Error('User ID required');
          const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
          if (deleteError) throw deleteError;
          return { 
            content: [{
              type: "text",
              text: `Deleted user: ${id}`
            }]
          };
      }
    } catch (error) {
      throw new Error(`Auth failed: ${error}`);
    }
  });

  return server.server;
}