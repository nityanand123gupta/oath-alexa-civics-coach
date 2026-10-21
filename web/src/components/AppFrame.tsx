import { useEffect, useRef, useState } from "react";
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import { PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/**
 * MCP Apps host: renders a server-shipped ui:// view in a sandboxed iframe and
 * streams the tool result into it through the official app bridge
 * (ui/initialize → ui/notifications/tool-input → ui/notifications/tool-result).
 * Reports readiness so the parent can fall back to native cards if the view
 * fails to initialize.
 */
export function AppFrame({
  html,
  client,
  toolArgs,
  toolResult,
  onReady,
  onFail,
}: {
  html: string;
  client: Client;
  toolArgs: Record<string, unknown>;
  toolResult: Record<string, unknown>;
  onReady?: () => void;
  onFail?: (reason: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(430);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let closed = false;
    let initialized = false;
    let bridge: AppBridge | null = null;

    const failTimer = setTimeout(() => {
      if (!initialized && !closed) onFail?.("view did not initialize within 2.5s");
    }, 2500);

    const onLoad = async () => {
      try {
        bridge = new AppBridge(
          client,
          { name: "oath-web-host", version: "1.0.0" },
          { serverTools: {}, logging: {} }
        );
        bridge.oninitialized = async () => {
          initialized = true;
          clearTimeout(failTimer);
          try {
            await bridge!.sendToolInput({ arguments: toolArgs });
            await bridge!.sendToolResult(toolResult as never);
            onReady?.();
          } catch (e) {
            onFail?.((e as Error).message);
          }
        };
        bridge.onsizechange = ({ height: h }) => {
          if (h && h > 80 && h < 1400) setHeight(Math.ceil(h));
        };
        await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
      } catch (e) {
        clearTimeout(failTimer);
        if (!closed) onFail?.((e as Error).message);
      }
    };

    iframe.addEventListener("load", onLoad);
    return () => {
      closed = true;
      clearTimeout(failTimer);
      iframe.removeEventListener("load", onLoad);
      void bridge?.close().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="MCP App view"
      sandbox="allow-scripts"
      srcDoc={html}
      style={{
        width: "100%",
        height,
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 16,
        background: "#0d1326",
        transition: "height .2s",
      }}
    />
  );
}
