import { z } from "zod";
import { tool } from "ai";

export const getListFilesTool = (currentFiles: any) => tool({
  description: "List all files in the project's current version",
  parameters: z.object({
    path: z.string().optional(),
  }),
  execute: async () => {
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
    return paths;
  },
});

export const getReadFileTool = (currentFiles: any) => tool({
  description: "Read the contents of a file from the project's current version",
  parameters: z.object({
    path: z.string(),
  }),
  execute: async ({ path }) => {
    const parts = path.split('/');
    let current: any = currentFiles;
    
    for (const part of parts) {
      if (!current?.directory?.[part]) {
        throw new Error(`File not found: ${path}`);
      }
      current = current.directory[part];
    }
    
    if (!current?.file?.contents) {
      throw new Error(`Not a file: ${path}`);
    }
    
    return current.file.contents;
  },
});

export const projectAnswerTool = tool({
  description: "A tool for providing a response",
  parameters: z.object({
    preliminaryResponse: z.string(),
    file: z.string(),
    overview: z.string(),
  }),
});

export const projectUpdateTool = tool({
  description: "A tool for providing the final response with updated files",
  parameters: z.object({
    preliminaryResponse: z.string(),
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })),
    explanation: z.string(),
  }),
}); 