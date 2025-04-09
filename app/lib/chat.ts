// External package imports
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { generateText, streamText } from "ai";
import { fetch } from "undici";
import _ from "lodash";

// Node.js built-in imports
import { performance } from "perf_hooks";

// Type imports
import { DirectoryNode } from "@webcontainer/api";

// Local imports
import {
  getListFilesTool,
  getReadFileTool,
  getUpdateFileTool,
  getPreliminaryResponseTool,
  getConcludingResponseTool,
} from "~/tools/project.tools";

export interface FileSystemTree {
  [name: string]: DirectoryNode | { file: { contents: string } };
}

export type ModelProvider =
  | "openai"
  | "deepseek"
  | "anthropic"
  | "google"
  | "deepinfra";

// Select which model provider to use
export const MODEL_PROVIDER: ModelProvider = "anthropic" as ModelProvider;

// Initialize the appropriate model based on the provider
export const model = (() => {
  switch (MODEL_PROVIDER) {
    case "deepseek":
      return createDeepSeek({ fetch: fetch as any });
    case "openai":
      return createOpenAI({ fetch: fetch as any });
    case "anthropic":
      return createAnthropic({ fetch: fetch as any });
    case "google":
      return createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        fetch: fetch as any,
      });
    case "deepinfra":
      return createDeepInfra({
        apiKey: process.env.DEEPINFRA_API_KEY,
        fetch: fetch as any,
      });
  }
})();

export interface ModelConfigOptions {
  maxTokens?: number;
  useStructuredOutputs?: boolean;
}

export function getModelConfig({
  maxTokens,
  useStructuredOutputs = true,
  provider = MODEL_PROVIDER,
}: ModelConfigOptions & { provider?: ModelProvider } = {}) {
  let modelName: string;
  const providerOptions: Record<string, any> = {};

  switch (provider) {
    case "deepseek":
      modelName = "deepseek-chat";
      break;
    case "openai":
      modelName = "gpt-4o";
      break;
    case "anthropic":
      // modelName = "claude-3-7-sonnet-20250219";
      modelName = "claude-3-5-sonnet-20241022";
      // if (maxTokens !== undefined) {
      // providerOptions.anthropic = { max_tokens: maxTokens };
      // }
      break;
    case "google":
      modelName = "gemini-2.5-pro-exp-03-25";
      break;
    case "deepinfra":
      modelName = "Qwen/Qwen2.5-Coder-32B-Instruct";
      break;
  }

  return {
    model: model(modelName) as any,
    ...(Object.keys(providerOptions).length > 0 && { providerOptions }),
  };
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  files?: Record<string, any>;
}

// Profiling utility
export const profile = async (name: string, fn: () => Promise<any>) => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`⏱️ ${name} took ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.log(`⏱️ ${name} failed after ${duration.toFixed(2)}ms`);
    throw error;
  }
};

export async function generateComplexityCheck(
  messages: Message[],
  prompt: string,
): Promise<"base" | "complex"> {
  return profile("generateComplexityCheck", async () => {
    try {
      const config = getModelConfig({ maxTokens: 100 });

      const result = await generateText({
        ...config,
        system: `You are an AI assistant that analyzes chat interactions to determine if the AI is failing to meet user expectations.
        Your task is to analyze the conversation history and current prompt to determine if the AI needs to switch to a more complex model.
        Return ONLY the word 'complex' if:
        - The user is expressing frustration or dissatisfaction
        - The AI's previous responses were inadequate
        - The task requires more sophisticated reasoning
        - The user is asking for multiple complex changes
        Return ONLY the word 'base' in all other cases.`,
        messages: [...messages, { role: "user", content: prompt }],
      });

      const textContent = result.text;

      const complexity =
        textContent.trim().toLowerCase() === "complex" ? "complex" : "base";
      console.log(
        `🤖 Complexity check: Using ${complexity} model configuration`,
      );
      return complexity;
    } catch (error) {
      console.error("Error generating complexity check:", error);
      console.log(
        "🤖 Complexity check: Falling back to base model configuration",
      );
      return "base";
    }
  });
}

export async function generatePreliminaryResponse(
  messages: Message[],
  prompt: string,
  dataStream: any,
) {
  return profile("generatePreliminaryResponse", async () => {
    try {
      const config = getModelConfig({});

      const prelimResult = streamText({
        ...config,
        system: `You are an expert javascript/typescript engineer ai.
        Given a project prompt, provide a brief preliminary response of exactly 1-2 sentences.
        The response should be conversational and direct, without any markdown formatting or lists.
        Do not provide an overview of changes or implementation details.
        Do not ask questions or request user input.
        Simply acknowledge the request and indicate that you will proceed with making the changes.
        Example: "I'll help you create a responsive navigation menu with smooth animations."`,
        messages: [
          ...messages.slice(-10),
          {
            role: "user",
            content: `Provide a preliminary response for this update: ${prompt}`,
          },
        ],
      });

      prelimResult.mergeIntoDataStream(dataStream, {
        experimental_sendFinish: false,
      });

      const prelimResponse = await prelimResult.response;

      const lastMessage =
        prelimResponse.messages[prelimResponse.messages.length - 1];
      const textContent = Array.isArray(lastMessage.content)
        ? lastMessage.content.find((item) => item.type === "text")?.text || ""
        : lastMessage.content;

      return textContent;
    } catch (error) {
      console.error("Error generating preliminary response:", error);
      throw error;
    }
  });
}

export async function generateProjectUpdates(
  messages: Message[],
  currentFiles: FileSystemTree,
  prompt: string,
  dataStream: any,
  complexity: "base" | "complex" = "base",
): Promise<{ files: FileSystemTree; commentary: string[] }> {
  return profile("generateProjectUpdates", async () => {
    const modelConfig = getModelConfig({
      provider: complexity === "complex" ? "anthropic" : MODEL_PROVIDER,
    });
    const clonedFiles = _.cloneDeep(currentFiles);

    try {
      const result = streamText({
        model: modelConfig.model,
        tools: {
          listFiles: getListFilesTool(clonedFiles),
          readFile: getReadFileTool(clonedFiles),
          updateFile: getUpdateFileTool(clonedFiles),
          preliminaryResponse: getPreliminaryResponseTool(dataStream),
          // concludingResponse: getConcludingResponseTool(dataStream),
        },
        maxSteps: 7,
        system: `You are an AI code editor assistant with access to project files. You can:
1. List files in the project structure
2. Read file contents
3. Update file contents
4. Provide preliminary responses about planned changes (in markdown format)
5. Provide concluding responses about completed changes

Your task is to analyze the user's request and make appropriate changes to the project files. You should:
1. First use listFiles and readFile to understand the project structure
2. Provide a preliminary response about your planned changes in markdown format
3. Make precise, targeted updates to relevant files

When providing supplementary commentary in markdown format:
- Do not use headers or section titles
- Use only lists and code blocks for formatting
- Keep the commentary concise and focused on implementation details

You have access to the current file tree and can interact with files through the provided tools.`,
        messages: [...messages, { role: "user", content: prompt }],
      });

      // Comment out the dataStream merge since we're using the new response tools
      // result.mergeIntoDataStream(dataStream, { experimental_sendFinish: false });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "error":
            const error = part.error;
            console.error("Error generating project updates:", error);
            break;
        }
      }

      const response = await result.response;
      const commentary: string[] = [];

      console.log("RESPONSE MESSAGES", JSON.stringify(response.messages, null, 2));

      const updateFileResults = response.messages
        .filter((message) => message.role === "tool")
        .map((message) => message.content)
        .filter((content) => Array.isArray(content))
        .flatMap((content) => 
          content.filter((item) => 
            typeof item === "object" && 
            "type" in item && 
            item.type === "tool-result" && 
            item.toolName === "updateFile"
          )
        );

      // Generate concluding response based on updateFileResults
      const concludingResult = await streamText({
        ...getModelConfig({ maxTokens: 200 }),
        system: `You are an expert javascript/typescript engineer ai.
        Given a list of file updates, provide a concise concluding response that summarizes the changes made.
        The response should be conversational and direct, without any markdown formatting or lists.
        Focus on the key changes and their impact.
        Example: "I've updated the navigation component to include smooth transitions and improved accessibility."`,
        messages: [
          {
            role: "user",
            content: `Provide a concluding response for these file updates: ${JSON.stringify(updateFileResults)}`,
          },
        ],
      });

      const messageId = "msg-" + Math.random().toString(36).substring(2, 26);
      dataStream.write(`f:{"messageId":"${messageId}"}\n`);
      dataStream.write(`0: ${JSON.stringify("\n\n")}\n`);
      dataStream.write(`e:{"finishReason":"stop","usage":{"promptTokens":2,"completionTokens":2},"isContinued":false}\n`);
      concludingResult.mergeIntoDataStream(dataStream, { experimental_sendFinish: false });
      const concludingResponse = await concludingResult.response;
      const concludingText = Array.isArray(concludingResponse.messages[0].content)
        ? concludingResponse.messages[0].content.find((item) => item.type === "text")?.text || ""
        : concludingResponse.messages[0].content;
      
      commentary.push(concludingText);

      response.messages.forEach((message) => {
        if (
          message.role === "assistant" &&
          message.content?.[0] &&
          typeof message.content[0] === "object" &&
          "type" in message.content[0] &&
          message.content[0].type === "text"
        ) {
          commentary.push((message.content[0] as { text: string }).text);
        }
      });

      return {
        files: clonedFiles,
        commentary,
      };
    } catch (error) {
      console.error("Error in generateProjectUpdates:", error);
      throw error;
    }
  });
}
