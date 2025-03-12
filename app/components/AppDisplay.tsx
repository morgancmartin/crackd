import { useRef, useState } from "react";
import { FileSystemTree } from "@webcontainer/api";
import { RotateCw, Maximize2, Minimize2 } from "lucide-react";
import { useWebContainer } from "../hooks/useWebContainer";

interface AppDisplayProps {
  files: FileSystemTree;
}

export function AppDisplay({ files }: AppDisplayProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isRefreshing, handleRefresh } = useWebContainer({ files, iframeRef });

  return (
    <div className={`flex ${isFullscreen ? 'fixed inset-0 z-50' : 'h-[97%] w-[98%]'} items-end justify-center overflow-hidden rounded-lg bg-[#171717]`}>
      <div className={`flex ${isFullscreen ? 'h-screen' : 'h-[805px]'} w-full flex-col justify-end`}>
        <div className="flex h-[40px] w-full items-center justify-between border-t border-gray-700 px-4">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center rounded p-2 text-white hover:bg-gray-800 disabled:opacity-50"
            title="Restart container"
          >
            <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center justify-center rounded p-2 text-white hover:bg-gray-800"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
        <iframe
          allow="geolocation; ch-ua-full-version-list; cross-origin-isolated; screen-wake-lock; publickey-credentials-get; shared-storage-select-url; ch-ua-arch; compute-pressure; ch-prefers-reduced-transparency; usb; ch-save-data; publickey-credentials-create; shared-storage; run-ad-auction; ch-ua-form-factors; ch-downlink; otp-credentials; payment; ch-ua; ch-ua-model; ch-ect; autoplay; camera; private-state-token-issuance; accelerometer; ch-ua-platform-version; idle-detection; private-aggregation; interest-cohort; ch-viewport-height; local-fonts; ch-ua-platform; midi; ch-ua-full-version; xr-spatial-tracking; clipboard-read; gamepad; display-capture; keyboard-map; join-ad-interest-group; ch-width; ch-prefers-reduced-motion; browsing-topics; encrypted-media; gyroscope; serial; ch-rtt; ch-ua-mobile; window-management; unload; ch-dpr; ch-prefers-color-scheme; ch-ua-wow64; attribution-reporting; fullscreen; identity-credentials-get; private-state-token-redemption; hid; ch-ua-bitness; storage-access; sync-xhr; ch-device-memory; ch-viewport-width; picture-in-picture; magnetometer; clipboard-write; microphone"
          ref={iframeRef}
          className={`${isFullscreen ? 'h-[calc(100vh-40px)]' : 'h-[760px]'} w-full bg-gray-500`}
        ></iframe>
      </div>
    </div>
  );
} 