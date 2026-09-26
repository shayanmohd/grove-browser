import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import {
  GlobeHemisphereWest,
  LockSimple,
  MagnifyingGlass,
  Star,
} from "@phosphor-icons/react";
import type { Tab } from "../../shared/types";
import { displayUrl } from "../../shared/url";
import { IconButton } from "./ui";

export function Omnibox({
  tab,
  isHome,
  readOnly,
  inputRef,
  bookmarked,
  onNavigate,
  onToggleBookmark,
}: {
  tab: Tab | undefined;
  isHome: boolean;
  readOnly: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  bookmarked: boolean;
  onNavigate: (url: string) => void;
  onToggleBookmark: () => void;
}) {
  const url = isHome || !tab ? "" : tab.url;
  const [value, setValue] = useState(url);
  const [focused, setFocused] = useState(false);
  useEffect(() => setValue(url), [url, tab?.id]);
  // Select after the full address replaces the short one.
  useLayoutEffect(() => {
    if (focused) inputRef.current?.select();
  }, [focused, inputRef]);
  const secure = url.startsWith("https:");
  return (
    <form
      className={`omnibox ${focused ? "focused" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!readOnly) onNavigate(value);
      }}
    >
      <span
        className="omnibox-icon"
        title={
          isHome
            ? "New tab"
            : secure
              ? "Connection uses HTTPS"
              : "Connection is not encrypted"
        }
      >
        {isHome ? (
          <MagnifyingGlass size={14} />
        ) : secure ? (
          <LockSimple size={14} />
        ) : (
          <GlobeHemisphereWest size={14} />
        )}
      </span>
      <input
        ref={inputRef}
        aria-label="Address bar"
        value={focused ? value : displayUrl(url)}
        readOnly={readOnly}
        placeholder="Search or enter a URL"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => setValue(event.target.value)}
      />
      <IconButton
        label={bookmarked ? "Remove bookmark" : "Bookmark this page"}
        disabled={isHome}
        className={bookmarked ? "is-bookmarked" : ""}
        onClick={onToggleBookmark}
      >
        <Star size={15} weight={bookmarked ? "fill" : "regular"} />
      </IconButton>
    </form>
  );
}
