import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Configuration schema - Personal Access Token for management API
export const configSchema = z.object({
  accessToken: z.string().describe("Supabase Personal Access Token (starts with sbp_) - get from https://supabase.com/dashboard/account/tokens"),
});

// Cache for project keys to avoid repeated API calls
const projectKeyCache: { [projectId: string]: { serviceRoleKey: string, anonKey: string } } = {};

async function getProjectKeys(projectId: string, accessToken: string) {
  // Check cache first
  if (projectKeyCache[projectId]) {
    console.log('📦 [Cache] Using cached keys for project:', projectId);
    return projectKeyCache[projectId];
  }

  console.log('🔑 [API] Fetching keys for project:', projectId);
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch project keys: ${response.status} ${response.statusText}`);
    }

    const keys = await response.json();
    
    // Find the service role key
    const serviceRoleKey = keys.find((k: any) => k.name === 'service_role')?.api_key;
    const anonKey = keys.find((k: any) => k.name === 'anon')?.api_key;
    
    if (!serviceRoleKey) {
      throw new Error('Service role key not found in project keys');
    }

    // Cache the keys
    projectKeyCache[projectId] = { serviceRoleKey, anonKey };
    console.log('✅ [API] Keys fetched and cached successfully');
    
    return projectKeyCache[projectId];
  } catch (error) {
    console.error('❌ [API] Failed to fetch project keys:', error);
    throw error;
  }
}

// Extract project ID from URL
function extractProjectId(projectUrl: string): string {
  const match = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error('Invalid Supabase project URL');
  }
  return match[1];
}

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  console.log('🚀 [Server] Initializing Supabase MCP Lite v1.0.0');
  
  const server = new McpServer({
    name: "supabase-lite",
    version: "1.0.0",
  });

  // Check if access token is provided
  if (!config?.accessToken) {
    console.error('❌ [Server] CRITICAL: Supabase Personal Access Token not configured!');
    console.warn("Please provide accessToken (starts with sbp_) from https://supabase.com/dashboard/account/tokens");
    return server.server;
  }

  // Validate token format
  if (!config.accessToken.startsWith('sbp_')) {
    console.error('❌ [Server] Invalid access token format. Must start with sbp_');
    console.warn("Access token should start with sbp_. Get it from https://supabase.com/dashboard/account/tokens");
    return server.server;
  }
  
  console.log('✅ [Server] Supabase Personal Access Token configured');
  console.log('⚠️  [Server] Will fetch service role key automatically for each project');
  console.log('📝 [Server] Registering 4 tools: select, mutate, storage, auth');

  // Tool 1: Select - Simple table query
  server.registerTool("select", {
    title: "Get data",
    description: "Select data from a table",
    inputSchema: {
      projectUrl: z.string().describe("Supabase project URL"),
      table: z.string().describe("Table name"),
      where: z.record(z.any()).optional().describe("Filter conditions"),
      limit: z.number().optional().describe("Maximum rows to return")
    }
  }, async ({ projectUrl, table, where = {}, limit = 100 }) => {
    console.log('🔵 [Select] Started with params:', { projectUrl, table, where, limit });
    
    try {
      // Extract project ID and get service role key
      const projectId = extractProjectId(projectUrl);
      const { serviceRoleKey } = await getProjectKeys(projectId, config.accessToken);
      
      console.log('🌐 [Select] Creating Supabase client for:', projectUrl);
      console.log('🔓 [Select] Using service role key - bypassing RLS');
      const client = createClient(projectUrl, serviceRoleKey, {
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-bypass-rls': 'true'  // Explicit RLS bypass with service role
          }
        }
      });
      
      console.log('📝 [Select] Building query for table:', table);
      let query = client.from(table).select('*');
      
      // Apply filters
      const filterCount = Object.keys(where).length;
      if (filterCount > 0) {
        console.log('🔀 [Select] Applying filters:', where);
        Object.entries(where).forEach(([key, value]) => {
          console.log(`  🔍 [Select] Filter: ${key} = ${value}`);
          query = query.eq(key, value);
        });
      } else {
        console.log('🔀 [Select] No filters applied');
      }
      
      // Apply limit
      console.log('📊 [Select] Applying limit:', limit);
      query = query.limit(limit);
      
      console.log('⚡ [Select] Executing query...');
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ [Select] Query error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: JSON.stringify(error, null, 2)
        });
        throw error;
      }
      
      const resultCount = data?.length || 0;
      console.log('✅ [Select] Query successful, returned rows:', resultCount);
      
      return { 
        content: [{
          type: "text",
          text: JSON.stringify({ 
            data: data || [], 
            count: resultCount 
          }, null, 2)
        }]
      };
    } catch (error: any) {
      console.error('❌ [Select] Fatal error:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        fullError: JSON.stringify(error, null, 2)
      });
      
      // Better error message with actual details
      const errorMessage = error?.message || 'Unknown error';
      const errorDetails = error?.details || '';
      const errorHint = error?.hint || '';
      
      throw new Error(`Select failed: ${errorMessage}${errorDetails ? ` - Details: ${errorDetails}` : ''}${errorHint ? ` - Hint: ${errorHint}` : ''}`);
    }
  });

  // Tool 2: Mutate - Insert/Update/Delete
  server.registerTool("mutate", {
    title: "Change data",
    description: "Insert, update or delete data",
    inputSchema: {
      projectUrl: z.string().describe("Supabase project URL"),
      action: z.enum(['insert', 'update', 'delete']).describe("Operation type"),
      table: z.string().describe("Table name"),
      data: z.any().optional().describe("Data for insert/update"),
      where: z.record(z.any()).optional().describe("Filter for update/delete")
    }
  }, async ({ projectUrl, action, table, data, where = {} }) => {
    console.log('🔵 [Mutate] Started with params:', { 
      projectUrl, 
      action, 
      table, 
      data: data ? JSON.stringify(data, null, 2) : 'none',
      where: Object.keys(where).length > 0 ? where : 'none'
    });
    
    try {
      // Extract project ID and get service role key
      const projectId = extractProjectId(projectUrl);
      const { serviceRoleKey } = await getProjectKeys(projectId, config.accessToken);
      
      console.log('🌐 [Mutate] Creating Supabase client for:', projectUrl);
      console.log('🔓 [Mutate] Using service role key - bypassing RLS');
      const client = createClient(projectUrl, serviceRoleKey, {
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-bypass-rls': 'true'  // Explicit RLS bypass with service role
          }
        }
      });
      
      let result;
      console.log(`🔀 [Mutate] Executing action: ${action} on table: ${table}`);
      
      switch (action) {
        case 'insert':
          if (!data) {
            console.error('❌ [Mutate] Insert attempted without data');
            throw new Error('Data required for insert');
          }
          console.log('📝 [Mutate] Inserting data:', JSON.stringify(data, null, 2));
          result = await client.from(table).insert(data);
          console.log('✅ [Mutate] Insert completed');
          break;
          
        case 'update':
          if (!data) {
            console.error('❌ [Mutate] Update attempted without data');
            throw new Error('Data required for update');
          }
          console.log('📝 [Mutate] Updating with data:', JSON.stringify(data, null, 2));
          let updateQuery = client.from(table).update(data);
          
          const updateFilterCount = Object.keys(where).length;
          if (updateFilterCount > 0) {
            console.log('🔍 [Mutate] Applying update filters:', where);
            Object.entries(where).forEach(([key, value]) => {
              console.log(`  🔍 [Mutate] Filter: ${key} = ${value}`);
              updateQuery = updateQuery.eq(key, value);
            });
          } else {
            console.warn('⚠️ [Mutate] Update without WHERE clause - will update ALL rows!');
          }
          
          result = await updateQuery;
          console.log('✅ [Mutate] Update completed');
          break;
          
        case 'delete':
          console.log('🗑️ [Mutate] Deleting from table:', table);
          let deleteQuery = client.from(table).delete();
          
          const deleteFilterCount = Object.keys(where).length;
          if (deleteFilterCount > 0) {
            console.log('🔍 [Mutate] Applying delete filters:', where);
            Object.entries(where).forEach(([key, value]) => {
              console.log(`  🔍 [Mutate] Filter: ${key} = ${value}`);
              deleteQuery = deleteQuery.eq(key, value);
            });
          } else {
            console.warn('⚠️ [Mutate] Delete without WHERE clause - will delete ALL rows!');
          }
          
          result = await deleteQuery;
          console.log('✅ [Mutate] Delete completed');
          break;
      }
      
      if (result.error) {
        console.error('❌ [Mutate] Operation error:', {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code,
          fullError: JSON.stringify(result.error, null, 2)
        });
        throw result.error;
      }
      
      const affectedCount = result.count || 0;
      console.log(`✅ [Mutate] Operation successful, affected rows: ${affectedCount}`);
      
      return { 
        content: [{
          type: "text",
          text: JSON.stringify({ 
            success: true, 
            affected: affectedCount 
          }, null, 2)
        }]
      };
    } catch (error: any) {
      console.error('❌ [Mutate] Fatal error:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        fullError: JSON.stringify(error, null, 2)
      });
      
      const errorMessage = error?.message || 'Unknown error';
      const errorDetails = error?.details || '';
      const errorHint = error?.hint || '';
      
      throw new Error(`Mutate failed: ${errorMessage}${errorDetails ? ` - Details: ${errorDetails}` : ''}${errorHint ? ` - Hint: ${errorHint}` : ''}`);
    }
  });

  // Tool 3: Storage - File operations
  server.registerTool("storage", {
    title: "Files",
    description: "Manage storage files",
    inputSchema: {
      projectUrl: z.string().describe("Supabase project URL"),
      action: z.enum(['upload', 'download', 'delete', 'list']).describe("Operation"),
      bucket: z.string().describe("Storage bucket"),
      path: z.string().optional().describe("File path"),
      data: z.string().optional().describe("File data (base64)")
    }
  }, async ({ projectUrl, action, bucket, path, data }) => {
    console.log('🔵 [Storage] Started with params:', {
      projectUrl,
      action,
      bucket,
      path: path || 'root',
      hasData: !!data,
      dataLength: data ? data.length : 0
    });
    
    try {
      // Extract project ID and get service role key
      const projectId = extractProjectId(projectUrl);
      const { serviceRoleKey } = await getProjectKeys(projectId, config.accessToken);
      
      console.log('🌐 [Storage] Creating Supabase client for:', projectUrl);
      console.log('🔓 [Storage] Using service role key - full storage access');
      const client = createClient(projectUrl, serviceRoleKey, {
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-bypass-rls': 'true'  // Explicit RLS bypass with service role
          }
        }
      });
      
      console.log(`🔀 [Storage] Executing action: ${action} on bucket: ${bucket}`);
      
      switch (action) {
        case 'upload':
          if (!path || !data) {
            console.error('❌ [Storage] Upload missing required params:', { path, hasData: !!data });
            throw new Error('Path and data required');
          }
          console.log(`📤 [Storage] Uploading file to: ${bucket}/${path}`);
          console.log(`📊 [Storage] File size (base64): ${data.length} characters`);
          
          const uploadResult = await client.storage
            .from(bucket)
            .upload(path, Buffer.from(data, 'base64'));
            
          if (uploadResult.error) {
            console.error('❌ [Storage] Upload error:', {
              message: uploadResult.error.message,
              statusCode: uploadResult.error.statusCode,
              fullError: JSON.stringify(uploadResult.error, null, 2)
            });
            throw uploadResult.error;
          }
          
          console.log('✅ [Storage] Upload successful:', path);
          return { 
            content: [{
              type: "text",
              text: `Uploaded: ${path}`
            }]
          };
          
        case 'download':
          if (!path) {
            console.error('❌ [Storage] Download missing path');
            throw new Error('Path required');
          }
          console.log(`📥 [Storage] Downloading file from: ${bucket}/${path}`);
          
          const { data: file, error: downloadError } = await client.storage
            .from(bucket)
            .download(path);
            
          if (downloadError) {
            console.error('❌ [Storage] Download error:', {
              message: downloadError.message,
              statusCode: downloadError.statusCode,
              fullError: JSON.stringify(downloadError, null, 2)
            });
            throw downloadError;
          }
          
          const fileText = await file?.text();
          console.log(`✅ [Storage] Download successful, file size: ${fileText?.length || 0} characters`);
          
          return { 
            content: [{
              type: "text",
              text: fileText || ''
            }]
          };
          
        case 'delete':
          if (!path) {
            console.error('❌ [Storage] Delete missing path');
            throw new Error('Path required');
          }
          console.log(`🗑️ [Storage] Deleting file: ${bucket}/${path}`);
          
          const { error: deleteError } = await client.storage
            .from(bucket)
            .remove([path]);
            
          if (deleteError) {
            console.error('❌ [Storage] Delete error:', {
              message: deleteError.message,
              statusCode: deleteError.statusCode,
              fullError: JSON.stringify(deleteError, null, 2)
            });
            throw deleteError;
          }
          
          console.log('✅ [Storage] Delete successful:', path);
          return { 
            content: [{
              type: "text",
              text: `Deleted: ${path}`
            }]
          };
          
        case 'list':
          const listPath = path || '';
          console.log(`📂 [Storage] Listing files in: ${bucket}/${listPath || 'root'}`);
          
          const { data: files, error: listError } = await client.storage
            .from(bucket)
            .list(listPath);
            
          if (listError) {
            console.error('❌ [Storage] List error:', {
              message: listError.message,
              statusCode: listError.statusCode,
              fullError: JSON.stringify(listError, null, 2)
            });
            throw listError;
          }
          
          const fileCount = files?.length || 0;
          const truncatedFiles = files?.slice(0, 100) || [];
          console.log(`✅ [Storage] List successful, found ${fileCount} files`);
          if (fileCount > 100) {
            console.log(`📊 [Storage] Returning first 100 of ${fileCount} files`);
          }
          
          return { 
            content: [{
              type: "text",
              text: JSON.stringify(truncatedFiles, null, 2)
            }]
          };
      }
    } catch (error: any) {
      console.error('❌ [Storage] Fatal error:', {
        name: error?.name,
        message: error?.message,
        statusCode: error?.statusCode,
        stack: error?.stack,
        fullError: JSON.stringify(error, null, 2)
      });
      
      const errorMessage = error?.message || 'Unknown error';
      const errorStatusCode = error?.statusCode || '';
      
      throw new Error(`Storage failed: ${errorMessage}${errorStatusCode ? ` (Status: ${errorStatusCode})` : ''}`);
    }
  });

  // Tool 4: Auth - User management  
  server.registerTool("auth", {
    title: "Users",
    description: "Manage users",
    inputSchema: {
      projectUrl: z.string().describe("Supabase project URL"),
      action: z.enum(['list', 'create', 'delete']).describe("Operation"),
      email: z.string().optional().describe("User email"),
      password: z.string().optional().describe("User password"),
      id: z.string().optional().describe("User ID")
    }
  }, async ({ projectUrl, action, email, password, id }) => {
    console.log('🔵 [Auth] Started with params:', {
      projectUrl,
      action,
      email: email || 'none',
      hasPassword: !!password,
      id: id || 'none'
    });
    
    try {
      // Extract project ID and get service role key
      const projectId = extractProjectId(projectUrl);
      const { serviceRoleKey } = await getProjectKeys(projectId, config.accessToken);
      
      console.log('🌐 [Auth] Creating Supabase client for:', projectUrl);
      console.log('🔓 [Auth] Using service role key - full admin access');
      const client = createClient(projectUrl, serviceRoleKey, {
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-bypass-rls': 'true'  // Explicit RLS bypass with service role
          }
        }
      });
      
      console.log(`🔀 [Auth] Executing action: ${action}`);
      
      switch (action) {
        case 'list':
          console.log('📋 [Auth] Listing users...');
          const { data: listData, error: listError } = await client.auth.admin.listUsers();
          
          if (listError) {
            console.error('❌ [Auth] List users error:', {
              message: listError.message,
              status: listError.status,
              fullError: JSON.stringify(listError, null, 2)
            });
            throw listError;
          }
          
          const users = listData?.users || [];
          const userCount = users.length;
          console.log(`✅ [Auth] Found ${userCount} users`);
          
          // Return minimal user info
          const userList = users.slice(0, 100).map(u => ({
            id: u.id,
            email: u.email,
            created: u.created_at
          }));
          
          if (userCount > 100) {
            console.log(`📊 [Auth] Returning first 100 of ${userCount} users`);
          }
          
          return { 
            content: [{
              type: "text",
              text: JSON.stringify(userList, null, 2)
            }]
          };
          
        case 'create':
          if (!email || !password) {
            console.error('❌ [Auth] Create user missing required params:', { 
              hasEmail: !!email, 
              hasPassword: !!password 
            });
            throw new Error('Email and password required');
          }
          
          console.log(`👤 [Auth] Creating user with email: ${email}`);
          const { data: newUser, error: createError } = await client.auth.admin.createUser({
            email,
            password,
            email_confirm: true
          });
          
          if (createError) {
            console.error('❌ [Auth] Create user error:', {
              message: createError.message,
              status: createError.status,
              code: createError.code,
              fullError: JSON.stringify(createError, null, 2)
            });
            throw createError;
          }
          
          const newUserId = newUser.user?.id;
          console.log(`✅ [Auth] User created successfully with ID: ${newUserId}`);
          
          return { 
            content: [{
              type: "text",
              text: `Created user: ${newUserId}`
            }]
          };
          
        case 'delete':
          if (!id) {
            console.error('❌ [Auth] Delete user missing ID');
            throw new Error('User ID required');
          }
          
          console.log(`🗑️ [Auth] Deleting user with ID: ${id}`);
          const { error: deleteError } = await client.auth.admin.deleteUser(id);
          
          if (deleteError) {
            console.error('❌ [Auth] Delete user error:', {
              message: deleteError.message,
              status: deleteError.status,
              code: deleteError.code,
              fullError: JSON.stringify(deleteError, null, 2)
            });
            throw deleteError;
          }
          
          console.log(`✅ [Auth] User deleted successfully: ${id}`);
          
          return { 
            content: [{
              type: "text",
              text: `Deleted user: ${id}`
            }]
          };
      }
    } catch (error: any) {
      console.error('❌ [Auth] Fatal error:', {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack,
        fullError: JSON.stringify(error, null, 2)
      });
      
      const errorMessage = error?.message || 'Unknown error';
      const errorStatus = error?.status || '';
      const errorCode = error?.code || '';
      
      throw new Error(`Auth failed: ${errorMessage}${errorStatus ? ` (Status: ${errorStatus})` : ''}${errorCode ? ` [Code: ${errorCode}]` : ''}`);
    }
  });

  console.log('✅ [Server] All tools registered successfully');
  console.log('🎉 [Server] Supabase MCP Lite ready to serve!');
  
  return server.server;
}