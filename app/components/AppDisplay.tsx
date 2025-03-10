import { useState, useEffect, useRef } from "react";
import { FileSystemTree, WebContainer } from "@webcontainer/api";
import { RotateCw } from "lucide-react";

interface AppDisplayProps {
  files: FileSystemTree;
}

export function AppDisplay({ files }: AppDisplayProps) {
  const [webcontainerInstance, setWebcontainerInstance] = useState<WebContainer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
    console.log("BOOTING CONTAINER", files);
      bootContainer({ iframeEl: iframeRef.current }).then((webcontainerInstance) => {
        setWebcontainerInstance(webcontainerInstance);
      });
    }
  }, []);

  useEffect(() => {
    if (webcontainerInstance && iframeRef.current) {
      console.log("STARTING CONTAINER", files);
      startContainer({ files, iframeEl: iframeRef.current, webcontainerInstance });
    }
  }, [webcontainerInstance, files]);

  const handleRefresh = async () => {
    if (!webcontainerInstance || !iframeRef.current || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await startContainer({ files, iframeEl: iframeRef.current, webcontainerInstance });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex h-[97%] w-[98%] items-end justify-center overflow-hidden rounded-lg bg-[#171717]">
      <div className="flex h-[805px] w-full flex-col justify-end">
        <div className="flex h-[40px] w-full items-center border-t border-gray-700 px-4">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center rounded p-2 text-white hover:bg-gray-800 disabled:opacity-50"
            title="Restart container"
          >
            <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <iframe
          allow="geolocation; ch-ua-full-version-list; cross-origin-isolated; screen-wake-lock; publickey-credentials-get; shared-storage-select-url; ch-ua-arch; compute-pressure; ch-prefers-reduced-transparency; usb; ch-save-data; publickey-credentials-create; shared-storage; run-ad-auction; ch-ua-form-factors; ch-downlink; otp-credentials; payment; ch-ua; ch-ua-model; ch-ect; autoplay; camera; private-state-token-issuance; accelerometer; ch-ua-platform-version; idle-detection; private-aggregation; interest-cohort; ch-viewport-height; local-fonts; ch-ua-platform; midi; ch-ua-full-version; xr-spatial-tracking; clipboard-read; gamepad; display-capture; keyboard-map; join-ad-interest-group; ch-width; ch-prefers-reduced-motion; browsing-topics; encrypted-media; gyroscope; serial; ch-rtt; ch-ua-mobile; window-management; unload; ch-dpr; ch-prefers-color-scheme; ch-ua-wow64; attribution-reporting; fullscreen; identity-credentials-get; private-state-token-redemption; hid; ch-ua-bitness; storage-access; sync-xhr; ch-device-memory; ch-viewport-width; picture-in-picture; magnetometer; clipboard-write; microphone"
          ref={iframeRef}
          className="h-[760px] w-full bg-gray-500"
        ></iframe>
      </div>
    </div>
  );
}

async function installDependencies(webcontainerInstance: WebContainer) {
  // Install dependencies
  const installProcess = await webcontainerInstance.spawn("npm", ["install"]);
  // Wait for install command to exit
  return installProcess.exit;
}

async function startDevServer(
  webcontainerInstance: WebContainer,
  iframeEl: HTMLIFrameElement,
) {
  // Run `npm run start` to start the Express app
  await webcontainerInstance.spawn("npm", ["run", "dev"]);

  // Wait for `server-ready` event
  webcontainerInstance.on("server-ready", (port, url) => {
    iframeEl.src = url;
  });
}

function bootContainer({ iframeEl }: { iframeEl: HTMLIFrameElement }) {
  return WebContainer.boot({ coep: "credentialless" }).then(
    async (webcontainerInstance) => {
      return webcontainerInstance;
    },
  );
}

async function startContainer({
  files,
  iframeEl,
  webcontainerInstance,
}: {
  files: FileSystemTree;
  iframeEl: HTMLIFrameElement;
  webcontainerInstance: WebContainer;
}) {
  await webcontainerInstance.mount(files);
  console.log("installing dependencies");
  const exitCode = await installDependencies(webcontainerInstance);
  if (exitCode !== 0) {
    throw new Error("Installation failed");
  }
  console.log("starting dev server");
  startDevServer(webcontainerInstance, iframeEl);
} 