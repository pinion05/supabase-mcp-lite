import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Configuration schema - minimal
export const configSchema = z.object({
  supabaseUrl: z.string().optional().describe("Supabase project URL"),
  supabaseKey: z.string().optional().describe("Supabase service role key"),
});

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: "supabase-lite",
    version: "1.0.0",
  });

  // Check if configuration is provided
  if (!config.supabaseUrl || !config.supabaseKey) {
    // Return empty server if not configured
    console.warn("Supabase not configured. Please provide supabaseUrl and supabaseKey.");
    return server;
  }

  // Initialize Supabase client
  const supabase: SupabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false }
  });

  // Tool 1: Select - Simple table query
  server.registerTool("select", {
    title: "Get data",
    inputSchema: z.object({
      table: z.string(),
      where: z.record(z.any()).optional(),
      limit: z.number().optional()
    }),
    handler: async ({ table, where = {}, limit = 100 }) => {
      try {
        let query = supabase.from(table).select('*');
        
        // Apply filters
        Object.entries(where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        
        // Apply limit
        query = query.limit(limit);
        
        const { data, error, count } = await query;
        if (error) throw error;
        
        return { 
          data: data || [], 
          count: count || data?.length || 0 
        };
      } catch (error) {
        throw new Error(`Select failed: ${error}`);
      }
    }
  });

  // Tool 2: Mutate - Insert/Update/Delete
  server.registerTool("mutate", {
    title: "Change data",
    inputSchema: z.object({
      action: z.enum(['insert', 'update', 'delete']),
      table: z.string(),
      data: z.any().optional(),
      where: z.record(z.any()).optional()
    }),
    handler: async ({ action, table, data, where = {} }) => {
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
          success: true, 
          affected: result.count || 0 
        };
      } catch (error) {
        throw new Error(`Mutate failed: ${error}`);
      }
    }
  });

  // Tool 3: Storage - File operations
  server.registerTool("storage", {
    title: "Files",
    inputSchema: z.object({
      action: z.enum(['upload', 'download', 'delete', 'list']),
      bucket: z.string(),
      path: z.string().optional(),
      data: z.string().optional()
    }),
    handler: async ({ action, bucket, path, data }) => {
      try {
        switch (action) {
          case 'upload':
            if (!path || !data) throw new Error('Path and data required');
            const uploadResult = await supabase.storage
              .from(bucket)
              .upload(path, Buffer.from(data, 'base64'));
            if (uploadResult.error) throw uploadResult.error;
            return { uploaded: path };
            
          case 'download':
            if (!path) throw new Error('Path required');
            const { data: file, error: downloadError } = await supabase.storage
              .from(bucket)
              .download(path);
            if (downloadError) throw downloadError;
            return { data: await file?.text() };
            
          case 'delete':
            if (!path) throw new Error('Path required');
            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([path]);
            if (deleteError) throw deleteError;
            return { deleted: path };
            
          case 'list':
            const { data: files, error: listError } = await supabase.storage
              .from(bucket)
              .list(path || '');
            if (listError) throw listError;
            return { files: files?.slice(0, 100) || [] };
        }
      } catch (error) {
        throw new Error(`Storage failed: ${error}`);
      }
    }
  });

  // Tool 4: Auth - User management  
  server.registerTool("auth", {
    title: "Users",
    inputSchema: z.object({
      action: z.enum(['list', 'create', 'delete']),
      email: z.string().optional(),
      password: z.string().optional(),
      id: z.string().optional()
    }),
    handler: async ({ action, email, password, id }) => {
      try {
        switch (action) {
          case 'list':
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) throw listError;
            // Return minimal user info
            return { 
              users: users?.slice(0, 100).map(u => ({
                id: u.id,
                email: u.email,
                created: u.created_at
              })) || []
            };
            
          case 'create':
            if (!email || !password) throw new Error('Email and password required');
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
              email,
              password,
              email_confirm: true
            });
            if (createError) throw createError;
            return { created: newUser.user?.id };
            
          case 'delete':
            if (!id) throw new Error('User ID required');
            const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
            if (deleteError) throw deleteError;
            return { deleted: id };
        }
      } catch (error) {
        throw new Error(`Auth failed: ${error}`);
      }
    }
  });

  return server;
}