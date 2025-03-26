import { z } from "zod";
import { tool } from "ai";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { fetch } from "undici";
import { generateText, generateObject } from "ai";
import prettier from 'prettier';

type ModelProvider = "openai" | "anthropic";

// Select which model provider to use
const MODEL_PROVIDER: ModelProvider = "openai" as ModelProvider;

// Initialize the appropriate model based on the provider
const model = (() => {
  switch (MODEL_PROVIDER) {
    case "openai":
      return createOpenAI({ fetch: fetch as any });
    case "anthropic":
      return createAnthropic({ fetch: fetch as any });
  }
})();

interface ModelConfigOptions {
  maxTokens?: number;
  useStructuredOutputs?: boolean;
  modelVariant?: 'default' | 'mini';
}

function getModelConfig({ maxTokens, useStructuredOutputs = true, modelVariant = 'default' }: ModelConfigOptions = {}) {
  let modelName: string;
  const providerOptions: Record<string, any> = {};
  
  switch (MODEL_PROVIDER) {
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
        const lines = content.split('\n');
        const numberedLines = lines.map((line, index) => `${index + 1}: ${line}`);
        results[path] = numberedLines.join('\n');
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

export const updateFile = async (
  currentFiles: any,
  filePath: string,
  updates: Array<{
    type: 'addition' | 'modification' | 'removal';
    code: string | null;
    context: string;
  }>
) => {
  console.log(`🔄 Starting updateFile for ${filePath}`);
  console.log(`📝 Number of updates to apply: ${updates.length}`);
  const startTime = performance.now();
  
  // Read file contents using the reusable function
  let content: string;
  try {
    console.log(`📖 Attempting to read file: ${filePath}`);
    content = readFileContent(currentFiles, filePath);
    console.log(`✅ Successfully read file, content length: ${content.length} characters`);
  } catch (error) {
    const errorMessage = `Failed to read file ${filePath}: ${(error as Error).message}`;
    console.error(`❌ Error reading file: ${errorMessage}`);
    return {
      success: false,
      message: errorMessage,
      changes: []
    };
  }

  // Create a prompt for the model to generate the updated file content
  console.log('🤖 Preparing prompt for model');
  const prompt = `You are a code editor. Given the current file content and a list of updates to make, generate the complete updated file content.

Current file content:
<CURRENT_CURSOR_POSITION>
${content}

Updates to apply:
${updates.map(update => `
Type: ${update.type}
Context: ${update.context}
${update.code ? `New code:\n${update.code}` : ''}
`).join('\n')}

Please provide the complete updated file content that incorporates all the requested changes. Maintain the same style and indentation as the original file.`;

  // Call the model to generate the updated content
  console.log('🚀 Calling model to generate updated content');
  try {
    const result = await generateText({
      model: createGoogleGenerativeAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        fetch: fetch as any 
      })("gemini-2.0-flash"),
      system: "You are a code editor. Return only the complete updated file content, with NO DELIMITERS, commentary, or explanations. Maintain the same style and indentation as the original file.",
      messages: [{ role: "user", content: prompt }],
    });

    console.log('✅ Model generated updated content');
    const updatedContent = result.text.trim();
    console.log(`📝 Generated content length: ${updatedContent.length} characters`);

    // Format the updated content with Prettier
    try {
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
      console.log(`🎨 Formatting content with Prettier using parser: ${fileExtension}`);
      const parser = fileExtension === 'ts' || fileExtension === 'tsx' ? 'typescript' : 
                    fileExtension === 'js' || fileExtension === 'jsx' ? 'babel' : 
                    fileExtension === 'json' ? 'json' : 
                    fileExtension === 'css' ? 'css' : 
                    fileExtension === 'scss' ? 'scss' : 
                    fileExtension === 'html' ? 'html' : 
                    fileExtension === 'md' ? 'markdown' : 'babel';

      const formattedContent = await prettier.format(updatedContent, {
        parser,
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
      });

      console.log('✅ Content formatted successfully');

      // Update the file in currentFiles
      console.log('📁 Updating file in currentFiles structure');
      const parts = filePath.split('/');
      let current: any = currentFiles;
      
      // Navigate to parent directory
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current.directory) {
          console.log(`📁 Creating directory structure for: ${part}`);
          current.directory = {};
        }
        if (!current.directory[part]) {
          current.directory[part] = { directory: {} };
        }
        current = current.directory[part];
      }
      
      // Update the file content
      const fileName = parts[parts.length - 1];
      if (!current.directory) {
        current.directory = {};
      }
      
      current.directory[fileName] = {
        file: { contents: formattedContent.trim() }
      };

      console.log('✅ File structure updated successfully');

      const endTime = performance.now();
      console.log(`📊 UpdateFile execution time: ${(endTime - startTime).toFixed(2)}ms`);
      
      return {
        success: true,
        message: `Applied ${updates.length} updates to ${filePath}`,
        changes: updates,
        updatedContent: formattedContent.trim()
      };
    } catch (formatError) {
      console.error(`❌ Failed to format code with Prettier: ${(formatError as Error).message}`);
      return {
        success: false,
        message: `Failed to format updated content: ${(formatError as Error).message}`,
        changes: []
      };
    }
  } catch (modelError) {
    console.error(`❌ Error generating updated content: ${(modelError as Error).message}`);
    return {
      success: false,
      message: `Failed to generate updated content: ${(modelError as Error).message}`,
      changes: []
    };
  }
};

export const getPlanProjectUpdateTool = (currentFiles: any) => tool({
  description: "Analyzes a file and generates a plan for updates based on an objective. Returns a structured plan of additions, modifications, and removals needed.",
  parameters: z.object({
    filePath: z.string().describe("The path to the file to analyze"),
    objective: z.string().describe("The objective or goal for the file updates"),
  }),
  execute: async ({ filePath, objective }) => {
    console.log("📝 Planning updates for file:", filePath);
    console.log("🎯 Objective:", objective);
    const startTime = performance.now();

    // Read file content using the reusable function
    let fileContent: string;
    try {
      fileContent = readFileContent(currentFiles, filePath);
    } catch (error) {
      return {
        success: false,
        message: `Failed to read file ${filePath}: ${(error as Error).message}`,
        plan: null
      };
    }

    // Create a prompt for the model to analyze the file and generate a plan
    const prompt = `Given the following objective and file content, analyze what changes are needed and provide a structured plan of updates.

Objective:
${objective}

File Content:
${fileContent}

Please analyze the file and provide a structured plan that includes all necessary changes. For each change:
- For additions: Provide the exact code to be added and a clear description of where and why it should be added
- For modifications: Provide the exact code to replace existing code and a clear description of what's being changed and why
- For removals: Provide a clear description of what code should be removed and why

Format your response as a JSON object with the following structure:
{
  "filePath": "${filePath}",
  "updates": [
    {
      "type": "addition" | "modification" | "removal",
      "code": string | null,  // Required for additions and modifications, null for removals
      "context": "Clear description of what needs to be changed and why"
    }
  ]
}`;

    // Define the schema for the plan
    const planSchema = z.object({
      filePath: z.string(),
      updates: z.array(z.object({
        type: z.enum(['addition', 'modification', 'removal']),
        code: z.string().nullable(),
        context: z.string()
      }))
    });

    // Call the model to generate the plan
    const result = await generateObject({
      ...getModelConfig(),
      system: "You are a code analysis expert. Analyze the file and provide a structured plan of updates needed to achieve the objective. For additions and modifications, provide the exact code that should be added or modified. For removals, clearly describe what code should be removed. The context should clearly explain what changes are needed and why they are necessary. Be precise and specific in your descriptions.",
      messages: [{ role: "user", content: prompt }],
      schema: planSchema
    });

    const endTime = performance.now();
    console.log(`📊 PlanProjectUpdateTool execution time: ${(endTime - startTime).toFixed(2)}ms`);

    return {
      success: true,
      message: "Generated update plan successfully",
      plan: result.object
    };
  },
});

export const answerTool = tool({
  description: "A tool for providing a list of files that have been updated during the project changes",
  parameters: z.object({
    updatedFiles: z.array(z.string()).describe("List of file paths that have been updated"),
  }),
}); 