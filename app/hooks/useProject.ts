import { useState, useEffect } from "react";
import type { FileSystemTree } from "@webcontainer/api";
import type { User } from "@prisma/client";
import { useWebSocket } from "./useWebsocket";

interface ProjectData {
  id: string;
  title: string;
  user?: {
    picture: string | null;
  } | null;
  messages: Array<{
    id: string;
    contents: string;
    type: "USER" | "SYSTEM";
    fileVersion?: {
      files: any;
    } | null;
  }>;
}

export function useProject(initialProject: ProjectData, user: User) {
  const [files, setFiles] = useState<FileSystemTree>(
    initialProject.messages[0]?.fileVersion?.files?.directory || {}
  );
  const [project, setProject] = useState<ProjectData | null>(null);
  const { socket, isConnected } = useWebSocket("http://localhost:3000", user);

  // Load initial project data
  useEffect(() => {
    if (initialProject && initialProject.messages.length > 0) {
      setProject(initialProject);
      const latestMessage =
        initialProject.messages[initialProject.messages.length - 1];
      if (latestMessage.fileVersion?.files) {
        setFiles((latestMessage.fileVersion.files as any).directory);
      }
    }
  }, [initialProject]);

  // Handle socket updates
  useEffect(() => {
    if (socket && isConnected) {
      (socket as any).on("project_update", (data: any) => {
        if (data.project) {
          setProject(data.project);
          setFiles(
            data.project.messages[data.project.messages.length - 1].fileVersion
              .files.directory,
          );
        }
      });
    }
  }, [socket, isConnected]);

  return {
    project,
    files,
    isConnected,
  };
} 