import { z } from "zod";
import { tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { fetch } from "undici";
import { FileSystemTree } from "~/lib/chat";
import { tokenizeAndEstimateCost } from "llm-cost";
import { streamText } from "ai";

type ModelProvider = "openai" | "anthropic" | "deepinfra" | "google";

// Select which model provider to use
const MODEL_PROVIDER: ModelProvider = "google" as ModelProvider;

// Initialize the appropriate model based on the provider
const model = (() => {
  switch (MODEL_PROVIDER) {
    case "openai":
      return createOpenAI({ fetch: fetch as any });
    case "anthropic":
      return createAnthropic({ fetch: fetch as any });
    case "deepinfra":
      return createDeepInfra({
        apiKey: process.env.DEEPINFRA_API_KEY,
        baseURL: "https://api.deepinfra.com/v1",
        fetch: fetch as any
      });
    case "google":
      return createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        fetch: fetch as any,
      });
  }
})();

interface ModelConfigOptions {
  maxTokens?: number;
  useStructuredOutputs?: boolean;
  modelVariant?: 'default' | 'mini';
  provider?: ModelProvider;
}

function getModelConfig({ maxTokens, useStructuredOutputs = true, modelVariant = 'default', provider = MODEL_PROVIDER }: ModelConfigOptions = {}) {
  let modelName: string;
  const providerOptions: Record<string, any> = {};
  
  switch (provider) {
    case "openai":
      modelName = modelVariant === 'mini' ? "gpt-4o-mini" : "gpt-4o";
      if (maxTokens !== undefined) {
        providerOptions.openai = { max_tokens: maxTokens };
      }
      break;
    case "anthropic":
      modelName = "claude-3-7-sonnet-20250219";
      if (maxTokens !== undefined) {
        providerOptions.anthropic = { max_tokens: maxTokens };
      }
      break;
    case "deepinfra":
      modelName = "Qwen/Qwen2.5-Coder-32B-Instruct";
      console.log("🔄 Using DeepInfra model:", modelName);
      if (maxTokens !== undefined) {
        providerOptions.deepinfra = { max_tokens: maxTokens };
      }
      break;
    case "google":
      modelName = "gemini-2.5-pro-exp-03-25";
      break;
  }

  return {
    model: model(modelName) as any,
    ...(Object.keys(providerOptions).length > 0 && { providerOptions }),
  };
}

// Reusable function to read file contents
export function readFileContent(currentFiles: any, filePath: string): string {
  const parts = filePath.split('/');
  let current: any = currentFiles;
  
  for (const part of parts) {
    if (!current?.directory?.[part]) {
      throw new Error(`File not found: ${filePath}`);
    }
    current = current.directory[part];
  }
  
  if (!current?.file?.contents) {
    throw new Error(`Not a file: ${filePath}`);
  }
  
  return current.file.contents;
}

export const getListFilesTool = (currentFiles: any) => tool({
  description: "List all files in the project's current version",
  parameters: z.object({
    path: z.string().optional(),
  }),
  execute: async () => {
    const startTime = performance.now();
    const paths: string[] = [];
    function traverseFiles(obj: any, prefix = '') {
      if (obj.file?.contents) {
        paths.push(prefix);
      } else if (obj.directory) {
        Object.entries(obj.directory).forEach(([name, value]) => {
          traverseFiles(value, prefix ? `${prefix}/${name}` : name);
        });
      }
    }
    traverseFiles(currentFiles);
    const endTime = performance.now();
    console.log(`📊 ListFilesTool execution time: ${(endTime - startTime).toFixed(2)}ms`);
    return paths;
  },
});

export const getReadFileTool = (currentFiles: any) => tool({
  description: "Read the contents of multiple files from the project's current version. Each line will be prefixed with its line number (e.g. '1: first line', '2: second line', etc.). This tool should be used permissively to understand the full context of the codebase, including files that may be referenced or used indirectly. Pay special attention to files where content is rendered or displayed, such as markdown files, template files, and component files that may contain styling or content.",
  parameters: z.object({
    paths: z.array(z.string()),
  }),
  execute: async ({ paths }) => {
    const startTime = performance.now();
    const results: Record<string, string> = {};
    
    for (const path of paths) {
      try {
        const content = readFileContent(currentFiles, path);
        // const lines = content.split('\n');
        // const numberedLines = lines.map((line, index) => `${index + 1}: ${line}`);
        results[path] = content;
      } catch (error) {
        results[path] = `Error reading file: ${(error as Error).message}`;
      }
    }
    
    const endTime = performance.now();
    console.log(`📊 ReadFileTool execution time: ${(endTime - startTime).toFixed(2)}ms for ${paths.length} files`);
    return results;
  },
});

export const projectAnswerSchema = z.object({
  file: z.string(),
  overview: z.string(),
});

export const projectUpdateTool = tool({
  description: "A tool for providing the final response with updated files and explanations of changes",
  parameters: z.object({
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
      explanation: z.string().describe("A brief explanation of what changes were made to this file"),
    })),
  }),
});

function updateFileInTree(currentFiles: FileSystemTree, filepath: string, newContent: string) {
  const parts = filepath.split('/');
  let current: any = currentFiles;
  
  // Navigate to the parent directory
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current?.directory?.[parts[i]]) {
      throw new Error(`Directory not found: ${parts.slice(0, i + 1).join('/')}`);
    }
    current = current.directory[parts[i]];
  }
  
  // Update the file contents
  const fileName = parts[parts.length - 1];
  if (!current?.directory?.[fileName]) {
    throw new Error(`File not found: ${filepath}`);
  }
  current.directory[fileName].file.contents = newContent;
}

export const getUpdateFileTool = (currentFiles: FileSystemTree) => tool({
  description: "A tool for updating files in the project's current version. The tool supports three types of operations:\n" +
    "- removal: Removes specified code (oldCode) from the file\n" +
    "- modification: Replaces oldCode with newCode\n" +
    "- addition: Appends newCode after the specified oldCode (which serves as an anchor point)\n\n" +
    "Each update in the updates array contains:\n" +
    "- filepath: The path to the file to modify\n" +
    "- type: The type of operation to perform (removal, modification, or addition)\n" +
    "- oldCode: Required. For removals/modifications, this is the code to remove/replace. For additions, this is the anchor code to append after\n" +
    "- newCode: Required for modifications/additions. For modifications, this replaces oldCode. For additions, this is appended after oldCode. Not needed for removals",
  parameters: z.object({
    updates: z.array(z.object({
      filepath: z.string().describe("The path to the file to modify"),
      type: z.enum(["removal", "modification", "addition"]).describe("The type of operation to perform: removal (removes oldCode), modification (replaces oldCode with newCode), or addition (appends newCode after oldCode)"),
      oldCode: z.string().describe("Required. For removals/modifications, this is the code to remove/replace. For additions, this is the anchor code to append after"),
      newCode: z.string().optional().describe("Required for modifications/additions. For modifications, this replaces oldCode. For additions, this is appended after oldCode. Not needed for removals"),
    })).describe("Array of file updates to perform"),
  }),
  execute: async ({ updates }) => {
    const results: Record<string, string> = {};
    const errors: Record<string, string> = {};
    
    for (const update of updates) {
      const { filepath, type, oldCode, newCode = "" } = update;
      
      try {
        // Validate the update parameters
        if (!filepath || !type || !oldCode) {
          throw new Error("Missing required parameters");
        }
        
        if ((type === "modification" || type === "addition") && !newCode) {
          throw new Error(`newCode is required for ${type} operations`);
        }

        const fileContents = readFileContent(currentFiles, filepath);
        let newContent: string;

        if (type === "removal") {
          newContent = removeFileContent(fileContents, oldCode);
        } else if (type === "modification") {
          newContent = updateFileContent(fileContents, oldCode, newCode);
        } else if (type === "addition") {
          newContent = addFileContent(fileContents, oldCode, newCode);
        } else {
          throw new Error(`Invalid update type: ${type}`);
        }

        // Update currentFiles with the new content
        updateFileInTree(currentFiles, filepath, newContent);
        results[filepath] = newContent;
      } catch (error) {
        errors[filepath] = `Failed to process update: ${(error as Error).message}`;
        console.error(`Error processing update for ${filepath}:`, error);
      }
    }
    
    return {
      results,
      errors,
      updates
    };
  },
});

function removeFileContent(fileContents: string, oldCode: string) {
  return fileContents.replace(oldCode, '');
}

function updateFileContent(fileContents: string, oldCode: string, newCode: string) {
  return fileContents.replace(oldCode, newCode);
}

function addFileContent(fileContents: string, oldCode: string, newCode: string) {
  return fileContents.replace(oldCode, oldCode + '\n' + newCode);
}

export const getPreliminaryResponseTool = (dataStream: any) => tool({
  description: "A tool for providing a preliminary response about the planned changes. Should be a simple text response, of two sentences indicating your plan to complete the user's request. Please conlude the sentences with two newlines.",
  parameters: z.object({
    response: z.string().describe("The preliminary response text to stream to the user"),
  }),
  execute: async ({ response }) => {
    console.log('🎬 Preliminary response tool executing with response:', response);

    response = `${response}\n\n`;
    
    // Write message ID (24 chars after msg-)
    const messageId = "msg-" + Math.random().toString(36).substring(2, 26);
    dataStream.write(`f:{"messageId":"${messageId}"}\n`);
    
    // Write response chunks
    const chunks = response.match(/.{1,20}/g) || [response];
    for (const chunk of chunks) {
      dataStream.write(`0:"${chunk}"\n`);
    }
    
    // Add some newlines after the response
    // dataStream.write(`0:"\n\n"\n`);
    
    // Estimate tokens and write finish reason
    const result = await tokenizeAndEstimateCost({
      model: "gpt-4",
      input: "",
      output: response,
    });
    
    dataStream.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${result.outputTokens}},"isContinued":false}\n\n`);
    
    console.log('✅ Preliminary response tool completed');
    return { success: true };
  },
});

export const getConcludingResponseTool = (dataStream: any) => tool({
  description: "A tool for providing a concluding response about the completed changes",
  parameters: z.object({
    response: z.string().describe("The concluding response text to stream to the user"),
  }),
  execute: async ({ response }) => {
    console.log('🎬 Concluding response tool executing...');
    
    // Write message ID (24 chars after msg-)
    const messageId = "msg-" + Math.random().toString(36).substring(2, 26);
    dataStream.write(`f:{"messageId":"${messageId}"}\n`);
    
    // Write response chunks
    const chunks = response.match(/.{1,20}/g) || [response];
    for (const chunk of chunks) {
      dataStream.write(`0:"${chunk}"\n`);
    }
    
    // Estimate tokens and write finish reason
    const result = await tokenizeAndEstimateCost({
      model: "gpt-4",
      input: "",
      output: response,
    });
    
    dataStream.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${result.outputTokens}},"isContinued":false}\n\n`);
    
    console.log('✅ Concluding response tool completed');
    return { success: true };
  },
});
