import type { ButtonHTMLAttributes, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  TreeEvergreen,
  GlobeHemisphereWest,
  GithubLogo,
  FigmaLogo,
  YoutubeLogo,
  BookOpen,
  Terminal,
  Play,
} from "@phosphor-icons/react";
import { hostname } from "../../shared/url";

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <TreeEvergreen size={23} weight="fill" />
      </span>
      {!compact && (
        <span>
          grove<span className="brand-period">.</span>
        </span>
      )}
    </div>
  );
}
export function SiteIcon({ url, size = 20 }: { url: string; size?: number }) {
  const host = hostname(url);
  if (host.includes("github")) return <GithubLogo size={size} weight="fill" />;
  if (host.includes("figma")) return <FigmaLogo size={size} />;
  if (host.includes("youtube"))
    return <YoutubeLogo size={size} weight="fill" />;
  if (host.includes("notion"))
    return (
      <span className="notion-icon" style={{ fontSize: size }}>
        N
      </span>
    );
  if (host.includes("linear"))
    return (
      <span className="linear-icon" style={{ width: size, height: size }} />
    );
  if (host.includes("developer.mozilla")) return <BookOpen size={size} />;
  if (host.includes("localhost")) return <Terminal size={size} />;
  if (host.includes("vimeo")) return <Play size={size} />;
  return <GlobeHemisphereWest size={size} />;
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${className}`}
          {...(!description ? { "aria-describedby": undefined } : {})}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close dialog">
                <X size={18} />
              </IconButton>
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="modal-description">
              {description}
            </Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function EmptyState({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
