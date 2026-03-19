import type { ToolDefinition } from "./types";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    name: "list",
    description: `Lists files and directories in a given path. The path parameter must be absolute; omit it to use the current workspace directory. You can optionally provide an array of glob patterns to ignore with the ignore parameter. You should generally prefer the Glob and Grep tools, if you know which directories to search.`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The absolute path to the directory to list (must be absolute, not relative)",
        },
        ignore: {
          type: "array",
          items: { type: "string" },
          description: "List of glob patterns to ignore",
        },
      },
    },
  },
  {
    type: "function",
    name: "read",
    description: `Read a file or directory from the local filesystem. If the path does not exist, an error is returned.

Usage:
- The filePath parameter should be an absolute path.
- By default, this tool returns up to 2000 lines from the start of the file.
- The offset parameter is the line number to start from (1-indexed).
- To read later sections, call this tool again with a larger offset.
- Use the grep tool to find specific content in large files or files with long lines.
- If you are unsure of the correct file path, use the glob tool to look up filenames by glob pattern.
- Contents are returned with each line prefixed by its line number as \`<line>: <content>\`. For example, if a file has contents "foo\\n", you will receive "1: foo\\n". For directories, entries are returned one per line (without line numbers) with a trailing "/" for subdirectories.
- Any line longer than 2000 characters is truncated.
- Call this tool in parallel when you know there are multiple files you want to read.
- Avoid tiny repeated slices (30 line chunks). If you need more context, read a larger window.`,
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file or directory to read",
        },
        offset: {
          type: "number",
          description: "The line number to start reading from (1-indexed)",
        },
        limit: {
          type: "number",
          description: "The maximum number of lines to read (defaults to 2000)",
        },
      },
    },
  },
  {
    type: "function",
    name: "write",
    description: `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.`,
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to write to the file",
        },
        filePath: {
          type: "string",
          description: "The absolute path to the file to write (must be absolute, not relative)",
        },
      },
      required: ["content", "filePath"],
    },
  },
  {
    type: "function",
    name: "edit",
    description: `Performs exact string replacements in files.

Usage:
- You must use your Read tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: line number + colon + space (e.g., \`1: \`). Everything after that space is the actual file content to match. Never include any part of the line number prefix in the oldString or newString.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- The edit will FAIL if oldString is not found in the file with an error "oldString not found in content".
- The edit will FAIL if oldString is found multiple times in the file with an error "Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match." Either provide a larger string with more surrounding context to make the match unique or use replaceAll to change every instance of oldString.
- Use replaceAll for replacing and renaming strings across the file.`,
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to modify",
        },
        oldString: {
          type: "string",
          description: "The text to replace",
        },
        newString: {
          type: "string",
          description: "The text to replace it with (must be different from oldString)",
        },
        replaceAll: {
          type: "boolean",
          description: "Replace all occurrences of oldString (default false)",
        },
      },
      required: ["filePath", "oldString", "newString"],
    },
  },
  {
    type: "function",
    name: "bash",
    description: `Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.

All commands run in the workspace directory by default. Use the workdir parameter if you need to run a command in a different directory.

IMPORTANT: This tool is for terminal operations like git, npm, docker, etc. DO NOT use it for file operations (reading, writing, editing, searching, finding files) - use the specialized tools for this instead.

Before executing the command, please follow these steps:

1. Directory Verification: If the command will create new directories or files, first verify the parent directory exists.
2. Command Execution: Always quote file paths that contain spaces.
3. Capture the output of the command.

Usage notes:
  - The command argument is required.
  - You can specify an optional timeout in milliseconds. If not specified, commands will time out after 120000ms (2 minutes).
  - It is very helpful if you write a clear, concise description of what this command does in 5-10 words.
  - Avoid using Bash with find, grep, cat, head, tail, sed, awk, or echo commands. Instead, always prefer using the dedicated tools.
  - AVOID using cd <directory> && <command>. Use the workdir parameter instead.
  - When issuing multiple commands that depend on each other, use a single Bash call with '&&' to chain them together.`,
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command to execute",
        },
        timeout: {
          type: "number",
          description: "Optional timeout in milliseconds",
        },
        workdir: {
          type: "string",
          description: "The working directory to run the command in. Defaults to the workspace folder.",
        },
        description: {
          type: "string",
          description: "Clear, concise description of what this command does in 5-10 words.",
        },
      },
      required: ["command", "description"],
    },
  },
  {
    type: "function",
    name: "glob",
    description: `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead
- You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.`,
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The glob pattern to match files against",
        },
        path: {
          type: "string",
          description: "The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    type: "function",
    name: "grep",
    description: `- Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+", etc.)
- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")
- Returns file paths and line numbers with at least one match sorted by modification time
- Use this tool when you need to find files containing specific patterns
- If you need to identify/count the number of matches within files, use the Bash tool with rg (ripgrep) directly. Do NOT use grep.`,
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The regex pattern to search for in file contents",
        },
        path: {
          type: "string",
          description: "The directory to search in. Defaults to the current working directory.",
        },
        include: {
          type: "string",
          description: 'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
        },
      },
      required: ["pattern"],
    },
  },
  {
    type: "function",
    name: "webfetch",
    description: `- Fetches content from a specified URL
- Takes a URL and optional format as input
- Fetches the URL content, converts to requested format (markdown by default)
- Returns the content in the specified format
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - Format options: "markdown" (default), "text", or "html"
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large`,
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch content from",
        },
        format: {
          type: "string",
          enum: ["text", "markdown", "html"],
          description: "The format to return the content in (text, markdown, or html). Defaults to markdown.",
        },
        timeout: {
          type: "number",
          description: "Optional timeout in seconds (max 120)",
        },
      },
      required: ["url"],
    },
  },
  {
    type: "function",
    name: "websearch",
    description: `- Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs
- Provides up-to-date information for current events and recent data
- Supports configurable result counts and returns the content from the most relevant websites
- Use this tool for accessing information beyond knowledge cutoff
- Searches are performed automatically within a single API call

The current year is ${new Date().getFullYear()}. You MUST use this year when searching for recent information.`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Websearch query",
        },
        numResults: {
          type: "number",
          description: "Number of search results to return (default: 8)",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "todowrite",
    description: `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool
Use this tool proactively in these scenarios:
1. Complex multistep tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User provides multiple tasks - When users provide a list of things to be done
4. After receiving new instructions - Immediately capture user requirements as todos

## Task States
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE task at a time)
- completed: Task finished successfully
- cancelled: Task no longer needed`,
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string", description: "Brief description of the task" },
              status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["content", "status", "priority"],
          },
          description: "The updated todo list",
        },
      },
      required: ["todos"],
    },
  },
];
