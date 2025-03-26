import { useState, useEffect, RefObject } from "react";
import {
  FileSystemTree,
  WebContainer,
  WebContainerProcess,
} from "@webcontainer/api";

interface UseWebContainerProps {
  files: FileSystemTree;
  iframeRef: RefObject<HTMLIFrameElement>;
}

async function installDependencies(webcontainerInstance: WebContainer) {
  const installProcess = await webcontainerInstance.spawn("npm", ["install"]);
  return installProcess.exit;
}

async function startDevServer(
  webcontainerInstance: WebContainer,
  iframeEl: HTMLIFrameElement,
) {
  const devProcess = await webcontainerInstance.spawn("npm", ["run", "dev"]);
  webcontainerInstance.on("server-ready", (port: number, url: string) => {
    iframeEl.src = url;
  });
  return devProcess;
}

function bootContainer({
  iframeEl,
}: {
  iframeEl: HTMLIFrameElement;
}): Promise<WebContainer> | null {
  try {
    return WebContainer.boot({ coep: "credentialless" }).then(
      (webcontainerInstance: WebContainer) => {
        return webcontainerInstance;
      },
    );
  } catch (error) {
    console.error("Error booting container", error);
    return null;
  }
}

async function startContainer({
  files,
  iframeEl,
  webcontainerInstance,
  setDevProcess,
  doInstall = true,
}: {
  files: FileSystemTree;
  iframeEl: HTMLIFrameElement;
  webcontainerInstance: WebContainer;
  setDevProcess: (process: WebContainerProcess) => void;
  doInstall?: boolean;
}) {
  await webcontainerInstance.mount(files);
  if (doInstall) {
    console.log("installing dependencies");
    const exitCode = await installDependencies(webcontainerInstance);
    if (exitCode !== 0) {
      throw new Error("Installation failed");
    }
  }
  console.log("starting dev server");
  const process = await startDevServer(webcontainerInstance, iframeEl);
  setDevProcess(process);
}

export function useWebContainer({ files, iframeRef }: UseWebContainerProps) {
  const [webcontainerInstance, setWebcontainerInstance] =
    useState<WebContainer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [devProcess, setDevProcess] = useState<WebContainerProcess | null>(
    null,
  );
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (iframeRef.current) {
      console.log("BOOTING CONTAINER", files);
      bootContainer({ iframeEl: iframeRef.current })?.then(
        (webcontainerInstance) => {
          setWebcontainerInstance(webcontainerInstance);
        },
      );
    }

    return () => {
      if (webcontainerInstance) {
        console.log("TEARDOWNING CONTAINER");
        if (devProcess) {
          console.log("KILLING DEV PROCESS");
          devProcess.kill();
        }
        webcontainerInstance.teardown();
      }
    };
  }, []);

  useEffect(() => {
    if (webcontainerInstance && iframeRef.current && !hasStarted) {
      console.log("STARTING CONTAINER", files);
      startContainer({
        files,
        iframeEl: iframeRef.current,
        webcontainerInstance,
        setDevProcess,
      });
      setHasStarted(true);
    }
  }, [webcontainerInstance, files, hasStarted]);

  useEffect(() => {
    if (webcontainerInstance && files) {
      console.log("MOUNTING FILES", files);
      webcontainerInstance.mount(files);
    }
  }, [files]);

  const handleRefresh = async () => {
    if (!webcontainerInstance || !iframeRef.current || isRefreshing) return;

    setIsRefreshing(true);
    try {
      if (devProcess) {
        iframeRef.current.src = "";
        await devProcess.kill();
      }
      await startContainer({
        files,
        iframeEl: iframeRef.current,
        webcontainerInstance,
        setDevProcess,
        doInstall: false,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    webcontainerInstance,
    isRefreshing,
    handleRefresh,
  };
}
